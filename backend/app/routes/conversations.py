"""
Conversation / Chat routes.

Routes
------
GET    /api/conversations              – List user's conversations
POST   /api/conversations              – Create a new conversation
GET    /api/conversations/<id>         – Get conversation with messages
DELETE /api/conversations/<id>         – Soft-delete conversation
PUT    /api/conversations/<id>         – Rename conversation
POST   /api/conversations/<id>/messages – Send message & get RAG reply
POST   /api/conversations/quick        – One-off question (no persistence)
"""

from flask import Blueprint, request, jsonify, g

from app.supabase_client import get_supabase
from app.services.conversation_service import ConversationService
from app.utils.auth_middleware import require_auth
from app.exceptions import ValidationError, NotFoundError, RAGError

conversations_bp = Blueprint("conversations", __name__)


def _get_service() -> ConversationService:
    return ConversationService(get_supabase())


# ── List conversations ───────────────────────────────────


@conversations_bp.route("/", methods=["GET"])
@require_auth
def list_conversations():
    """
    List the current user's conversations (newest first).

    Query params:
        limit  – int (default 20)
        offset – int (default 0)
    """
    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))

        svc = _get_service()
        conversations = svc.list_conversations(
            user_id=g.current_uid,
            limit=min(limit, 50),
            offset=max(offset, 0),
        )
        return jsonify({
            "success": True,
            "data": conversations,
            "count": len(conversations),
        }), 200

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Create conversation ──────────────────────────────────


@conversations_bp.route("/", methods=["POST"])
@require_auth
def create_conversation():
    """
    Create a new empty conversation.

    Body (optional): { "title": "My question about exams" }
    """
    try:
        data = request.get_json() or {}
        title = (data.get("title") or "").strip() or None

        svc = _get_service()
        conv = svc.create_conversation(user_id=g.current_uid, title=title)
        return jsonify({
            "success": True,
            "data": conv.to_dict(),
        }), 201

    except RAGError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Get conversation ─────────────────────────────────────


@conversations_bp.route("/<conversation_id>", methods=["GET"])
@require_auth
def get_conversation(conversation_id):
    """Get a conversation with all its messages."""
    try:
        svc = _get_service()
        conv = svc.get_conversation(conversation_id, user_id=g.current_uid)
        return jsonify({
            "success": True,
            "data": conv.to_dict(include_messages=True),
        }), 200

    except NotFoundError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Delete conversation ──────────────────────────────────


@conversations_bp.route("/<conversation_id>", methods=["DELETE"])
@require_auth
def delete_conversation(conversation_id):
    """Soft-delete a conversation."""
    try:
        svc = _get_service()
        svc.delete_conversation(conversation_id, user_id=g.current_uid)
        return jsonify({
            "success": True,
            "message": "Conversation deleted.",
        }), 200

    except NotFoundError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Rename conversation ──────────────────────────────────


@conversations_bp.route("/<conversation_id>", methods=["PUT"])
@require_auth
def rename_conversation(conversation_id):
    """
    Rename a conversation.

    Body: { "title": "New title" }
    """
    try:
        data = request.get_json() or {}
        title = (data.get("title") or "").strip()

        svc = _get_service()
        updated = svc.rename_conversation(
            conversation_id, user_id=g.current_uid, title=title,
        )
        return jsonify({
            "success": True,
            "data": updated,
        }), 200

    except (ValidationError, NotFoundError) as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Send message ─────────────────────────────────────────


@conversations_bp.route("/<conversation_id>/messages", methods=["POST"])
@require_auth
def send_message(conversation_id):
    """
    Send a message in a conversation and get a RAG-powered reply.

    Body:
    {
        "content": "What are the exam rules?",
        "top_k":   8   (optional, default 8)
    }

    Returns:
    {
        "success":           true,
        "user_message":      {"role": "user", "content": "..."},
        "assistant_message": {"role": "assistant", "content": "..."},
        "sources":           [...],
        "language":          "French",
        "has_answer":        true
    }
    """
    try:
        data = request.get_json() or {}
        content = (data.get("content") or "").strip()
        top_k = int(data.get("top_k", 8))

        if not content:
            raise ValidationError("content is required")
        if top_k < 1 or top_k > 20:
            raise ValidationError("top_k must be between 1 and 20")

        svc = _get_service()
        result = svc.send_message(
            conversation_id=conversation_id,
            user_id=g.current_uid,
            content=content,
            top_k=top_k,
        )

        return jsonify({
            "success": True,
            **result,
        }), 200

    except (ValidationError, NotFoundError) as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except RAGError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ── Quick ask (no conversation) ──────────────────────────


@conversations_bp.route("/quick", methods=["POST"])
@require_auth
def quick_ask():
    """
    One-off RAG question without persisting a conversation.

    Body:
    {
        "question": "Combien d'absences sont autorisées ?",
        "history":  [...],   (optional)
        "top_k":    8        (optional)
    }
    """
    try:
        data = request.get_json() or {}
        question = (data.get("question") or "").strip()
        history = data.get("history") or []
        top_k = int(data.get("top_k", 8))

        if not question:
            raise ValidationError("question is required")
        if top_k < 1 or top_k > 20:
            raise ValidationError("top_k must be between 1 and 20")

        svc = _get_service()
        result = svc.quick_ask(
            question=question,
            history=history if history else None,
            top_k=top_k,
        )

        return jsonify(result), 200

    except ValidationError as exc:
        return jsonify({"success": False, "error": exc.message}), exc.status_code
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
