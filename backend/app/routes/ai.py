from flask import Blueprint, request, jsonify
from app.utils.auth_middleware import require_auth
from app.container import get_query_service
from app.exceptions import ValidationError, RAGError

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/query", methods=["POST"])
@require_auth
def query_documents():
    """
    RAG endpoint — answers a student question using retrieved university documents.

    Body:
    {
        "question": "Combien d'absences sont autorisées ?",
        "history":  [                                         <-- optional
            {"role": "user",      "content": "..."},
            {"role": "assistant", "content": "..."}
        ],
        "top_k": 5                                            <-- optional, default 5
    }

    Returns:
    {
        "success": bool,
        "question": str,
        "answer": str,
        "sources": [{"id", "title", "type", "similarity", "rerank_score"}, ...],
        "language": str,    -- detected language (French / Arabic / English)
        "has_answer": bool  -- False when no relevant docs found
    }
    """
    try:
        data = request.get_json() or {}
        question = (data.get("question") or "").strip()
        history = data.get("history") or []
        top_k = int(data.get("top_k", 5))

        # Validate input
        if not question:
            raise ValidationError("question is required")
        
        if top_k < 1 or top_k > 20:
            raise ValidationError("top_k must be between 1 and 20")
        
        # Get query service and process question
        query_service = get_query_service()
        
        # Validate conversation history if provided
        if history and not query_service.validate_conversation_history(history):
            raise ValidationError("Invalid conversation history format")
        
        result = query_service.answer_question(
            question=question,
            top_k=top_k,
            conversation_history=history if history else None
        )
        
        return jsonify(result), 200
        
    except ValidationError as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except RAGError as e:
        return jsonify({"success": False, "error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500
