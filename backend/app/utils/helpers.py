def success_response(data, status_code=200):
    """Standardized success JSON response."""
    return {"data": data, "error": None}, status_code

def error_response(message, status_code=400):
    """Standardized error JSON response."""
    return {"data": None, "error": message}, status_code

def paginate(query_list, page=1, per_page=10):
    """Simple in-memory pagination helper."""
    start = (page - 1) * per_page
    end   = start + per_page
    return {
        "page":       page,
        "per_page":   per_page,
        "total":      len(query_list),
        "results":    query_list[start:end],
    }
