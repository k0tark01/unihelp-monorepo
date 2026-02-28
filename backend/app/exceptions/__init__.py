"""Custom exceptions for better error handling."""


class BaseAPIException(Exception):
    """Base exception for all API exceptions."""
    
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(BaseAPIException):
    """Raised when input validation fails."""
    
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class NotFoundError(BaseAPIException):
    """Raised when a resource is not found."""
    
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class UnauthorizedError(BaseAPIException):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status_code=401)


class ForbiddenError(BaseAPIException):
    """Raised when user doesn't have permission."""
    
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status_code=403)


class EmbeddingError(BaseAPIException):
    """Raised when embedding generation fails."""
    
    def __init__(self, message: str):
        super().__init__(f"Embedding error: {message}", status_code=500)


class DatabaseError(BaseAPIException):
    """Raised when database operations fail."""
    
    def __init__(self, message: str):
        super().__init__(f"Database error: {message}", status_code=500)


class RAGError(BaseAPIException):
    """Raised when RAG operations fail."""
    
    def __init__(self, message: str):
        super().__init__(f"RAG error: {message}", status_code=500)
