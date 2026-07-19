// ============================================================
// EVENT WALL — public page logic
// ============================================================

const PAGE_SIZE = 15;
const BUCKET = "post-images";

let currentPage = 0;
let reachedEnd = false;
let newestSeenTimestamp = null;
let isLoading = false;
let currentSort = "newest"; // "newest" or "liked"

// Generate a unique ID for this browser so they can delete their own posts later
let myDeviceId = localStorage.getItem("device_id");
if (!myDeviceId) {
  myDeviceId = crypto.randomUUID();
  localStorage.setItem("device_id", myDeviceId);
}

const feedEl = document.getElementById("feed");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const emptyStateEl = document.getElementById("emptyState");
const newPostsBanner = document.getElementById("newPostsBanner");
const sortButtons = document.querySelectorAll(".sort-btn");
const sortIndicator = document.getElementById("sortIndicator");

const welcomeOverlay = document.getElementById("welcomeOverlay");
const welcomeImage = document.getElementById("welcomeImage");
const welcomeTitle = document.getElementById("welcomeTitle");
const welcomeCloseBtn = document.getElementById("welcomeCloseBtn");

const postForm = document.getElementById("postForm");
const postFormPanel = document.getElementById("postFormPanel");
const openFormBtn = document.getElementById("openFormBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");
const anonCheckbox = document.getElementById("anonCheckbox");
const nameInput = document.getElementById("nameInput");
const bodyInput = document.getElementById("bodyInput");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");

// Set text on the main page
document.getElementById("eventName").textContent = EVENT_NAME;
document.title = EVENT_NAME;
document.getElementById("eventSubtitle").textContent = EVENT_SUBTITLE;

// ---------- header three-dot menu ----------

const headerMenuBtn = document.getElementById("headerMenuBtn");
const headerMenuDropdown = document.getElementById("headerMenuDropdown");

function closeHeaderMenu() {
  headerMenuDropdown.hidden = true;
  headerMenuBtn.setAttribute("aria-expanded", "false");
}

headerMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !headerMenuDropdown.hidden;
  if (isOpen) {
    closeHeaderMenu();
  } else {
    headerMenuDropdown.hidden = false;
    headerMenuBtn.setAttribute("aria-expanded", "true");
  }
});

document.addEventListener("click", (e) => {
  if (!headerMenuDropdown.hidden && !e.target.closest(".header-menu")) {
    closeHeaderMenu();
  }
});

// ---------- hide header while scrolling down, reveal on scroll up ----------

const siteHeader = document.getElementById("siteHeader");
let lastScrollY = window.scrollY;
let scrollTicking = false;

function handleHeaderScroll() {
  const currentY = window.scrollY;
  const scrolledDown = currentY > lastScrollY;
  const pastThreshold = currentY > 80;

  if (scrolledDown && pastThreshold) {
    siteHeader.classList.add("is-hidden");
    closeHeaderMenu();
  } else {
    siteHeader.classList.remove("is-hidden");
  }
  lastScrollY = currentY;
  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    requestAnimationFrame(handleHeaderScroll);
    scrollTicking = true;
  }
});

// ---------- welcome overlay (shown once per visit) ----------

function initWelcomeOverlay() {
  if (sessionStorage.getItem("welcomeSeen") === "1") return;

  welcomeTitle.textContent = WELCOME_TITLE;

  if (WELCOME_IMAGE) {
    welcomeImage.src = WELCOME_IMAGE;
    welcomeImage.hidden = false;
    welcomeImage.onerror = () => { welcomeImage.hidden = true; };
  } else {
    welcomeImage.hidden = true;
  }

  welcomeOverlay.hidden = false;
}

function closeWelcomeOverlay() {
  welcomeOverlay.hidden = true;
  sessionStorage.setItem("welcomeSeen", "1");
}

welcomeCloseBtn.addEventListener("click", closeWelcomeOverlay);
welcomeOverlay.addEventListener("click", (e) => {
  if (e.target === welcomeOverlay) closeWelcomeOverlay();
});

initWelcomeOverlay();

