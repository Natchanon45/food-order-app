const tabs = document.querySelector('#categoryTabs');

if (tabs) {
  let pointerDown = false;
  let startX = 0;
  let startScrollLeft = 0;
  let dragged = false;

  function keepActiveVisible() {
    const active = tabs.querySelector('.category-tab.active');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const viewLeft = tabs.scrollLeft;
    const viewRight = viewLeft + tabs.clientWidth;
    if (left < viewLeft) tabs.scrollLeft = Math.max(0, left - 12);
    else if (right > viewRight) tabs.scrollLeft = right - tabs.clientWidth + 12;
  }

  tabs.addEventListener('wheel', event => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (tabs.scrollWidth <= tabs.clientWidth) return;
    event.preventDefault();
    tabs.scrollLeft += event.deltaY;
  }, { passive: false });

  tabs.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerDown = true;
    dragged = false;
    startX = event.clientX;
    startScrollLeft = tabs.scrollLeft;
    tabs.dataset.dragging = 'false';
  });

  tabs.addEventListener('pointermove', event => {
    if (!pointerDown) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) < 5) return;
    dragged = true;
    tabs.dataset.dragging = 'true';
    tabs.scrollLeft = startScrollLeft - dx;
  });

  function stopDrag() {
    if (!pointerDown) return;
    pointerDown = false;
    setTimeout(() => { tabs.dataset.dragging = 'false'; dragged = false; }, 0);
  }

  tabs.addEventListener('pointerup', stopDrag);
  tabs.addEventListener('pointercancel', stopDrag);
  tabs.addEventListener('click', event => {
    if (!dragged && tabs.dataset.dragging !== 'true') {
      requestAnimationFrame(keepActiveVisible);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, true);

  new MutationObserver(() => requestAnimationFrame(keepActiveVisible)).observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  requestAnimationFrame(keepActiveVisible);
}
