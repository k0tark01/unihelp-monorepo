"""
Authentication routes.

Routes
------
POST /api/auth/register   – Create account
POST /api/auth/login      – Sign in, returns JWT + profile
POST /api/auth/logout     – Sign out
GET  /api/auth/me         – Current user + profile
POST /api/auth/refresh    – Exchange refresh_token for new access_token
PUT  /api/auth/profile    – Update user profile fields
"""

from flask import Blueprint, request, jsonify, g

from app.supabase_client import get_supabase
from app.services.auth_service import AuthService, RegisterDTO, LoginDTO
from app.utils.auth_middleware import require_auth
from app.exceptions import ValidationError, UnauthorizedError, NotFoundError, DatabaseError

auth_bp = Blueprint("auth", __name__)


def _get_auth_service() -> AuthService:
    """Create an AuthService bound to the current Supabase client."""
    return AuthService(get_supabase())


def _extract_token() -> str | None:
    header = request.headers.get("Authorization", "")
    return header[7:] if header.startswith("Bearer ") else None


# ── Register ─────────────────────────────────────────────


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Create a new account and populate users + profile tables.

    Body (student):
    {
        "email": "student@uni.edu",
        "password": "secret123",
        "full_name": "Mohamed Ali",
        "role": "student",
        "student_id": "21INF042",
        "department": "Informatique",
        "level": "L3"
    }

    Body (admin):
    {
        "email": "admin@uni.edu",
        "password": "secret123",
        "full_name": "Dr. Karim",
        "role": "admin",
        "title": "Chef de département"
    }
    """
    data = request.get_json() or {}

    try:
        dto = RegisterDTO(
            email=(data.get("email") or "").strip(),
            password=(data.get("password") or "").strip(),
            full_name=(data.get("full_name") or "").strip(),
            role=data.get("role", "student"),
            student_id=(data.get("student_id") or "").strip(),
            department=data.get("department"),
            level=data.get("level"),
            title=data.get("title"),
        )

        svc = _get_auth_service()
        result = svc.register(dto)

        return jsonify({
            "success": True,
            **result.to_dict(),
        }), 201

    except (ValidationError, DatabaseError) as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


# ── Login ────────────────────────────────────────────────


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Sign in with email + password.
    Returns access_token (JWT) + full user + profile.

    Body: { "email": "...", "password": "..." }
    """
    data = request.get_json() or {}

    try:
        dto = LoginDTO(
            email=(data.get("email") or "").strip(),
            password=(data.get("password") or "").strip(),
        )

        svc = _get_auth_service()
        result = svc.login(dto)

        return jsonify({
            "success": True,
            **result.to_dict(),
        }), 200

    except ValidationError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except UnauthorizedError as exc:
        return jsonify({"success": False, "error": exc.message}), 401
    except Exception:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401


# ── Logout ───────────────────────────────────────────────


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Sign out the current user (requires Bearer token)."""
    token = _extract_token()
    if not token:
        return jsonify({"success": False, "error": "Authorization header required"}), 401

    svc = _get_auth_service()
    svc.logout()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


# ── Me ───────────────────────────────────────────────────


@auth_bp.route("/me", methods=["GET"])
def me():
    """
    Return the authenticated user's full profile.
    Requires:  Authorization: Bearer <access_token>
    """
    token = _extract_token()
    if not token:
        return jsonify({"success": False, "error": "Authorization header required"}), 401

    try:
        svc = _get_auth_service()
        user = svc.get_current_user(token)
        return jsonify({
            "success": True,
            **user.to_dict(include_timestamps=True),
        }), 200

    except UnauthorizedError as exc:
        return jsonify({"success": False, "error": exc.message}), 401


# ── Profile update ───────────────────────────────────────


@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    """
    Update current user's profile fields.

    Body: { "full_name": str, "department": str, "level": str, "title": str }
    All fields optional.
    """
    data = request.get_json() or {}
    uid = g.current_uid

    try:
        svc = _get_auth_service()
        user = svc.update_profile(uid, data)
        return jsonify({
            "success": True,
            "message": "Profile updated.",
            "user": user.to_dict(),
        }), 200

    except NotFoundError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Refresh token ────────────────────────────────────────


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """
    Get a new access_token using a refresh_token.

    Body: { "refresh_token": "..." }
    """
    data = request.get_json() or {}
    refresh_token = (data.get("refresh_token") or "").strip()

    try:
        svc = _get_auth_service()
        tokens = svc.refresh_session(refresh_token)
        return jsonify({"success": True, **tokens}), 200

    except (ValidationError, UnauthorizedError) as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