// ---------- helpers ----------

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

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function imageUrlFromPath(path) {
  if (!path) return null;
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function hasDone(action, postId) {
  return localStorage.getItem(`${action}_${postId}`) === "1";
}

function markDone(action, postId) {
  localStorage.setItem(`${action}_${postId}`, "1");
}

function removeDone(action, postId) {
  localStorage.removeItem(`${action}_${postId}`);
}

// Compress images before upload
function compressImage(file, maxDim = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- rendering ----------

function postCardHtml(post) {
  const displayName = post.name && post.name.trim() ? escapeHtml(post.name.trim()) : "Anonymous";
  const imgUrl = imageUrlFromPath(post.image_path);
  const liked = hasDone("liked", post.id);
  const reported = hasDone("reported", post.id);
  
  const isMine = post.device_id === myDeviceId;

  return `
    <article class="card" data-id="${post.id}" data-image-path="${post.image_path || ""}">
      ${imgUrl ? `<img class="card-img" src="${imgUrl}" loading="lazy" alt="Photo shared by ${displayName}">` : ""}
      <div class="card-body">
        <p class="card-text">${textToHtml(post.body)}</p>
        <div class="card-meta">
          <span class="card-name">${displayName}</span>
          <span class="dot">&middot;</span>
          <span class="card-time">${timeAgo(post.created_at)}</span>
        </div>
        <div class="card-actions">
          <button class="action-btn like-btn ${liked ? "is-active" : ""}" data-action="like">
            <span class="icon">&hearts;</span> <span class="count">${post.like_count}</span>
          </button>
          <button class="action-btn comment-btn" data-action="toggle-comments">
            <span class="icon">&#128172;</span> <span class="count">${post.comment_count}</span>
          </button>
          <button class="action-btn report-btn ${reported ? "is-active" : ""}" data-action="report" ${reported ? "disabled" : ""}>
            <span class="icon">&#9873;</span> <span class="label">${reported ? "Reported" : "Report"}</span>
          </button>
          
          ${isMine ? `
          <button class="action-btn delete-btn" data-action="delete-mine">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          ` : ""}

        </div>
        <div class="comments" hidden>
          <div class="comments-list"></div>
          <form class="comment-form">
            <input type="text" class="comment-name" placeholder="Name (optional)" maxlength="60">
            <div class="comment-row">
              <input type="text" class="comment-text" placeholder="Write a comment&hellip;" maxlength="500" required>
              <button type="submit" class="comment-send">Send</button>
            </div>
          </form>
        </div>
      </div>
    </article>
  `;
}

function commentHtml(c) {
  const displayName = c.name && c.name.trim() ? escapeHtml(c.name.trim()) : "Anonymous";
  return `
    <div class="comment">
      <span class="comment-author">${displayName}</span>
      <span class="comment-body">${textToHtml(c.body)}</span>
    </div>
  `;
}

// ---------- data ----------

async function fetchPosts(page) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let query = client.from("posts").select("*").eq("hidden", false);

  if (currentSort === "liked") {
    query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.range(from, to);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function loadPage(page) {
  if (isLoading) return;
  isLoading = true;
  loadMoreBtn.textContent = "Loading…";
  loadMoreBtn.disabled = true;

  const posts = await fetchPosts(page);

  if (page === 0 && posts.length > 0) {
    const newestInBatch = posts.reduce(
      (max, p) => (new Date(p.created_at) > new Date(max) ? p.created_at : max),
      posts[0].created_at
    );
    if (!newestSeenTimestamp || new Date(newestInBatch) > new Date(newestSeenTimestamp)) {
      newestSeenTimestamp = newestInBatch;
    }
  }

  if (posts.length === 0) {
    reachedEnd = true;
    loadMoreBtn.hidden = true;
    if (page === 0) emptyStateEl.hidden = false;
  } else {
    emptyStateEl.hidden = true;
    feedEl.insertAdjacentHTML("beforeend", posts.map(postCardHtml).join(""));
    if (posts.length < PAGE_SIZE) {
      reachedEnd = true;
      loadMoreBtn.hidden = true;
    } else {
      loadMoreBtn.hidden = false;
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Load More";
    }
  }
  isLoading = false;
}

async function loadComments(postId, listEl) {
  listEl.innerHTML = `<p class="comments-loading">Loading comments&hellip;</p>`;
  const { data, error } = await client
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) {
    listEl.innerHTML = `<p class="comments-loading">Couldn't load comments.</p>`;
    return;
  }
  listEl.innerHTML = data.length
    ? data.map(commentHtml).join("")
    : `<p class="comments-loading">No comments yet — be the first.</p>`;
}

// ---------- feed interactions (event delegation) ----------

feedEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const postId = card.dataset.id;

  const likeBtn = e.target.closest('[data-action="like"]');
  if (likeBtn) {
    const countEl = likeBtn.querySelector(".count");
    let currentCount = Number(countEl.textContent);

    if (hasDone("liked", postId)) {
      removeDone("liked", postId);
      likeBtn.classList.remove("is-active");
      countEl.textContent = Math.max(0, currentCount - 1);
      
      try {
        await client.rpc("decrement_like", { p_id: postId });
      } catch (err) {
        console.error("Couldn't unlike:", err);
      }
    } else {
      markDone("liked", postId);
      likeBtn.classList.add("is-active");
      countEl.textContent = currentCount + 1;
      
      try {
        await client.rpc("increment_like", { p_id: postId });
      } catch (err) {
        console.error("Couldn't like:", err);
      }
    }
    return;
  }

  const toggleBtn = e.target.closest('[data-action="toggle-comments"]');
  if (toggleBtn) {
    const commentsEl = card.querySelector(".comments");
    const listEl = card.querySelector(".comments-list");
    const wasHidden = commentsEl.hidden;
    commentsEl.hidden = !wasHidden;
    if (wasHidden && !listEl.dataset.loaded) {
      listEl.dataset.loaded = "1";
      await loadComments(postId, listEl);
    }
    return;
  }

  const reportBtn = e.target.closest('[data-action="report"]');
  if (reportBtn) {
    if (hasDone("reported", postId)) return;
    const ok = confirm("Report this post to the admins as inappropriate?");
    if (!ok) return;
    markDone("reported", postId);
    reportBtn.disabled = true;
    reportBtn.classList.add("is-active");
    reportBtn.querySelector(".label").textContent = "Reported";
    try {
      await client.rpc("report_post", { p_id: postId });
    } catch (err) {
      console.error(err);
    }
    return;
  }
  
  const deleteMineBtn = e.target.closest('[data-action="delete-mine"]');
  if (deleteMineBtn) {
    const ok = confirm("Are you sure you want to permanently delete this post?");
    if (!ok) return;
    
    deleteMineBtn.disabled = true;
    deleteMineBtn.style.opacity = "0.5";
    
    try {
      const { data, error } = await client.rpc("delete_my_post", { 
        p_post_id: postId, 
        p_device_id: myDeviceId 
      });
      
      if (error) throw error;

      const imagePath = card.dataset.imagePath;
      if (imagePath) {
        await client.storage.from(BUCKET).remove([imagePath]);
      }

      card.remove();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Couldn't delete the post.");
      deleteMineBtn.disabled = false;
      deleteMineBtn.style.opacity = "1";
    }
    return;
  }
});

