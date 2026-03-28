// ── TILE MAP VIEWER ──────────────────────────
const TILE_BASE = "https://mortarmaster3000.github.io/zomboid/tiles";
const TILE_SIZE = 256;
const MAX_ZOOM  = 5;
const MAP_W     = 153600;  // 150 tiles * 1024
const MAP_H     = 81920;   // 80 tiles * 1024

const canvas  = document.getElementById("map-canvas");
const ctx     = canvas.getContext("2d");

let camX    = 0, camY = 0;   // pan offset in screen px
let zoom    = 0;              // 0-MAX_ZOOM (float)
let scale   = 1;              // 2^zoom scaled to fit
let isDragging = false;
let dragStartX, dragStartY, camStartX, camStartY;

const tileCache = {};

function getTileImg(z, col, row) {
  const key = `${z}/${col}_${row}`;
  if (tileCache[key]) return tileCache[key];
  const img = new Image();
  img.src = `${TILE_BASE}/${z}/${col}_${row}.jpg`;
  img.onload = () => draw();
  tileCache[key] = img;
  return img;
}

function resize() {
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  draw();
}

function getMapSize() {
  // At integer zoom level z, map is scaled to fit within TILE_SIZE * 2^z
  const z    = Math.round(zoom);
  const s    = 2 ** (z - MAX_ZOOM);
  const mapW = MAP_W * s;
  const mapH = MAP_H * s;
  // Interpolate between zoom levels
  const frac   = zoom - Math.floor(zoom);
  const zLow   = Math.floor(zoom);
  const zHigh  = Math.min(Math.ceil(zoom), MAX_ZOOM);
  const sLow   = 2 ** (zLow  - MAX_ZOOM);
  const sHigh  = 2 ** (zHigh - MAX_ZOOM);
  const curS   = sLow + (sHigh - sLow) * frac;
  return { w: MAP_W * curS, h: MAP_H * curS, s: curS };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { w: mapW, h: mapH, s: curScale } = getMapSize();
  const tileZ    = Math.min(Math.round(zoom), MAX_ZOOM);
  const tileScale = 2 ** (tileZ - MAX_ZOOM);
  const tileMapW  = MAP_W * tileScale;
  const tileMapH  = MAP_H * tileScale;
  const numCols   = Math.ceil(tileMapW / TILE_SIZE);
  const numRows   = Math.ceil(tileMapH / TILE_SIZE);
  const renderS   = curScale / tileScale; // how much to scale each tile image

  const tileRenderSize = TILE_SIZE * renderS;

  // Only draw visible tiles
  const startCol = Math.max(0, Math.floor(-camX / tileRenderSize));
  const startRow = Math.max(0, Math.floor(-camY / tileRenderSize));
  const endCol   = Math.min(numCols, Math.ceil((canvas.width  - camX) / tileRenderSize));
  const endRow   = Math.min(numRows, Math.ceil((canvas.height - camY) / tileRenderSize));

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const img = getTileImg(tileZ, col, row);
      const x   = camX + col * tileRenderSize;
      const y   = camY + row * tileRenderSize;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, tileRenderSize, tileRenderSize);
      } else {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x, y, tileRenderSize, tileRenderSize);
      }
    }
  }

  // Hide loading once first tiles drawn
  document.getElementById("map-loading").style.display = "none";
  updateMarkers();
}

// ── PAN & ZOOM ───────────────────────────────
canvas.addEventListener("mousedown", (e) => {
  if (window._pinMode) return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  camStartX  = camX;
  camStartY  = camY;
  canvas.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  camX = camStartX + (e.clientX - dragStartX);
  camY = camStartY + (e.clientY - dragStartY);
  draw();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  canvas.style.cursor = window._pinMode ? "crosshair" : "grab";
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta   = e.deltaY > 0 ? -0.15 : 0.15;
  const newZoom = Math.max(0, Math.min(MAX_ZOOM, zoom + delta));
  if (newZoom === zoom) return;

  const mouseX = e.clientX - canvas.getBoundingClientRect().left;
  const mouseY = e.clientY - canvas.getBoundingClientRect().top;

  const { w: oldW, h: oldH } = getMapSize();
  zoom = newZoom;
  const { w: newW, h: newH } = getMapSize();

  camX = mouseX - (mouseX - camX) * (newW / oldW);
  camY = mouseY - (mouseY - camY) * (newH / oldH);
  draw();
}, { passive: false });

// Touch support
let lastTouchDist = null;
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    camStartX  = camX;
    camStartY  = camY;
  }
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (e.touches.length === 1 && isDragging) {
    camX = camStartX + (e.touches[0].clientX - dragStartX);
    camY = camStartY + (e.touches[0].clientY - dragStartY);
    draw();
  } else if (e.touches.length === 2) {
    const dx   = e.touches[0].clientX - e.touches[1].clientX;
    const dy   = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (lastTouchDist) {
      zoom = Math.max(0, Math.min(MAX_ZOOM, zoom + (dist - lastTouchDist) * 0.01));
      draw();
    }
    lastTouchDist = dist;
  }
}, { passive: false });

canvas.addEventListener("touchend", () => { isDragging = false; lastTouchDist = null; });

// ── MARKERS ──────────────────────────────────
function updateMarkers() {
  const layer = document.getElementById("marker-layer");
  layer.innerHTML = "";
  const { s: curScale } = getMapSize();

  if (!window._objectives) return;
  window._objectives.filter(o => !o.done && o.pin).forEach(obj => {
    // pin.x/y are stored as fraction of full map (0-1)
    const screenX = camX + obj.pin.x * MAP_W * curScale;
    const screenY = camY + obj.pin.y * MAP_H * curScale;

    const el = document.createElement("div");
    el.className = "map-marker";
    el.style.left = screenX + "px";
    el.style.top  = screenY + "px";
    el.innerHTML  = `<div class="marker-dot"></div><div class="marker-tooltip">${escapeHTML(obj.title)}</div>`;
    layer.appendChild(el);
  });
}

// Click to place pin
canvas.addEventListener("click", (e) => {
  if (!window._pinMode) return;
  const { s: curScale } = getMapSize();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const fx = (sx - camX) / (MAP_W * curScale);
  const fy = (sy - camY) / (MAP_H * curScale);
  window._onPin(fx, fy);
});

function escapeHTML(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Init
window.addEventListener("resize", resize);
resize();

// Fit map to screen on load
const fitScale = Math.min(canvas.width / MAP_W, canvas.height / MAP_H) * 0.9;
zoom = Math.log2(fitScale * (2 ** MAX_ZOOM));
zoom = Math.max(0, Math.min(MAX_ZOOM, zoom));
const { w: mw, h: mh } = getMapSize();
camX = (canvas.width  - mw) / 2;
camY = (canvas.height - mh) / 2;
draw();

canvas.style.cursor = "grab";

window.mapDraw = draw;
