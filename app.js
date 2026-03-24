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

let objectives    = [];
let currentFilter = "all";

onValue(ref(db, "objectives"), (snapshot) => {
  const data = snapshot.val() || {};
  objectives = Object.entries(data)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => a.createdAt - b.createdAt);
  renderObjectives();
}, (err) => {
  console.error("DB error:", err);
  document.getElementById("sync-status").textContent = "OFFLINE";
  document.querySelector(".status-dot").style.background = "#b84040";
});

window.addObjective = function () {
  const input = document.getElementById("new-objective-title");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  push(ref(db, "objectives"), {
    title,
    done:      false,
    createdAt: Date.now(),
  });
};

document.getElementById("new-objective-title").addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.addObjective();
});

window.toggleDone = function (id, current) {
  update(ref(db, `objectives/${id}`), { done: !current });
};

window.deleteObjective = function (id) {
  remove(ref(db, `objectives/${id}`));
};

window.setFilter = function (filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderObjectives();
};

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
  const date = new Date(obj.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `
    <div class="obj-card-top">
      <input
        type="checkbox"
        class="obj-check"
        ${obj.done ? "checked" : ""}
        onchange="toggleDone('${obj.id}', ${obj.done})"
      />
      <span class="obj-title">${escapeHTML(obj.title)}</span>
      <div class="obj-actions">
        <button class="btn btn-danger" onclick="deleteObjective('${obj.id}')" title="Delete">✕</button>
      </div>
    </div>
    <div class="obj-meta">LOGGED ${date}</div>
  `;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}