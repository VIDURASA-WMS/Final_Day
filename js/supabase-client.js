// Creates one shared Supabase client for the whole site.
// Relies on SUPABASE_URL / SUPABASE_ANON_KEY from config.js,
// and on the Supabase library loaded via <script> tag in the HTML.
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
