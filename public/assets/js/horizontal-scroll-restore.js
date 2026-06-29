const SELECTORS = [
  '.catalog-tabs',
  '.category-tabs',
  '.hourly-chart-scroll',
  '.chart-scroll',
  '[data-horizontal-scroll]'
];

function canScrollX(element) {
  return element && element.scrollWidth > element.clientWidth + 2;
}

function bindHorizontalWheel(element) {
  if (!element || element.dataset.horizontalWheelBound === '1') return;
  element.dataset.horizontalWheelBound = '1';
  element.style.overflowX = element.style.overflowX || 'auto';
  element.style.overscrollBehaviorX = element.style.overscrollBehaviorX || 'contain';

  element.addEventListener('wheel', event => {
    if (!canScrollX(element)) return;
    const dominantHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = dominantHorizontal ? event.deltaX : event.deltaY;
    if (!delta) return;
    const before = element.scrollLeft;
    element.scrollLeft += delta;
    if (element.scrollLeft !== before) event.preventDefault();
  }, { passive: false });
}

function bindMouseDrag(element) {
  if (!element || element.dataset.horizontalDragBound === '1') return;
  element.dataset.horizontalDragBound = '1';
  let dragging = false;
  let startX = 0;
  let startScrollLeft = 0;

  element.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !canScrollX(element)) return;
    dragging = true;
    startX = event.clientX;
    startScrollLeft = element.scrollLeft;
    element.classList.add('is-horizontal-dragging');
    element.setPointerCapture?.(event.pointerId);
  });

  element.addEventListener('pointermove', event => {
    if (!dragging) return;
    element.scrollLeft = startScrollLeft - (event.clientX - startX);
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    element.addEventListener(type, () => {
      dragging = false;
      element.classList.remove('is-horizontal-dragging');
    });
  });
}

function enhance(element) {
  bindHorizontalWheel(element);
  bindMouseDrag(element);
}

function enhanceAll(root = document) {
  SELECTORS.forEach(selector => root.querySelectorAll(selector).forEach(enhance));
}

enhanceAll();

const observer = new MutationObserver(records => {
  records.forEach(record => {
    record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      enhanceAll(node);
      SELECTORS.forEach(selector => {
        if (node.matches?.(selector)) enhance(node);
      });
    });
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
