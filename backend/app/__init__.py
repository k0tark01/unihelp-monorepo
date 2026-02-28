from flask import Flask, jsonify
from flask_cors import CORS
from .config import config
from .supabase_client import init_supabase
from .container import Container
from .exceptions import BaseAPIException


def create_app(config_name="default"):
    """
    Application factory with dependency injection.

    Args:
        config_name: Configuration to use ('development', 'production', 'default')

    Returns:
        Configured Flask application
    """
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Enable CORS for all routes (needed for frontend integration)
    CORS(app)

    # Initialize Supabase REST client
    init_supabase(app)

    # Initialize dependency injection container
    Container.get_instance(app.config)

    # Register error handlers
    register_error_handlers(app)

    # Register blueprints (route groups)
    from .routes.documents import documents_bp
    from .routes.emails import emails_bp
    from .routes.ai import ai_bp
    from .routes.auth import auth_bp
    from .routes.conversations import conversations_bp

    app.register_blueprint(documents_bp,     url_prefix="/api/documents")
    app.register_blueprint(emails_bp,        url_prefix="/api/emails")
    app.register_blueprint(ai_bp,            url_prefix="/api/ai")
    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(conversations_bp, url_prefix="/api/conversations")

    @app.route("/")
    def health_check():
        """Health check endpoint."""
        return jsonify({
            "status": "healthy",
            "service": "UniHelp backend",
            "version": "2.0.0"
        }), 200

    @app.route("/api/health")
    def api_health():
        """API health check with more details."""
        return jsonify({
            "status": "healthy",
            "service": "UniHelp backend API",
            "version": "2.0.0",
            "environment": config_name
        }), 200

    return app


def register_error_handlers(app):
    """
    Register global error handlers for the application.
    
    Args:
        app: Flask application instance
    """
    @app.errorhandler(BaseAPIException)
    def handle_api_exception(error):
        """Handle custom API exceptions."""
        return jsonify({
            "success": False,
            "error": error.message
        }), error.status_code
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Handle 404 errors."""
        return jsonify({
            "success": False,
            "error": "Resource not found"
        }), 404
    
    @app.errorhandler(500)
    def handle_internal_error(error):
        """Handle 500 errors."""
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """Handle unexpected errors."""
        app.logger.error(f"Unexpected error: {str(error)}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred"
        }), 500
