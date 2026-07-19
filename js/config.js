// ============================================================
// FILL IN THESE FOUR VALUES — see README.md Step 3 and Step 6.
// ============================================================

// From Supabase: Settings (gear icon) > API Keys
// Paste in either the "Publishable key" (starts with sb_publishable_...)
// or, on older projects, the "anon key" (starts with eyJ...) from the
// Legacy API Keys tab — both work the same way here.
const SUPABASE_URL = "https://ksamwiaumbebzfflfwth.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ftzf2u4dK4plWBjpGc66tw_1AOndaHt";

// The email you used when creating your ONE shared admin login
// (Supabase: Authentication > Users > Add user). It does not need
// to be a real inbox — guests never see it, they only ever type
// the shared password on the /admin.html page.
const ADMIN_EMAIL = "instructor@login.com";

// What shows at the top of the page. Change this to your event!
const EVENT_NAME = "Final Day";
const EVENT_SUBTITLE = "Share a photo, a memory, or a message for everyone to see.";

// ------------------------------------------------------------
// WELCOME SCREEN — a note + group photo shown once each time
// someone opens the site, before they see the wall.
// ------------------------------------------------------------
// 1. Add your group photo to the "images" folder in this project
//    (in GitHub: open the images folder > Add file > Upload files).
// 2. Set WELCOME_IMAGE below to match the exact file name you used.
//    If the file is missing or misnamed, the note still shows fine —
//    it just won't have a picture.
const WELCOME_IMAGE = "images/WELCOME_IMAGE.jpeg";
const WELCOME_TITLE = "Welcome!";
const WELCOME_NOTE = "We're so glad you're here — scroll down to see everyone's posts, and don't forget to add your own!";
