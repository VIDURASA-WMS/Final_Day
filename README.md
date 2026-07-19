# Event Wall — Setup Guide

A guestbook wall for a one-time event: guests scan a QR code, post text and/or a
photo (named or anonymous), everyone can see, like, and comment, and reported
posts hide automatically for admin review.

This guide assumes **zero prior experience** with code, git, or the terminal.
Every step is click-by-click. It should take about **60–90 minutes** the first
time, done well before your event.

---

## Why this stack (and why it won't crash)

You have two real jobs here: a place to **store** posts/photos, and a place to
**host** the website itself. Both need to be free with no credit card, and
both need to survive ~200 people hitting the site at once.

| Job | Service | Why |
|---|---|---|
| Store posts, comments, likes, photos | **Supabase** (free plan) | A real hosted database + file storage + login system. No credit card required. Scales automatically — there's no single server of yours that can get overloaded and crash. |
| Host the website files | **GitHub Pages** (free, works great with your GitHub Pro account) | Serves your site off GitHub's global CDN. 100GB/month of traffic allowance — for a text/JS/CSS site that's enormous headroom. |

Neither of these is "a server you manage." That's the point: there's no
process that falls over under load. The database (Supabase) and the file
host (GitHub) are both managed by companies that run this infrastructure for
millions of sites — a 200-person burst for a few hours is nothing to them.

