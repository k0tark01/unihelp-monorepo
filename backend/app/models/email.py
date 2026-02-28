from app.extensions import db
from sqlalchemy import func


class Email(db.Model):
    __tablename__ = "emails"

    id         = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    subject    = db.Column(db.Text, nullable=False)
    body       = db.Column(db.Text, nullable=False)
    recipient  = db.Column(db.Text, nullable=True)
    email_type = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id":         self.id,
            "subject":    self.subject,
            "body":       self.body,
            "recipient":  self.recipient,
            "email_type": self.email_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