feedEl.addEventListener("submit", async (e) => {
  const form = e.target.closest(".comment-form");
  if (!form) return;
  e.preventDefault();
  const card = form.closest(".card");
  const postId = card.dataset.id;
  const nameEl = form.querySelector(".comment-name");
  const textEl = form.querySelector(".comment-text");
  const text = textEl.value.trim();
  if (!text) return;

  const sendBtn = form.querySelector(".comment-send");
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending…";

  try {
    const { error } = await client
      .from("comments")
      .insert({ post_id: postId, name: nameEl.value.trim() || null, body: text });
    if (error) throw error;
    await client.rpc("increment_comment_count", { p_id: postId });

    const listEl = card.querySelector(".comments-list");
    const loadingMsg = listEl.querySelector(".comments-loading");
    if (loadingMsg) loadingMsg.remove();
    listEl.insertAdjacentHTML("beforeend", commentHtml({ name: nameEl.value.trim(), body: text }));

    const countEl = card.querySelector('[data-action="toggle-comments"] .count');
    countEl.textContent = Number(countEl.textContent) + 1;

    textEl.value = "";
  } catch (err) {
    console.error(err);
    alert("Sorry, your comment couldn't be sent. Please try again.");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
});

// ---------- new-posts polling ----------

async function checkForNewPosts() {
  if (!newestSeenTimestamp) return;
  const { count, error } = await client
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("hidden", false)
    .gt("created_at", newestSeenTimestamp);
  if (!error && count > 0) {
    newPostsBanner.hidden = false;
  }
}
setInterval(checkForNewPosts, 25000);

newPostsBanner.addEventListener("click", async () => {
  newPostsBanner.hidden = true;
  feedEl.innerHTML = "";
  currentPage = 0;
  reachedEnd = false;
  await loadPage(currentPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- sort toggle ----------

function positionSortIndicator() {
  if (!sortIndicator) return;
  const activeBtn = document.querySelector(".sort-btn.is-active");
  if (!activeBtn) return;
  sortIndicator.style.width = `${activeBtn.offsetWidth}px`;
  sortIndicator.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
}

sortButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const sort = btn.dataset.sort;
    if (sort === currentSort) return;
    currentSort = sort;
    sortButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    positionSortIndicator();
    newPostsBanner.hidden = true;
    feedEl.innerHTML = "";
    currentPage = 0;
    reachedEnd = false;
    loadPage(0);
  });
});

