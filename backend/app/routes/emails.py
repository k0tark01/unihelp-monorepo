"""Email routes — generate, save, list, delete emails."""

from flask import Blueprint, request, jsonify

from app.services.email_service import EmailService, GenerateEmailDTO, SaveEmailDTO
from app.utils.auth_middleware import require_auth
from app.exceptions import ValidationError, DatabaseError

emails_bp = Blueprint("emails", __name__)


def _svc() -> EmailService:
    return EmailService()


# ------------------------------------------------------------------
# GET /api/emails/
# ------------------------------------------------------------------

@emails_bp.route("/", methods=["GET"])
@require_auth
def get_all_emails():
    """Fetch all saved emails, newest first."""
    try:
        emails = _svc().list_emails()
        return jsonify({"success": True, "data": emails}), 200
    except DatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ------------------------------------------------------------------
# GET /api/emails/types
# ------------------------------------------------------------------

@emails_bp.route("/types", methods=["GET"])
@require_auth
def get_email_types():
    """Return supported email types and descriptions."""
    return jsonify({"success": True, "data": _svc().get_email_types()}), 200


# ------------------------------------------------------------------
# POST /api/emails/generate
# ------------------------------------------------------------------

@emails_bp.route("/generate", methods=["POST"])
@require_auth
def generate_and_save_email():
    """
    Generate a formal administrative email via Gemini and persist it.

    Body:
    {
        "email_type":   "attestation"|"reclamation"|"stage"|"absence"|"rattrapage"|"custom",
        "student_name": "Mohamed Ali",
        "student_id":   "21INF042",
        "details":      "optional",
        "recipient":    "Monsieur le Directeur",
        "university":   "IIT / NAU"
    }
    """
    data = request.get_json() or {}

    try:
        dto = GenerateEmailDTO(
            email_type=data.get("email_type", "custom"),
            student_name=data.get("student_name", ""),
            student_id=data.get("student_id", ""),
            details=data.get("details", ""),
            recipient=data.get("recipient", "Monsieur/Madame le Directeur"),
            university=data.get("university", "Institut International de Technologie / NAU"),
        )
        result = _svc().generate_and_save(dto)
        return jsonify({"success": True, **result}), 201
    except ValidationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except DatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ------------------------------------------------------------------
# POST /api/emails/
# ------------------------------------------------------------------

@emails_bp.route("/", methods=["POST"])
@require_auth
def save_email():
    """Manually save an email (subject + body provided by caller)."""
    data = request.get_json() or {}

    try:
        dto = SaveEmailDTO(
            subject=data.get("subject", ""),
            body=data.get("body", ""),
            recipient=data.get("recipient"),
        )
        saved = _svc().save_email(dto)
        return jsonify({"success": True, "data": saved}), 201
    except ValidationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except DatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ------------------------------------------------------------------
# DELETE /api/emails/<id>
# ------------------------------------------------------------------

@emails_bp.route("/<int:email_id>", methods=["DELETE"])
@require_auth
def delete_email(email_id):
    """Delete a saved email by ID."""
    try:
        _svc().delete_email(email_id)
        return jsonify({"success": True, "message": f"Email {email_id} deleted"}), 200
    except DatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
