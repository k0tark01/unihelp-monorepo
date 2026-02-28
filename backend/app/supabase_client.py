from supabase import create_client, Client

supabase: Client = None

def init_supabase(app):
    """Initialize the Supabase client using Flask app config."""
    global supabase
    url = app.config.get("SUPABASE_URL")
    key = app.config.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )

    supabase = create_client(url, key)
    app.extensions["supabase"] = supabase

def get_supabase() -> Client:
    """Return the initialized Supabase client."""
    if supabase is None:
        raise RuntimeError("Supabase client has not been initialized.")
    return supabase
