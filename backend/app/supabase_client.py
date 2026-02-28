from supabase import create_client, Client

supabase: Client = None
supabase_admin: Client = None  # service-role client — bypasses RLS


def init_supabase(app):
    """Initialize the Supabase client(s) using Flask app config."""
    global supabase, supabase_admin

    url = app.config.get("SUPABASE_URL")
    key = app.config.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )

    supabase = create_client(url, key)
    app.extensions["supabase"] = supabase

    # Build a service-role (admin) client when the key is provided.
    # The service-role key bypasses RLS and is safe for server-side writes.
    service_key = app.config.get("SUPABASE_SERVICE_KEY")
    if service_key:
        supabase_admin = create_client(url, service_key)
    else:
        # Fall back to the regular client; RLS policies must allow the operation.
        supabase_admin = supabase

    app.extensions["supabase_admin"] = supabase_admin


def get_supabase() -> Client:
    """Return the initialized Supabase client (anon/public key)."""
    if supabase is None:
        raise RuntimeError("Supabase client has not been initialized.")
    return supabase


def get_supabase_admin() -> Client:
    """
    Return the Supabase admin client (service-role key).
    Use this for server-side writes that must bypass Row Level Security.
    Falls back to the regular client if SUPABASE_SERVICE_KEY is not set.
    """
    if supabase_admin is None:
        raise RuntimeError("Supabase client has not been initialized.")
    return supabase_admin
