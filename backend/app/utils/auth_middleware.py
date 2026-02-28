"""
Authentication decorators for Flask routes.

Usage
-----
from app.utils.auth_middleware import require_auth, require_admin, require_role

@require_auth
def my_view():
    uid  = g.current_uid    # UUID string
    role = g.current_role   # "student", "admin", or "super_admin"

@require_admin
def admin_view():
    ...

@require_role("super_admin")
def super_admin_view():
    ...
"""

from __future__ import annotations

from functools import wraps
from flask import request, jsonify, g
from app.supabase_client import get_supabase


def _extract_token() -> str | None:
    """Extract Bearer token from the Authorization header."""
    header = request.headers.get("Authorization", "")
    return header[7:] if header.startswith("Bearer ") else None


def _validate_token(token: str) -> tuple:
    """
    Validate a Supabase JWT and return (uid, user_row_dict).
    user_row_dict comes from the `users` table (source of truth for role).
    Raises on invalid / expired token.
    """
    sb = get_supabase()
    auth_resp = sb.auth.get_user(token)
    auth_user = auth_resp.user
    uid = str(auth_user.id)

    row_resp = (
        sb.table("users")
        .select("role, full_name, is_active, email")
        .eq("id", uid)
        .maybe_single()
        .execute()
    )
    user_row = row_resp.data or {}

    if not user_row:
        user_row = {
            "role": (auth_user.user_metadata or {}).get("role", "student"),
            "email": auth_user.email,
        }

    return uid, user_row


def require_auth(f):
    """
    Decorator: require any authenticated user (student, admin, or super_admin).
    Sets on Flask's g:
        g.current_uid   – user UUID string
        g.current_role  – role string from users table
        g.user_data     – dict with user row data
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({
                "success": False,
                "error": "Authorization header required.",
                "hint": "Add header:  Authorization: Bearer <access_token>",
            }), 401

        try:
            uid, user_row = _validate_token(token)

            if not user_row.get("is_active", True):
                return jsonify({
                    "success": False,
                    "error": "Account is deactivated. Contact an administrator.",
                }), 403

            g.current_uid = uid
            g.current_role = user_row.get("role", "student")
            g.user_data = user_row
        except Exception:
            return jsonify({
                "success": False,
                "error": "Invalid or expired token. Please log in again.",
            }), 401

        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """
    Decorator: require role == 'admin' or 'super_admin'.
    Returns 401 if not authenticated, 403 if authenticated but not admin.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({
                "success": False,
                "error": "Authorization header required.",
                "hint": "Add header:  Authorization: Bearer <access_token>",
            }), 401

        try:
            uid, user_row = _validate_token(token)
            role = user_row.get("role", "student")
        except Exception:
            return jsonify({
                "success": False,
                "error": "Invalid or expired token. Please log in again.",
            }), 401

        if role not in ("admin", "super_admin"):
            return jsonify({
                "success": False,
                "error": "Admin access required for this action.",
            }), 403

        g.current_uid = uid
        g.current_role = role
        g.user_data = user_row
        return f(*args, **kwargs)
    return decorated


def require_role(*allowed_roles: str):
    """
    Decorator factory: require one of the specified roles.

    Usage::

        @require_role("super_admin")
        def delete_everything(): ...

        @require_role("admin", "super_admin")
        def manage_users(): ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = _extract_token()
            if not token:
                return jsonify({
                    "success": False,
                    "error": "Authorization header required.",
                }), 401

            try:
                uid, user_row = _validate_token(token)
                role = user_row.get("role", "student")
            except Exception:
                return jsonify({
                    "success": False,
                    "error": "Invalid or expired token.",
                }), 401

            if role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "error": f"Required role: {' or '.join(allowed_roles)}.",
                }), 403

            g.current_uid = uid
            g.current_role = role
            g.user_data = user_row
            return f(*args, **kwargs)
        return decorated
    return decorator