window.addEventListener("resize", positionSortIndicator);
window.addEventListener("load", positionSortIndicator);
// Position immediately too (fonts/layout may still shift slightly, resize/load cover that)
positionSortIndicator();

// ---------- load more ----------

loadMoreBtn.addEventListener("click", () => {
  if (reachedEnd) return;
  currentPage += 1;
  loadPage(currentPage);
});

// ---------- posting form ----------

let selectedImageFile = null;

openFormBtn.addEventListener("click", () => {
  postFormPanel.hidden = false;
  openFormBtn.hidden = true;
  bodyInput.focus();
});

cancelFormBtn.addEventListener("click", () => {
  postForm.reset();
  imagePreview.hidden = true;
  imagePreview.src = "";
  selectedImageFile = null;
  postFormPanel.hidden = true;
  openFormBtn.hidden = false;
  formError.hidden = true;
});

anonCheckbox.addEventListener("change", () => {
  nameInput.disabled = anonCheckbox.checked;
  if (anonCheckbox.checked) nameInput.value = "";
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) {
    selectedImageFile = null;
    imagePreview.hidden = true;
    return;
  }
  if (!file.type.startsWith("image/")) {
    formError.textContent = "Please choose an image file.";
    formError.hidden = false;
    imageInput.value = "";
    return;
  }
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const body = bodyInput.value.trim();
  if (!body) {
    formError.textContent = "Please write something before posting.";
    formError.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Posting…";

  try {
    let imagePath = null;
    if (selectedImageFile) {
      const blob = await compressImage(selectedImageFile);
      const fileName = `${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await client.storage.from(BUCKET).upload(fileName, blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;
      imagePath = fileName;
    }

    const name = anonCheckbox.checked ? null : nameInput.value.trim() || null;

    const { error: insertError } = await client.from("posts").insert({
      name,
      body,
      image_path: imagePath,
      device_id: myDeviceId 
    });
    if (insertError) throw insertError;

    postForm.reset();
    imagePreview.hidden = true;
    imagePreview.src = "";
    selectedImageFile = null;
    postFormPanel.hidden = true;
    openFormBtn.hidden = false;

    feedEl.innerHTML = "";
    currentPage = 0;
    reachedEnd = false;
    await loadPage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    formError.textContent = "Sorry, that didn't post. Please check your connection and try again.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Post";
  }
});

// ---------- go ----------
loadPage(0);
