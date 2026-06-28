const styleId = 'retailSkeletonLoadingStyle';
const skeletonFlag = 'data-retail-skeleton-ready';

function ensureSkeletonStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
.product-grid.is-loading{position:relative;min-height:220px}.product-grid.is-loading>*{visibility:hidden}.retail-skeleton-grid{display:grid;grid-template-columns:inherit;gap:inherit;grid-column:1/-1;width:100%}.retail-skeleton-card{aspect-ratio:1/1;border:1px solid #dde5df;border-radius:12px;background:#fff;overflow:hidden;position:relative}.retail-skeleton-card::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,#eef4f0 8%,#f9fbfa 18%,#eef4f0 33%);background-size:200% 100%;animation:retailSkeletonShine 1.1s linear infinite}.retail-skeleton-card::after{content:"";position:absolute;left:14%;right:14%;bottom:12%;height:11px;border-radius:999px;background:rgba(221,229,223,.75)}@keyframes retailSkeletonShine{to{background-position-x:-200%}}@media(max-width:600px){.product-grid.is-loading{min-height:190px}.retail-skeleton-card{border-radius:10px}.retail-skeleton-card::after{height:9px;left:16%;right:16%}}@media(prefers-reduced-motion:reduce){.retail-skeleton-card::before{animation:none}}
`;
  document.head.appendChild(style);
}

function createSkeletonGrid(productGrid) {
  let skeleton = productGrid.querySelector('[data-retail-skeleton-grid]');
  if (skeleton) return skeleton;
  skeleton = document.createElement('div');
  skeleton.dataset.retailSkeletonGrid = 'true';
  skeleton.className = 'retail-skeleton-grid';
  const count = window.matchMedia('(max-width: 600px)').matches ? 8 : 12;
  skeleton.innerHTML = Array.from({ length: count }, () => '<div class="retail-skeleton-card"></div>').join('');
  productGrid.appendChild(skeleton);
  return skeleton;
}

function removeSkeleton(productGrid) {
  productGrid.classList.remove('is-loading');
  productGrid.querySelector('[data-retail-skeleton-grid]')?.remove();
}

function hasRealProducts(productGrid) {
  return [...productGrid.children].some(child => !child.matches('[data-retail-skeleton-grid]') && !child.classList.contains('catalog-empty'));
}

function syncSkeleton(productGrid) {
  if (!productGrid) return;
  const hasProducts = hasRealProducts(productGrid);
  if (hasProducts) {
    removeSkeleton(productGrid);
    productGrid.setAttribute(skeletonFlag, 'done');
    return;
  }
  if (productGrid.getAttribute(skeletonFlag) === 'done') return;
  productGrid.classList.add('is-loading');
  createSkeletonGrid(productGrid);
}

function startSkeletonLoading() {
  ensureSkeletonStyle();
  const productGrid = document.querySelector('#productGrid');
  if (!productGrid) return;
  syncSkeleton(productGrid);
  const observer = new MutationObserver(() => syncSkeleton(productGrid));
  observer.observe(productGrid, { childList: true, subtree: false });
  window.setTimeout(() => removeSkeleton(productGrid), 6000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSkeletonLoading, { once: true });
} else {
  startSkeletonLoading();
}

export {};
