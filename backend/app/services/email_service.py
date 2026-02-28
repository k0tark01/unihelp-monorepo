"""
Email service — business logic for generating and managing emails.
"""

from dataclasses import dataclass
from typing import Optional

from app.exceptions import ValidationError, NotFoundError, DatabaseError
from app.supabase_client import get_supabase
from app.utils.email_generator import generate_email, EMAIL_TYPE_DESCRIPTIONS


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

@dataclass
class GenerateEmailDTO:
    """Validated input for email generation."""

    email_type: str
    student_name: str
    student_id: str
    details: str = ""
    recipient: str = "Monsieur/Madame le Directeur"
    university: str = "Institut International de Technologie / NAU"

    def __post_init__(self):
        self.student_name = (self.student_name or "").strip()
        self.student_id = (self.student_id or "").strip()
        if not self.student_name:
            raise ValidationError("student_name is required")
        if not self.student_id:
            raise ValidationError("student_id is required")
        if self.email_type not in EMAIL_TYPE_DESCRIPTIONS:
            self.email_type = "custom"


@dataclass
class SaveEmailDTO:
    """Validated input for manual email saving."""

    subject: str
    body: str
    recipient: Optional[str] = None

    def __post_init__(self):
        self.subject = (self.subject or "").strip()
        self.body = (self.body or "").strip()
        if not self.subject:
            raise ValidationError("subject is required")
        if not self.body:
            raise ValidationError("body is required")


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class EmailService:
    """Handles email generation, saving, and retrieval."""

    def __init__(self):
        self.sb = get_supabase()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list_emails(self) -> list:
        """Return all saved emails, newest first."""
        try:
            resp = (
                self.sb.table("emails")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch emails: {exc}")

    def get_email_types(self) -> dict:
        """Return the supported email type descriptions."""
        return EMAIL_TYPE_DESCRIPTIONS

    # ------------------------------------------------------------------
    # Generate + persist
    # ------------------------------------------------------------------

    def generate_and_save(self, dto: GenerateEmailDTO) -> dict:
        """
        Generate a formal admin email via Gemini and save it.

        Returns:
            {"generated": {...}, "saved": {...}}
        """
        generated = generate_email(
            email_type=dto.email_type,
            student_name=dto.student_name,
            student_id=dto.student_id,
            details=dto.details,
            recipient=dto.recipient,
            university=dto.university,
        )

        try:
            saved = (
                self.sb.table("emails")
                .insert({
                    "subject": generated["subject"],
                    "body": generated["body"],
                    "recipient": dto.recipient,
                    "email_type": dto.email_type,
                })
                .execute()
            )
            return {"generated": generated, "saved": saved.data}
        except Exception as exc:
            raise DatabaseError(f"Email generated but failed to save: {exc}")

    # ------------------------------------------------------------------
    # Manual save
    # ------------------------------------------------------------------

    def save_email(self, dto: SaveEmailDTO) -> dict:
        """Save a manually composed email."""
        try:
            resp = (
                self.sb.table("emails")
                .insert({
                    "subject": dto.subject,
                    "body": dto.body,
                    "recipient": dto.recipient,
                })
                .execute()
            )
            return resp.data
        except Exception as exc:
            raise DatabaseError(f"Failed to save email: {exc}")

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_email(self, email_id: int) -> bool:
        """Delete an email by ID."""
        try:
            self.sb.table("emails").delete().eq("id", email_id).execute()
            return True
        except Exception as exc:
            raise DatabaseError(f"Failed to delete email {email_id}: {exc}")
