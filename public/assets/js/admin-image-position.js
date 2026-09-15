const previewWrap = document.querySelector("#menuImagePreviewWrap");
const preview = document.querySelector("#menuImagePreview");
const removeButton = document.querySelector("#removeMenuImage");

const positionX = 50;
let positionY = 50;
let dragging = false;
let startY = 0;
let startPositionY = 50;

const controls = document.createElement("div");
controls.className = "image-position-controls";
controls.hidden = true;
controls.innerHTML = '<div class="menu-category">ลากรูปขึ้น-ลงเพื่อเลือกพื้นที่แสดง • แนวตั้ง <strong id="imagePositionValue">50%</strong></div><button type="button" class="btn btn-sm" id="resetImagePosition">จัดกึ่งกลางรูป</button>';
previewWrap?.insertAdjacentElement("afterend", controls);

const valueLabel = controls.querySelector("#imagePositionValue");
const resetButton = controls.querySelector("#resetImagePosition");

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function render() {
  positionY = clamp(positionY);
  if (preview) {
    preview.draggable = false;
    preview.style.objectFit = "cover";
    preview.style.objectPosition = `${positionX}% ${positionY}%`;
    preview.style.cursor = "ns-resize";
    preview.style.touchAction = "none";
    preview.style.userSelect = "none";
    preview.style.webkitUserDrag = "none";
  }
  if (valueLabel) valueLabel.textContent = `${positionY}%`;
  controls.hidden = Boolean(previewWrap?.hidden);
}

function pointerStart(event) {
  if (!preview || previewWrap?.hidden) return;
  event.preventDefault();
  dragging = true;
  startY = event.clientY;
  startPositionY = positionY;
  preview.setPointerCapture?.(event.pointerId);
  render();
}

function pointerMove(event) {
  if (!dragging || !preview) return;
  event.preventDefault();
  const rect = preview.getBoundingClientRect();
  positionY = startPositionY - ((event.clientY - startY) / Math.max(rect.height, 1)) * 100;
  render();
}

function pointerEnd(event) {
  if (!dragging) return;
  event.preventDefault();
  dragging = false;
  try { preview?.releasePointerCapture?.(event.pointerId); } catch (_) {}
  render();
}

preview?.addEventListener("dragstart", event => event.preventDefault());
preview?.addEventListener("pointerdown", pointerStart, { passive: false });
preview?.addEventListener("pointermove", pointerMove, { passive: false });
preview?.addEventListener("pointerup", pointerEnd, { passive: false });
preview?.addEventListener("pointercancel", pointerEnd, { passive: false });
preview?.addEventListener("lostpointercapture", () => {
  dragging = false;
  render();
});
resetButton?.addEventListener("click", () => setMenuImagePosition(50, 50));
removeButton?.addEventListener("click", () => setMenuImagePosition(50, 50));

if (previewWrap) new MutationObserver(render).observe(previewWrap, { attributes: true, attributeFilter: ["hidden"] });

export function getMenuImagePosition() {
  return { imagePositionX: 50, imagePositionY: clamp(positionY) };
}

export function setMenuImagePosition(_x = 50, y = 50) {
  positionY = clamp(y);
  render();
}

render();