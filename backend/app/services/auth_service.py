"""
Authentication service — all auth business logic lives here.

Responsibilities:
  - Register (Supabase Auth + users + profile tables)
  - Login / Logout
  - Token validation & refresh
  - Profile fetching
  - Password reset initiation
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any, Tuple

from app.models.user import User, UserRole, StudentProfile, AdminProfile
from app.exceptions import (
    ValidationError,
    UnauthorizedError,
    NotFoundError,
    DatabaseError,
)

logger = logging.getLogger(__name__)


# ── DTOs ─────────────────────────────────────────────────────────────────

@dataclass
class RegisterDTO:
    """Data transfer object for registration requests."""
    email: str
    password: str
    full_name: str = ""
    role: str = "student"
    # Student-specific
    student_id: str = ""
    department: Optional[str] = None
    level: Optional[str] = None
    # Admin-specific
    title: Optional[str] = None

    def validate(self) -> None:
        """Raise ValidationError if required fields are missing."""
        if not self.email or not self.email.strip():
            raise ValidationError("email is required")
        if not self.password or len(self.password) < 6:
            raise ValidationError("password must be at least 6 characters")
        if not UserRole.is_valid(self.role):
            self.role = "student"
        if self.role == "student" and not self.student_id:
            raise ValidationError("student_id is required for student accounts")


@dataclass
class LoginDTO:
    """Data transfer object for login requests."""
    email: str
    password: str

    def validate(self) -> None:
        if not self.email or not self.password:
            raise ValidationError("email and password are required")


@dataclass
class AuthResult:
    """Result of an auth operation (login / register)."""
    user: User
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "user": self.user.to_dict(),
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
        }


# ── Service ──────────────────────────────────────────────────────────────

class AuthService:
    """
    Stateless authentication service.

    All methods receive the Supabase client so they stay testable
    (easy to mock the client in unit tests).
    """

    def __init__(self, supabase_client):
        self._sb = supabase_client

    # ── Register ─────────────────────────────────────────────────────

    def register(self, dto: RegisterDTO) -> AuthResult:
        """
        Create a Supabase Auth account, insert into `users` + profile table.

        Raises:
            ValidationError  – bad input
            DatabaseError    – Supabase insertion failure
        """
        dto.validate()

        try:
            # 1. Create Supabase Auth account (no email verification)
            auth_resp = self._sb.auth.sign_up({
                "email": dto.email.strip(),
                "password": dto.password,
                "options": {
                    "data": {
                        "role": dto.role,
                        "full_name": dto.full_name,
                    },
                    "email_redirect_to": None,  # Disable email confirmation
                }
            })
            auth_user = auth_resp.user
            session = auth_resp.session
            uid = str(auth_user.id)

            # 2. Insert into users table
            self._sb.table("users").insert({
                "id": uid,
                "email": dto.email.strip(),
                "full_name": dto.full_name or None,
                "role": dto.role,
                "is_active": True,
            }).execute()

            # 3. Insert matching profile
            role_enum = UserRole.from_str(dto.role)
            profile: StudentProfile | AdminProfile

            if role_enum == UserRole.STUDENT:
                self._sb.table("student_profiles").insert({
                    "user_id": uid,
                    "student_id": dto.student_id,
                    "department": dto.department,
                    "level": dto.level,
                }).execute()
                profile = StudentProfile(
                    user_id=uid,
                    student_id=dto.student_id,
                    department=dto.department,
                    level=dto.level,
                )
            else:
                self._sb.table("admin_profiles").insert({
                    "user_id": uid,
                    "title": dto.title,
                }).execute()
                profile = AdminProfile(user_id=uid, title=dto.title)

            user = User(
                id=uid,
                email=dto.email.strip(),
                full_name=dto.full_name,
                role=role_enum,
                is_active=True,
                profile=profile,
            )

            return AuthResult(
                user=user,
                access_token=session.access_token if session else None,
                refresh_token=session.refresh_token if session else None,
                message="Registration successful.",
            )

        except (ValidationError, UnauthorizedError):
            raise
        except Exception as exc:
            logger.exception("Registration failed")
            raise DatabaseError(str(exc)) from exc

    # ── Login ────────────────────────────────────────────────────────

    def login(self, dto: LoginDTO) -> AuthResult:
        """
        Authenticate with email + password.

        Raises:
            ValidationError   – missing fields
            UnauthorizedError – wrong credentials
        """
        dto.validate()

        try:
            auth_resp = self._sb.auth.sign_in_with_password({
                "email": dto.email.strip(),
                "password": dto.password,
            })
            auth_user = auth_resp.user
            session = auth_resp.session
            uid = str(auth_user.id)

            user = self._build_user(uid, fallback_email=auth_user.email)

            return AuthResult(
                user=user,
                access_token=session.access_token,
                refresh_token=session.refresh_token,
                message="Login successful.",
            )
        except (ValidationError,):
            raise
        except Exception:
            raise UnauthorizedError("Invalid email or password")

    # ── Logout ───────────────────────────────────────────────────────

    def logout(self) -> None:
        """Sign out the current session."""
        try:
            self._sb.auth.sign_out()
        except Exception as exc:
            logger.warning("Logout error: %s", exc)

    # ── Get current user ─────────────────────────────────────────────

    def get_current_user(self, token: str) -> User:
        """
        Validate a JWT and return the full User object.

        Raises:
            UnauthorizedError – invalid / expired token
        """
        try:
            auth_resp = self._sb.auth.get_user(token)
            uid = str(auth_resp.user.id)
            return self._build_user(uid, fallback_email=auth_resp.user.email)
        except Exception:
            raise UnauthorizedError("Invalid or expired token")

    # ── Validate token (for middleware) ──────────────────────────────

    def validate_token(self, token: str) -> Tuple[str, str, User]:
        """
        Lightweight token validation returning (uid, role_str, user).

        Used by auth middleware decorators.

        Raises:
            UnauthorizedError – bad token
        """
        try:
            auth_resp = self._sb.auth.get_user(token)
            uid = str(auth_resp.user.id)

            row_resp = (
                self._sb.table("users")
                .select("role, full_name, is_active")
                .eq("id", uid)
                .maybe_single()
                .execute()
            )
            user_row = row_resp.data or {}

            if not user_row:
                # Fallback to user_metadata
                meta = auth_resp.user.user_metadata or {}
                role_str = meta.get("role", "student")
            else:
                role_str = user_row.get("role", "student")

            user = self._build_user(uid, fallback_email=auth_resp.user.email)
            return uid, role_str, user

        except UnauthorizedError:
            raise
        except Exception:
            raise UnauthorizedError("Invalid or expired token")

    # ── Refresh token ────────────────────────────────────────────────

    def refresh_session(self, refresh_token: str) -> Dict[str, str]:
        """
        Exchange a refresh_token for new tokens.

        Returns:
            {"access_token": str, "refresh_token": str}

        Raises:
            ValidationError   – missing token
            UnauthorizedError – invalid token
        """
        if not refresh_token:
            raise ValidationError("refresh_token is required")

        try:
            resp = self._sb.auth.refresh_session(refresh_token)
            session = resp.session
            return {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
            }
        except Exception:
            raise UnauthorizedError("Invalid or expired refresh token")

    # ── Update user profile ──────────────────────────────────────────

    def update_profile(self, uid: str, updates: Dict[str, Any]) -> User:
        """
        Update user / profile fields.

        Allowed keys:
            users:           full_name
            student_profile: department, level
            admin_profile:   title

        Raises:
            NotFoundError – user not found
        """
        # Update users table
        user_updates = {}
        if "full_name" in updates:
            user_updates["full_name"] = updates["full_name"]

        if user_updates:
            self._sb.table("users").update(user_updates).eq("id", uid).execute()

        # Determine role
        row_resp = (
            self._sb.table("users")
            .select("role")
            .eq("id", uid)
            .maybe_single()
            .execute()
        )
        if not row_resp.data:
            raise NotFoundError("User not found")

        role_str = row_resp.data.get("role", "student")

        # Update matching profile
        profile_updates = {}
        if role_str == "student":
            for key in ("department", "level"):
                if key in updates:
                    profile_updates[key] = updates[key]
            if profile_updates:
                self._sb.table("student_profiles").update(profile_updates).eq("user_id", uid).execute()
        else:
            if "title" in updates:
                profile_updates["title"] = updates["title"]
            if profile_updates:
                self._sb.table("admin_profiles").update(profile_updates).eq("user_id", uid).execute()

        return self._build_user(uid)

    # ── Private helpers ──────────────────────────────────────────────

    def _build_user(self, uid: str, fallback_email: str = "") -> User:
        """
        Build a full User object from Supabase tables.
        """
        # Fetch users row
        row_resp = (
            self._sb.table("users")
            .select("*")
            .eq("id", uid)
            .maybe_single()
            .execute()
        )
        user_row = row_resp.data or {}

        if not user_row:
            # Minimal fallback
            return User(id=uid, email=fallback_email)

        role_str = user_row.get("role", "student")

        # Fetch profile
        profile_data = self._fetch_profile(uid, role_str)

        return User.from_db_row(user_row, profile_data)

    def _fetch_profile(self, uid: str, role: str) -> Dict[str, Any]:
        """Fetch the student or admin profile row."""
        table = "student_profiles" if role == "student" else "admin_profiles"
        resp = (
            self._sb.table(table)
            .select("*")
            .eq("user_id", uid)
            .maybe_single()
            .execute()
        )
        return resp.data or {}
