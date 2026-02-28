import io
import logging
import uuid as _uuid

from flask import Blueprint, request, jsonify
from app.utils.auth_middleware import require_auth, require_admin
from app.container import get_document_service, get_rag_engine
from app.supabase_client import get_supabase_admin
from app.exceptions import ValidationError, NotFoundError

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
STORAGE_BUCKET = "documents"


def _extract_text_from_bytes(file_bytes: bytes, ext: str) -> str:
    """Extract plain text from raw file bytes."""
    if ext == "pdf":
        try:
            import pypdf  # pypdf >= 3.x (preferred)
        except ImportError:
            try:
                import PyPDF2 as pypdf  # type: ignore[no-redef]
            except ImportError:
                raise ValueError(
                    "PDF parsing requires the 'pypdf' or 'PyPDF2' package. "
                    "Install it with: pip install pypdf"
                )
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip()

    # Plain text / markdown
    return file_bytes.decode("utf-8", errors="replace").strip()


def _upload_to_storage(file_bytes: bytes, filename: str, ext: str) -> str | None:
    """
    Upload file bytes to Supabase Storage and return the public URL.
    Returns None if the upload fails (non-fatal — document is still ingested).
    """
    try:
        sb = get_supabase_admin()
        content_type = "application/pdf" if ext == "pdf" else "text/plain"
        storage_path = f"{_uuid.uuid4().hex}/{filename}"
        sb.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": content_type, "upsert": "false"},
        )
        return sb.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
    except Exception as exc:
        logger.warning("Storage upload failed for %s: %s", filename, exc)
        return None

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


# ── Upload documents ──────────────────────────────────────────────────────


@documents_bp.route("/upload", methods=["POST"])
@require_admin
def upload_documents():
    """
    Upload one or more documents (PDF / TXT / MD) and ingest them into the
    RAG index.

    Multipart body:
        files  – one or more files with the field name "files"
    """
    if "files" not in request.files:
        return jsonify({"success": False, "error": "No files provided"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files:
        return jsonify({"success": False, "error": "No files provided"}), 400

    results = []
    errors = []

    rag = get_rag_engine()

    for file in uploaded_files:
        filename = file.filename or "unnamed"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            errors.append({"file": filename, "error": f"Unsupported file type: .{ext}"})
            continue

        try:
            # Read bytes once — used for both storage upload and text extraction
            file_bytes = file.read()
            if not file_bytes:
                errors.append({"file": filename, "error": "Empty file"})
                continue

            text = _extract_text_from_bytes(file_bytes, ext)
            if not text:
                errors.append({"file": filename, "error": "Could not extract any text"})
                continue

            # Upload original file to Supabase Storage (non-fatal if it fails)
            file_url = _upload_to_storage(file_bytes, filename, ext)

            title = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
            result = rag.ingest_document(title=title, content=text, doc_type=ext, file_url=file_url)

            if result.get("success"):
                results.append({"file": filename, "title": title, "file_url": file_url, **result})
            else:
                errors.append({"file": filename, "error": result.get("error", "Ingestion failed")})

        except Exception as exc:  # noqa: BLE001
            logger.exception("Upload error for %s", filename)
            errors.append({"file": filename, "error": str(exc)})

    status = 207 if errors and results else (400 if errors else 201)
    return jsonify({
        "success": len(results) > 0,
        "uploaded": results,
        "errors": errors,
        "count": len(results),
    }), status


# ── Reindex all documents ─────────────────────────────────────────────────


@documents_bp.route("/reindex", methods=["POST"])
@require_admin
def reindex_documents():
    """
    Re-generate Gemini embeddings for every document that currently has no
    embedding (or re-embed all documents when force=true is passed).

    Body (optional): { "force": true }  – re-embed even existing embeddings
    """
    try:
        data = request.get_json(silent=True) or {}
        force = bool(data.get("force", False))

        doc_service = get_document_service()
        rag = get_rag_engine()

        # Fetch all documents with their content
        resp = (
            doc_service.supabase
            .table("documents")
            .select("id, title, content, type, embedding")
            .execute()
        )
        all_docs = resp.data or []

        reindexed = []
        skipped = []
        errors = []

        for doc in all_docs:
            if not force and doc.get("embedding"):
                skipped.append(doc["id"])
                continue

            try:
                embedding_text = f"{doc['title']}\n\n{doc['content']}"
                embedding = list(rag.embedding_service.embed_text(embedding_text))
                doc_service.supabase.table("documents").update(
                    {"embedding": embedding}
                ).eq("id", doc["id"]).execute()
                reindexed.append(doc["id"])
            except Exception as exc:  # noqa: BLE001
                logger.exception("Reindex error for doc %s", doc.get("id"))
                errors.append({"id": doc.get("id"), "error": str(exc)})

        return jsonify({
            "success": True,
            "reindexed": len(reindexed),
            "skipped": len(skipped),
            "errors": errors,
        }), 200

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


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
