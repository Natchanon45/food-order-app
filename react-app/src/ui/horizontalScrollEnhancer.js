const SELECTORS = ['.catalog-tabs', '.category-tabs', '.sales-chart', '.hourly-chart-scroll', '.chart-scroll', '.table-scroll', '[data-horizontal-scroll]'];

function canScrollX(element) {
  return element && element.scrollWidth > element.clientWidth + 2;
}

function maxScrollLeft(element) {
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

function clampScrollLeft(element, value) {
  return Math.max(0, Math.min(maxScrollLeft(element), value));
}

function scrollByDelta(element, delta) {
  if (!delta || !canScrollX(element)) return false;
  const before = element.scrollLeft;
  const next = clampScrollLeft(element, before + delta);
  if (next === before) return false;
  element.scrollLeft = next;
  return true;
}

function bindHorizontalWheel(element) {
  if (!element || element.dataset.horizontalWheelBound === '1') return;
  element.dataset.horizontalWheelBound = '1';
  element.classList.add('horizontal-scroll-ready');
  element.style.overflowX = element.style.overflowX || 'auto';
  element.style.overflowY = element.style.overflowY || 'hidden';
  element.style.overscrollBehaviorX = element.style.overscrollBehaviorX || 'contain';

  element.addEventListener('wheel', event => {
    if (!canScrollX(element)) return;
    const dominantHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = dominantHorizontal ? event.deltaX : event.deltaY;
    if (!delta) return;
    if (scrollByDelta(element, delta)) event.preventDefault();
  }, { passive: false });
}

function bindTouchDrag(element) {
  if (!element || !element.matches?.('[data-horizontal-scroll]') || element.dataset.horizontalTouchBound === '1') return;
  element.dataset.horizontalTouchBound = '1';
  element.style.touchAction = 'pan-y';

  let tracking = false;
  let decided = false;
  let horizontal = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;

  const reset = () => {
    tracking = false;
    decided = false;
    horizontal = false;
  };

  element.addEventListener('touchstart', event => {
    if (!canScrollX(element) || event.touches.length !== 1) return;
    if (event.target.closest('button,a,input,select,textarea,[role="button"]')) return;
    const touch = event.touches[0];
    tracking = true;
    decided = false;
    horizontal = false;
    startX = touch.clientX;
    startY = touch.clientY;
    startLeft = element.scrollLeft;
  }, { passive: true });

  element.addEventListener('touchmove', event => {
    if (!tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;

    if (!decided) {
      if (Math.abs(diffX) < 5 && Math.abs(diffY) < 5) return;
      horizontal = Math.abs(diffX) > Math.abs(diffY);
      decided = true;
    }
    if (!horizontal) return;

    element.scrollLeft = clampScrollLeft(element, startLeft - diffX);
    event.preventDefault();
  }, { passive: false });

  element.addEventListener('touchend', reset, { passive: true });
  element.addEventListener('touchcancel', reset, { passive: true });
}

function bindMouseDrag(element) {
  if (!element || element.dataset.horizontalDragBound === '1') return;
  element.dataset.horizontalDragBound = '1';
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;

  element.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !canScrollX(element)) return;
    if (event.target.closest('button,a,input,select,textarea,[role="button"]')) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startLeft = element.scrollLeft;
    element.classList.add('is-horizontal-dragging');
  });

  element.addEventListener('pointermove', event => {
    if (!dragging) return;
    const diff = event.clientX - startX;
    if (Math.abs(diff) > 3) moved = true;
    element.scrollLeft = clampScrollLeft(element, startLeft - diff);
  });

  element.addEventListener('click', event => {
    if (!moved) return;
    event.preventDefault();
    event.stopPropagation();
    moved = false;
  }, true);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    element.addEventListener(type, () => {
      dragging = false;
      element.classList.remove('is-horizontal-dragging');
    });
  });
}

function enhance(element) {
  bindHorizontalWheel(element);
  bindTouchDrag(element);
  bindMouseDrag(element);
}

function enhanceAll(root = document) {
  SELECTORS.forEach(selector => root.querySelectorAll(selector).forEach(enhance));
}

enhanceAll();

function containsScrollableTarget(node) {
  if (!(node instanceof Element)) return false;
  return SELECTORS.some(selector => node.matches?.(selector) || node.querySelector?.(selector));
}

const observer = new MutationObserver(records => {
  records.forEach(record => {
    record.addedNodes.forEach(node => {
      if (!containsScrollableTarget(node)) return;
      enhanceAll(node);
      SELECTORS.forEach(selector => {
        if (node.matches?.(selector)) enhance(node);
      });
    });
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('load', () => enhanceAll());
window.addEventListener('resize', () => enhanceAll());
