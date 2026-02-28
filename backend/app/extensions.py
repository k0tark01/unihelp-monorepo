"""
Shared Flask extensions — imported here to avoid circular imports.
Import `db` from this module everywhere instead of from app/__init__.py.
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
