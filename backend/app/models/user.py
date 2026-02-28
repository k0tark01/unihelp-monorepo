"""
User, StudentProfile, and AdminProfile data models.

These are lightweight dataclass-style models that map to the Supabase
`users`, `student_profiles`, and `admin_profiles` tables.  We do NOT use
SQLAlchemy here — all persistence goes through the Supabase REST client.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


# ── Enums ────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    """Mirror of the Postgres `user_role_enum`."""
    STUDENT = "student"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

    @classmethod
    def is_valid(cls, value: str) -> bool:
        return value in cls._value2member_map_

    @classmethod
    def from_str(cls, value: str) -> "UserRole":
        try:
            return cls(value)
        except ValueError:
            return cls.STUDENT  # safe default


# ── Data classes ─────────────────────────────────────────────────────────

@dataclass
class StudentProfile:
    """Row in `student_profiles`."""
    user_id: str
    student_id: str
    department: Optional[str] = None
    level: Optional[str] = None
    id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "student_id": self.student_id,
            "department": self.department,
            "level": self.level,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StudentProfile":
        return cls(
            user_id=data.get("user_id", ""),
            student_id=data.get("student_id", ""),
            department=data.get("department"),
            level=data.get("level"),
            id=data.get("id"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


@dataclass
class AdminProfile:
    """Row in `admin_profiles`."""
    user_id: str
    title: Optional[str] = None
    id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {"title": self.title}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AdminProfile":
        return cls(
            user_id=data.get("user_id", ""),
            title=data.get("title"),
            id=data.get("id"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


@dataclass
class User:
    """Row in `users` + its associated profile."""
    id: str
    email: str
    role: UserRole = UserRole.STUDENT
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    profile: Optional[StudentProfile | AdminProfile] = None

    # ── Serialisation helpers ────────────────────────────────────────

    def to_dict(self, include_timestamps: bool = False) -> Dict[str, Any]:
        """Public JSON representation."""
        data: Dict[str, Any] = {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "is_active": self.is_active,
            "profile": self.profile.to_dict() if self.profile else {},
        }
        if include_timestamps:
            data["created_at"] = self.created_at
            data["updated_at"] = self.updated_at
        return data

    @classmethod
    def from_db_row(cls, row: Dict[str, Any], profile: Optional[Dict] = None) -> "User":
        """Build a User from a Supabase `users` row + optional profile dict."""
        role = UserRole.from_str(row.get("role", "student"))
        user = cls(
            id=row["id"],
            email=row.get("email", ""),
            role=role,
            full_name=row.get("full_name"),
            is_active=row.get("is_active", True),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        if profile:
            if role == UserRole.STUDENT:
                user.profile = StudentProfile.from_dict({**profile, "user_id": user.id})
            else:
                user.profile = AdminProfile.from_dict({**profile, "user_id": user.id})
        return user

    # ── Convenience checks ───────────────────────────────────────────

    @property
    def is_admin(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

    @property
    def is_super_admin(self) -> bool:
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_student(self) -> bool:
        return self.role == UserRole.STUDENT
