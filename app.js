import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAgCDlOcpwMREGKCpszkBssOOn3D6AXxJ8",
  authDomain:        "zomboid-68880.firebaseapp.com",
  projectId:         "zomboid-68880",
  storageBucket:     "zomboid-68880.firebasestorage.app",
  messagingSenderId: "874135152972",
  appId:             "1:874135152972:web:e05d4f65ddb7b2098d87e9",
  databaseURL:       "https://zomboid-68880-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

let objectives     = [];
let currentFilter  = "all";
let activeObjId    = null;   // for edit modal
let openCommentId  = null;   // which card has comments expanded

// ── FIREBASE ─────────────────────────────────
onValue(ref(db, "objectives"), (snapshot) => {
  const data = snapshot.val() || {};
  objectives = Object.entries(data)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => a.createdAt - b.createdAt);
  renderObjectives();
});

// ── EDIT MODAL ───────────────────────────────
window.openModal = function(id = null) {
  activeObjId = id;
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");

  if (id) {
    const obj = objectives.find(o => o.id === id);
    if (!obj) return;
    document.getElementById("modal-title-label").textContent = "EDIT OBJECTIVE";
    document.getElementById("modal-obj-title").value = obj.title;
    document.getElementById("modal-obj-desc").value  = obj.description || "";
  } else {
    document.getElementById("modal-title-label").textContent = "NEW OBJECTIVE";
    document.getElementById("modal-obj-title").value = "";
    document.getElementById("modal-obj-desc").value  = "";
  }
  setTimeout(() => document.getElementById("modal-obj-title").focus(), 50);
};

window.closeModal = function() {
  document.getElementById("modal-overlay").classList.add("hidden");
  activeObjId = null;
};

window.overlayClick = function(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

window.saveObjective = function() {
  const title = document.getElementById("modal-obj-title").value.trim();
  const desc  = document.getElementById("modal-obj-desc").value.trim();
  if (!title) return;

  if (activeObjId) {
    update(ref(db, `objectives/${activeObjId}`), { title, description: desc });
  } else {
    push(ref(db, "objectives"), {
      title,
      description: desc,
      done:        false,
      comments:    [],
      createdAt:   Date.now(),
    });
  }
  closeModal();
};

document.getElementById("modal-obj-title").addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.saveObjective();
});

// ── COMMENTS DROPDOWN ────────────────────────
window.toggleComments = function(id) {
  openCommentId = openCommentId === id ? null : id;
  renderObjectives();
  if (openCommentId) {
    setTimeout(() => {
      const input = document.getElementById(`comment-input-${id}`);
      if (input) input.focus();
    }, 50);
  }
};

window.postComment = function(id) {
  const input = document.getElementById(`comment-input-${id}`);
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";
  const obj      = objectives.find(o => o.id === id);
  const comments = [...(obj?.comments || []), { text, timestamp: Date.now() }];
  update(ref(db, `objectives/${id}`), { comments });
};

window.commentKeydown = function(e, id) {
  if (e.key === "Enter") window.postComment(id);
};

// ── TOGGLE / DELETE ──────────────────────────
window.toggleDone = function(id, current) {
  update(ref(db, `objectives/${id}`), { done: !current });
};

window.deleteObjective = function(id) {
  if (openCommentId === id) openCommentId = null;
  remove(ref(db, `objectives/${id}`));
};

// ── FILTER ───────────────────────────────────
window.setFilter = function(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderObjectives();
};

// ── RENDER ───────────────────────────────────
function renderObjectives() {
  const list  = document.getElementById("objectives-list");
  const empty = document.getElementById("empty-state");

  let filtered = objectives;
  if (currentFilter === "active") filtered = objectives.filter(o => !o.done);
  if (currentFilter === "done")   filtered = objectives.filter(o => o.done);

  if (filtered.length === 0) {
    empty.style.display = "block";
    [...list.children].forEach(c => { if (c !== empty) c.remove(); });
    return;
  }

  empty.style.display = "none";

  const existing = {};
  [...list.children].forEach(c => { if (c.dataset.id) existing[c.dataset.id] = c; });

  const ids = filtered.map(o => o.id);
  Object.keys(existing).forEach(id => { if (!ids.includes(id)) existing[id].remove(); });

  filtered.forEach((obj) => {
    let card = existing[obj.id];
    if (!card) {
      card = document.createElement("div");
      card.dataset.id = obj.id;
      list.appendChild(card);
    }
    card.className = `obj-card${obj.done ? " done" : ""}`;
    card.innerHTML = cardHTML(obj);
  });
}

function cardHTML(obj) {
  const date         = new Date(obj.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const comments     = obj.comments || [];
  const commentCount = comments.length;
  const isOpen       = openCommentId === obj.id;

  const commentsHTML = isOpen ? `
    <div class="comments-dropdown">
      ${commentCount === 0
        ? `<div class="no-comments">no comments</div>`
        : comments.map(c => `
            <div class="comment-item">
              <span>${escapeHTML(c.text)}</span>
              <span class="comment-meta">${new Date(c.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>`).join("")
      }
      <div class="comment-input-row">
        <input
          type="text"
          id="comment-input-${obj.id}"
          class="obj-input"
          placeholder="Add a comment"
          maxlength="200"
          onkeydown="commentKeydown(event, '${obj.id}')"
        />
        <button class="btn btn-add" onclick="postComment('${obj.id}')">POST</button>
      </div>
    </div>
  ` : "";

  return `
    <div class="obj-card-top">
      <input
        type="checkbox"
        class="obj-check"
        ${obj.done ? "checked" : ""}
        onchange="toggleDone('${obj.id}', ${obj.done})"
      />
      <span class="obj-title" onclick="openModal('${obj.id}')">${escapeHTML(obj.title)}</span>
      <div class="obj-actions">
        <button class="btn-comments ${isOpen ? "active" : ""}" onclick="toggleComments('${obj.id}')">
          comments${commentCount > 0 ? ` ${commentCount}` : ""}
        </button>
        <button class="btn btn-danger" onclick="deleteObjective('${obj.id}')">✕</button>
      </div>
    </div>
    ${obj.description ? `<div class="obj-desc">${escapeHTML(obj.description)}</div>` : ""}
    <div class="obj-meta">LOGGED ${date}</div>
    ${commentsHTML}
  `;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
