from flask import Blueprint, request, jsonify
from app.utils.auth_middleware import require_auth, require_admin
from app.container import get_document_service
from app.exceptions import ValidationError, NotFoundError

documents_bp = Blueprint("documents", __name__)


@documents_bp.route("/", methods=["GET"])
@require_auth
def get_all_documents():
    """
    Fetch all documents (id, title, type, created_at).
    
    Query params:
    - type: Filter by document type (optional)
    - limit: Limit number of results (optional)
    - offset: Pagination offset (optional)
    """
    try:
        doc_service = get_document_service()
        
        # Get query parameters
        from app.services.document_service import DocumentFilter
        filters = DocumentFilter(
            doc_type=request.args.get('type'),
            limit=int(request.args.get('limit', 100)),
            offset=int(request.args.get('offset', 0))
        )
        
        documents = doc_service.get_all(filters)
        return jsonify({"success": True, "data": documents, "count": len(documents)}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@documents_bp.route("/<int:doc_id>", methods=["GET"])
@require_auth
def get_document(doc_id):
    """Fetch a single document by ID."""
    try:
        doc_service = get_document_service()
        document = doc_service.get_by_id(doc_id)
        
        if not document:
            raise NotFoundError(f"Document with id {doc_id} not found")
        
        return jsonify({"success": True, "data": document}), 200
        
    except NotFoundError as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@documents_bp.route("/", methods=["POST"])
@require_admin
def add_document():
    """
    Add a new document and automatically generate + store its Gemini embedding.

    Body: { "title": str, "content": str, "type": str (optional) }
    """
    try:
        data = request.get_json()
        title = (data.get("title") or "").strip()
        content = (data.get("content") or "").strip()
        doc_type = data.get("type")

        if not title or not content:
            raise ValidationError("title and content are required")

        doc_service = get_document_service()
        document = doc_service.create(title, content, doc_type)
        
        return jsonify({"success": True, "data": document}), 201
        
    except ValidationError as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@documents_bp.route("/<int:doc_id>", methods=["PUT"])
@require_admin
def update_document(doc_id):
    """
    Update document fields. Re-generates embedding if title or content changed.
    
    Body: { "title": str (optional), "content": str (optional), "type": str (optional) }
    """
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("No update data provided")
        
        doc_service = get_document_service()
        document = doc_service.update(doc_id, data)
        
        if not document:
            raise NotFoundError(f"Document with id {doc_id} not found")
        
        return jsonify({"success": True, "data": document}), 200
        
    except (ValidationError, NotFoundError) as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@documents_bp.route("/<int:doc_id>", methods=["DELETE"])
@require_admin
def delete_document(doc_id):
    """Delete a document by ID."""
    try:
        doc_service = get_document_service()
        success = doc_service.delete(doc_id)
        
        if not success:
            raise NotFoundError(f"Document with id {doc_id} not found")
        
        return jsonify({"success": True, "message": f"Document {doc_id} deleted"}), 200
        
    except NotFoundError as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@documents_bp.route("/stats", methods=["GET"])
@require_auth
def get_document_stats():
    """Get document statistics."""
    try:
        doc_service = get_document_service()
        
        total_count = doc_service.count()
        
        return jsonify({
            "success": True,
            "data": {
                "total_documents": total_count
            }
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
        return jsonify({"message": f"Document {doc_id} deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