I looked into using Firebase (Google's version of this) too, but as of
February 2026 Google now requires a linked credit card (the "Blaze" plan) just
to turn on file storage, even if you'd never actually be charged. Since you
asked for **zero spending and zero payment risk**, Supabase is the better fit —
its free tier needs no card at all.

**One thing to know going in:** a free Supabase project pauses itself after 7
days with no activity, to save resources. It's not deleted — you just click
"restore" in the dashboard. Step 13 below covers how to make sure this
doesn't surprise you right before your event.

---

## What you're getting

- `index.html` — the public wall (view posts, post, like, comment, report)
- `admin.html` — admin login + moderation dashboard
- `css/style.css` — all the styling
- `js/` — all the logic
- `sql/setup.sql` and `sql/setup_storage.sql` — database setup scripts you'll paste in once

You will only ever need to edit **one file** yourself: `js/config.js`.

---

## Step 1 — Create your free Supabase account

1. Go to **[supabase.com](https://supabase.com)** and click **Start your project**.
2. Sign up (GitHub sign-in is easiest since you already have a GitHub account).
3. Click **New project**.
   - **Name**: anything, e.g. "event-wall"
   - **Database password**: generate/enter one and **save it somewhere** (a notes app is fine) — you won't need it day-to-day, but keep it safe.
   - **Region**: pick the one closest to where your event is happening.
   - Click **Create new project**. It takes a minute or two to spin up.

No credit card is asked for at any point in this.

---

## Step 2 — Set up the database tables

1. In your new Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `sql/setup.sql` (included in this project), copy **all of it**, and paste it into the query box.
4. Click **Run** (bottom right). You should see "Success. No rows returned."

This created two tables (`posts`, `comments`), locked them down with security
rules so only your admin login can delete things, and set up three small
functions that safely handle likes/comments/reports even if many people tap
the same button at the same second.

*(If it's ever useful: the report-hide threshold is set to 3 reports inside
this file, in the `report_post` function — search for `>= 3` if you ever want
to change that number.)*

---

## Step 3 — Get your API keys

1. In Supabase, click the **gear icon (Settings)** → **API Keys**.
2. You'll see a **Project URL** (looks like `https://abcdefgh.supabase.co`) and, depending on when your project was created, one of these:
   - A **Publishable key** starting with `sb_publishable_...`, or
   - A **Legacy API Keys** tab containing an **anon key** starting with `eyJ...`
3. Either one works the same way — copy whichever one your project shows you. Keep this tab open — you'll paste the URL and this key into `js/config.js` in Step 6.

Don't worry that this key is "public" — it's designed to be. It only lets
people do what your security rules from Step 2 allow (read posts, create
posts/comments, nothing else). That's normal and safe for this kind of key.

---

## Step 4 — Create the photo storage bucket

1. In Supabase, click **Storage** in the left sidebar.
2. Click **New bucket**.
   - **Name**: `post-images` (must match exactly, lowercase, with the hyphen)
   - **Public bucket**: turn this **ON** (so photos display without extra setup)
   - Click **Create bucket**.
3. Go back to **SQL Editor** → **New query**, paste in everything from `sql/setup_storage.sql`, and click **Run**.

---

## Step 5 — Create your one shared admin login

This is the "one shared admin password" from your requirements: everyone who
moderates logs into the *same* account.

1. In Supabase, click **Authentication** in the left sidebar → **Users** tab.
2. Click **Add user** → **Create new user**.
   - **Email**: make one up, it never needs to receive real mail — e.g. `admin@ourevent.wall`
   - **Password**: choose a password and share it (verbally, or in a private message) with your trusted admins only.
   - Make sure **Auto Confirm User** is switched on (so it doesn't wait for an email confirmation that will never arrive).
   - Click **Create user**.
3. Remember that email address exactly — it goes into `config.js` next.

---

## Step 6 — Fill in `js/config.js`

Open `js/config.js` in any text editor (even Notepad or TextEdit is fine —
you're just editing four lines of text). Replace the placeholder values:

```js
const SUPABASE_URL = "https://abcdefgh.supabase.co";      // from Step 3
const SUPABASE_ANON_KEY = "eyJhbGciOiJI...";               // from Step 3
const ADMIN_EMAIL = "admin@ourevent.wall";                 // from Step 5
const EVENT_NAME = "Amit & Priya's Wedding";                // whatever you like
const EVENT_SUBTITLE = "Share a photo or a memory for us!"; // shown under the title
```

Save the file.

---

## Step 7 — Put the code on GitHub (no terminal needed)

Since you have GitHub Pro, you can even make this repo **private** if you'd
like (Pro allows private repos to use GitHub Pages; free accounts need public
repos for Pages). Either works fine for this project — there's no personal
guest data in the code itself, it all lives safely in Supabase.

1. Go to **[github.com/new](https://github.com/new)**.
2. **Repository name**: e.g. `event-wall`
3. Choose **Public** or **Private** (your choice).
4. Click **Create repository**.
5. On the new repo's page, click **uploading an existing file** (or **Add file → Upload files**).
6. From your computer, drag in **everything** from this project folder — `index.html`, `admin.html`, the `css` folder, the `js` folder (with your edited `config.js`), and the `sql` folder. GitHub's uploader accepts whole folders dragged in.
7. Scroll down, click **Commit changes**.

That's it — no git commands, no terminal.

---

## Step 8 — Turn on GitHub Pages

1. In your repo, click **Settings** (top tab).
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. **Branch**: `main`, folder `/ (root)` → click **Save**.
5. Wait about a minute, then refresh the page. You'll see a green box: **"Your site is live at `https://yourusername.github.io/event-wall/"`**.

That URL is your website. Open it and confirm the wall loads.

---

## Step 9 — Test everything before the event

Open your live URL and check each of these:

- [ ] Post with a name, with a photo → appears at the top
- [ ] Post anonymously, no photo → shows "Anonymous"
- [ ] Like a post → count goes up, button disables (won't let you like twice from the same phone/browser)
- [ ] Comment on a post → appears immediately
- [ ] Report a post 3 times (from 3 different browsers, or a normal + incognito window, since one browser can only report once) → it should disappear from the public wall
- [ ] Go to `https://yourusername.github.io/event-wall/admin.html`, log in with your shared password, see the reported post flagged, and either **Approve & unhide** or **Delete** it
- [ ] Delete a comment from the admin dashboard, confirm it disappears on the public wall

---

## New: sorting and a welcome screen

Two extra features are already built in:

**Sort toggle** — right above the feed, guests can switch between
**🕐 Newest** and **❤️ Most liked**. Nothing to set up; it just works.

**Welcome screen with your group photo** — the first time someone opens the
site each visit, they see a note and a photo before the wall. To set your own:

1. Add your group photo into the `images` folder (in GitHub: open the
   `images` folder → **Add file** → **Upload files**). Delete the placeholder
   `PUT-YOUR-PHOTO-HERE.txt` once you've added your real photo.
2. In `js/config.js`, check that `WELCOME_IMAGE` matches your photo's file
   name exactly, and edit `WELCOME_TITLE` / `WELCOME_NOTE` to whatever you'd
   like it to say.
3. If the photo file is ever missing or misnamed, the note still displays
   fine — it just won't have a picture, so nothing breaks.

It reappears once per browser tab session (so a guest sees it when they
first open your link, but it won't nag them again if they just refresh).

---

## Step 10 — Make the QR code

Once you're happy with the live site:

1. Copy your GitHub Pages URL.
2. Go to **`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=`** and paste your URL right after the `data=` — for example:
   `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=https://yourusername.github.io/event-wall/`
3. Open that link in your browser — it shows the QR code image directly. Right-click → **Save image** (or long-press on mobile).
4. Print it, put it on a table sign, slide, or program — whatever fits your event.

(This is a free public tool with no signup — it just renders the code on the fly. If you'd rather use a design tool instead, any free QR generator works exactly the same way; the only thing that matters is that it encodes your exact URL.)

---

## Step 11 — Handling the traffic burst

The architecture already does the heavy lifting, but a few practical notes
since this is your top priority:

- **Test with a few friends first.** Ask 5–10 people to open the link and post at the same time a day or two before the event. This won't prove it handles 200, but it'll catch any setup mistakes (typo'd keys, wrong bucket name) while there's still time to fix them.
- **Photos are automatically compressed** in the guest's browser before upload (resized to a max of 1600px, compressed to a reasonable quality) — this keeps both storage and bandwidth usage low even with 1000+ photos.
- **The feed loads in pages** (15 posts at a time with a "Load more" button) rather than all at once, which also keeps bandwidth per visit low.
- Nothing about this design routes through a single machine of yours that can run out of memory or crash — the worst case under heavy load is things feeling briefly slower, not going down.

---

## Step 12 — Keep the project awake before the day

Free Supabase projects **pause after 7 days of no activity**. To make sure
it's awake for your event:

- Simplest option: just open your site once every few days while you're
  testing/finalizing it — that resets the 7-day clock.
- The day before your event, open the site and post a test message to
  confirm it's live and awake.
- If it ever does pause, go to your Supabase project dashboard — there'll be
  a **Restore project** button. It takes under a minute and nothing is lost.

---

## After the event — saving everything

Since this is a one-time event, you'll probably want to keep the posts and
photos afterward:

- **Posts/comments as a spreadsheet**: Supabase → **Table Editor** → select the `posts` or `comments` table → the export/download icon → CSV.
- **All photos**: Supabase → **Storage** → `post-images` bucket → select all → **Download**.

You can then delete the Supabase project (or just leave it — it'll simply
pause itself and cost nothing).

---

## Free-tier limits, for your reference

| Resource | Free limit | Your expected usage |
|---|---|---|
| Supabase database | 500 MB | Post/comment text for thousands of posts is a few MB at most — plenty of room |
| Supabase file storage | 1 GB | 1,000 photos, compressed to ~150–300 KB each ≈ 150–300 MB — comfortable |
| Supabase bandwidth | 5 GB/month | 200 guests browsing a paginated, compressed-image feed for a few hours ≈ 1–2 GB — comfortable, but avoid heavy re-testing right up against the limit in the same month as the event |
| GitHub Pages bandwidth | ~100 GB/month | Only serves your tiny HTML/CSS/JS files (photos come from Supabase) — essentially never a concern |

---

## Troubleshooting

- **Blank page / nothing loads** — open the browser's developer console (F12) and look for a red error. Almost always means a typo in `js/config.js`.
- **"Failed to fetch" errors** — double check `SUPABASE_URL` has no trailing slash and the anon key was copied in full.
- **Photos won't upload** — confirm the bucket is named exactly `post-images` and that you ran `setup_storage.sql` *after* creating the bucket.
- **Admin login says wrong password** — check that `ADMIN_EMAIL` in `config.js` exactly matches the email you used in Step 5, and that "Auto Confirm User" was on when you created it.
- **A post won't disappear after 3 reports** — reports are tracked per browser (so one person can't report the same post 3 times themselves); test with 3 genuinely different browsers/devices.

---

## Optional upgrades (not required, but easy later)

- **Custom domain** (e.g. `ourwedding.com` instead of the github.io link) — GitHub Pages supports this for free if you already own a domain.
- **Spam protection** — if you're worried about strangers spamming posts, Cloudflare Turnstile is a free, privacy-friendly captcha you can add to the post form.
- **Live updates instead of the 25-second refresh check** — Supabase supports real-time subscriptions; the current polling approach was chosen for simplicity and reliability for a first project.
