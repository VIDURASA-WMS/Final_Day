// ============================================================
// EVENT WALL — admin page logic
// ============================================================

const BUCKET = "post-images";

document.getElementById("adminEventName").textContent = `${EVENT_NAME} — Admin`;
document.title = `${EVENT_NAME} — Admin`;

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const postList = document.getElementById("postList");
const statsEl = document.getElementById("stats");
const refreshBtn = document.getElementById("refreshBtn");

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function textToHtml(str) {
  return escapeHtml(str).replaceAll("\n", "<br>");
}
function imageUrlFromPath(path) {
  if (!path) return null;
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- auth ----------

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const submitBtn = loginForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";
  const { error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: passwordInput.value,
  });
  submitBtn.disabled = false;
  submitBtn.textContent = "Log in";
  if (error) {
    loginError.textContent = "Wrong password. Try again.";
    loginError.hidden = false;
    return;
  }
  passwordInput.value = "";
  showDashboard();
});

logoutBtn.addEventListener("click", async () => {
  await client.auth.signOut();
  dashboardPanel.hidden = true;
  loginPanel.hidden = false;
});

async function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  await loadAllPosts();
}

// If already logged in from a previous visit on this device, skip the form.
client.auth.getSession().then(({ data }) => {
  if (data.session) showDashboard();
});

// ---------- data ----------

async function loadAllPosts() {
  postList.innerHTML = `<p class="loading">Loading posts&hellip;</p>`;
  const { data, error } = await client
    .from("posts")
    .select("*")
    .order("hidden", { ascending: false })
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    postList.innerHTML = `<p class="loading">Couldn't load posts. Are you still logged in?</p>`;
    return;
  }

  const hiddenCount = data.filter((p) => p.hidden).length;
  statsEl.textContent = `${data.length} total posts · ${hiddenCount} awaiting review`;

  postList.innerHTML = data.length
    ? data.map(adminPostHtml).join("")
    : `<p class="loading">No posts yet.</p>`;
}

function adminPostHtml(post) {
  const displayName = post.name && post.name.trim() ? escapeHtml(post.name.trim()) : "Anonymous";
  const imgUrl = imageUrlFromPath(post.image_path);
  const created = new Date(post.created_at).toLocaleString();
  return `
    <div class="admin-post ${post.hidden ? "is-hidden" : ""}" data-id="${post.id}" data-image-path="${post.image_path || ""}">
      ${post.hidden ? '<div class="flag">⚑ Hidden — needs review (' + post.report_count + " report" + (post.report_count === 1 ? "" : "s") + ')</div>' : ""}
      ${imgUrl ? `<img class="admin-img" src="${imgUrl}" loading="lazy" alt="">` : ""}
      <div class="admin-post-body">
        <p class="admin-text">${textToHtml(post.body)}</p>
        <div class="admin-meta">${displayName} &middot; ${created}</div>
        <div class="admin-meta">&hearts; ${post.like_count} &middot; &#128172; ${post.comment_count} &middot; &#9873; ${post.report_count}</div>
        <div class="admin-actions">
          ${post.hidden ? '<button class="btn-small btn-approve" data-action="approve">Approve &amp; unhide</button>' : ""}
          <button class="btn-small btn-delete" data-action="delete-post">Delete post</button>
          <button class="btn-small btn-comments" data-action="toggle-comments">View comments</button>
        </div>
        <div class="admin-comments" hidden></div>
      </div>
    </div>
  `;
}

function adminCommentHtml(c) {
  const displayName = c.name && c.name.trim() ? escapeHtml(c.name.trim()) : "Anonymous";
  return `
    <div class="admin-comment" data-comment-id="${c.id}">
      <span>${displayName}: ${textToHtml(c.body)}</span>
      <button class="btn-tiny btn-delete-comment" data-action="delete-comment">Delete</button>
    </div>
  `;
}

// ---------- actions ----------

postList.addEventListener("click", async (e) => {
  const postEl = e.target.closest(".admin-post");
  if (!postEl) return;
  const postId = postEl.dataset.id;

  if (e.target.closest('[data-action="delete-post"]')) {
    const ok = confirm("Delete this post permanently? This also deletes its comments.");
    if (!ok) return;
    const imagePath = postEl.dataset.imagePath;
    const { error } = await client.from("posts").delete().eq("id", postId);
    if (error) {
      alert("Couldn't delete the post.");
      return;
    }
    if (imagePath) {
      await client.storage.from(BUCKET).remove([imagePath]);
    }
    postEl.remove();
    return;
  }

  if (e.target.closest('[data-action="approve"]')) {
    const { error } = await client
      .from("posts")
      .update({ hidden: false, report_count: 0 })
      .eq("id", postId);
    if (error) {
      alert("Couldn't approve the post.");
      return;
    }
    await loadAllPosts();
    return;
  }

  if (e.target.closest('[data-action="toggle-comments"]')) {
    const box = postEl.querySelector(".admin-comments");
    const wasHidden = box.hidden;
    box.hidden = !wasHidden;
    if (wasHidden) {
      box.innerHTML = `<p class="loading">Loading&hellip;</p>`;
      const { data, error } = await client
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      box.innerHTML =
        !error && data.length
          ? data.map(adminCommentHtml).join("")
          : `<p class="loading">No comments.</p>`;
    }
    return;
  }

  if (e.target.closest('[data-action="delete-comment"]')) {
    const commentEl = e.target.closest(".admin-comment");
    const commentId = commentEl.dataset.commentId;
    const { error } = await client.from("comments").delete().eq("id", commentId);
    if (error) {
      alert("Couldn't delete the comment.");
      return;
    }
    commentEl.remove();
    return;
  }
});

refreshBtn.addEventListener("click", loadAllPosts);
