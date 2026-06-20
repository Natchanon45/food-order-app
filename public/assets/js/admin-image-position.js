const previewWrap = document.querySelector("#menuImagePreviewWrap");
const preview = document.querySelector("#menuImagePreview");
const removeButton = document.querySelector("#removeMenuImage");

let positionX = 50;
let positionY = 50;
let dragging = false;
let startX = 0;
let startY = 0;
let startPositionX = 50;
let startPositionY = 50;

const controls = document.createElement("div");
controls.className = "image-position-controls";
controls.hidden = true;
controls.innerHTML = '<div class="menu-category">ลากรูปเพื่อเลือกพื้นที่แสดง • ตำแหน่ง <strong id="imagePositionValue">50%, 50%</strong></div><button type="button" class="btn btn-sm" id="resetImagePosition">จัดกึ่งกลางรูป</button>';
previewWrap?.insertAdjacentElement("afterend", controls);

const valueLabel = controls.querySelector("#imagePositionValue");
const resetButton = controls.querySelector("#resetImagePosition");

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function render() {
  positionX = clamp(positionX);
  positionY = clamp(positionY);
  if (preview) {
    preview.style.objectFit = "cover";
    preview.style.objectPosition = `${positionX}% ${positionY}%`;
    preview.style.cursor = "grab";
    preview.style.touchAction = "none";
  }
  if (valueLabel) valueLabel.textContent = `${positionX}%, ${positionY}%`;
  controls.hidden = Boolean(previewWrap?.hidden);
}

function pointerStart(event) {
  if (!preview || previewWrap?.hidden) return;
  dragging = true;
  startX = event.clientX;
  startY = event.clientY;
  startPositionX = positionX;
  startPositionY = positionY;
  preview.setPointerCapture?.(event.pointerId);
  preview.style.cursor = "grabbing";
}

function pointerMove(event) {
  if (!dragging || !preview) return;
  const rect = preview.getBoundingClientRect();
  positionX = startPositionX - ((event.clientX - startX) / Math.max(rect.width, 1)) * 100;
  positionY = startPositionY - ((event.clientY - startY) / Math.max(rect.height, 1)) * 100;
  render();
}

function pointerEnd(event) {
  if (!dragging) return;
  dragging = false;
  preview?.releasePointerCapture?.(event.pointerId);
  if (preview) preview.style.cursor = "grab";
}

preview?.addEventListener("pointerdown", pointerStart);
preview?.addEventListener("pointermove", pointerMove);
preview?.addEventListener("pointerup", pointerEnd);
preview?.addEventListener("pointercancel", pointerEnd);
resetButton?.addEventListener("click", () => setMenuImagePosition(50, 50));
removeButton?.addEventListener("click", () => setMenuImagePosition(50, 50));

if (previewWrap) new MutationObserver(render).observe(previewWrap, { attributes: true, attributeFilter: ["hidden"] });

export function getMenuImagePosition() {
  return { imagePositionX: clamp(positionX), imagePositionY: clamp(positionY) };
}

export function setMenuImagePosition(x = 50, y = 50) {
  positionX = clamp(x);
  positionY = clamp(y);
  render();
}

render();