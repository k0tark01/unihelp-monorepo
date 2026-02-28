from app.extensions import db
from pgvector.sqlalchemy import Vector
from sqlalchemy import func


class Document(db.Model):
    __tablename__ = "documents"

    id         = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    title      = db.Column(db.Text, nullable=False)
    content    = db.Column(db.Text, nullable=False)
    type       = db.Column(db.Text, nullable=True)
    embedding  = db.Column(Vector(768), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self, include_embedding=False):
        data = {
            "id":         self.id,
            "title":      self.title,
            "content":    self.content,
            "type":       self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_embedding and self.embedding is not None:
            data["embedding"] = list(self.embedding)
        return data
