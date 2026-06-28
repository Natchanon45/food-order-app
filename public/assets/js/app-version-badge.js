import './retail-mobile-cart-bar.js?v=20260628-009';
import { APP_INFO, appVersionText } from './app-info.js?v=20260628-011';

function ensureStyles() {
  if (document.getElementById('appVersionPanelStyle')) return;
  const style = document.createElement('style');
  style.id = 'appVersionPanelStyle';
  style.textContent = `
.app-version-badge{position:fixed;right:12px;bottom:12px;z-index:9999;width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:0;border-radius:999px;background:rgba(21,148,71,.88);color:#fff;font-size:0;line-height:1;box-shadow:0 10px 24px rgba(15,23,42,.20);backdrop-filter:blur(10px);cursor:pointer;display:grid;place-items:center;opacity:.76;transition:opacity .16s ease,transform .16s ease,box-shadow .16s ease}.app-version-badge::before{content:"";width:9px;height:9px;border-radius:999px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.18)}.app-version-badge:hover,.app-version-badge:focus-visible{opacity:1;transform:scale(1.05);box-shadow:0 14px 32px rgba(15,23,42,.26);outline:0}.app-version-badge[data-env="local"]{background:rgba(220,38,38,.9)}.app-version-badge[data-env="staging"]{background:rgba(217,119,6,.9)}
.app-dev-panel[hidden]{display:none}.app-dev-panel{position:fixed;inset:0;z-index:2147483646}.app-dev-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px)}.app-dev-card{position:absolute;right:18px;bottom:58px;width:min(520px,calc(100vw - 24px));max-height:min(760px,calc(100vh - 90px));overflow:auto;border-radius:22px;background:#fff;color:#0f172a;box-shadow:0 24px 80px rgba(15,23,42,.32);padding:18px}.app-dev-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.app-dev-head small{display:block;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.app-dev-head h2{margin:2px 0 0;font-size:22px}.app-dev-close{border:0;border-radius:999px;width:36px;height:36px;background:#f1f5f9;color:#0f172a;font-size:24px;line-height:1;cursor:pointer}.app-dev-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.app-dev-row{border:1px solid #e2e8f0;border-radius:14px;padding:10px;background:#f8fafc}.app-dev-row span{display:block;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.app-dev-row strong{display:block;margin-top:5px;font-size:13px;word-break:break-word}.app-dev-section{margin-top:12px;border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff}.app-dev-section h3{margin:0 0 8px;font-size:14px}.app-dev-section ul{margin:0;padding-left:20px}.app-dev-section li{margin:4px 0}.app-dev-section p{margin:8px 0 0;color:#475569;font-size:12px;word-break:break-word}.app-dev-section summary{font-weight:800;cursor:pointer}@media(max-width:640px){.app-version-badge{right:8px;bottom:calc(86px + env(safe-area-inset-bottom,0px));width:24px;height:24px;min-width:24px;min-height:24px}.app-version-badge::before{width:8px;height:8px;box-shadow:0 0 0 3px rgba(255,255,255,.18)}.app-dev-card{right:10px;bottom:48px;padding:14px}.app-dev-grid{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function row(label, value) {
  return `<div class="app-dev-row"><span>${label}</span><strong>${String(value ?? '-')}</strong></div>`;
}

function runtimeEnvironment() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  if (String(APP_INFO.environment || '').toLowerCase().includes('stag')) return 'staging';
  return APP_INFO.environment || 'production';
}

function collectRuntimeInfo() {
  const posUser = readJson('retail_pos_current_user_v1') || readJson('retail_pos_user_v1') || null;
  const tenantId = localStorage.getItem('retail_pos_tenant_id') || '-';
  return {
    version: APP_INFO.version,
    build: APP_INFO.build,
    branch: APP_INFO.branch,
    commit: APP_INFO.commit,
    firebaseProject: APP_INFO.firebaseProject,
    environment: runtimeEnvironment(),
    milestone: APP_INFO.milestone,
    tenantId,
    user: posUser?.email || posUser?.username || posUser?.name || '-',
    role: posUser?.roleId || posUser?.role || '-',
    url: location.pathname + location.search,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
    localStorageKeys: Object.keys(localStorage).filter(key => key.startsWith('retail_')).length
  };
}

function ensurePanel() {
  let panel = document.querySelector('[data-app-dev-panel]');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.dataset.appDevPanel = 'true';
  panel.className = 'app-dev-panel';
  panel.hidden = true;
  document.body.appendChild(panel);
  return panel;
}

function renderPanel() {
  ensureStyles();
  const info = collectRuntimeInfo();
  const panel = ensurePanel();
  panel.innerHTML = `
    <div class="app-dev-backdrop" data-close-dev-panel></div>
    <section class="app-dev-card" role="dialog" aria-modal="true" aria-label="Developer Panel">
      <header class="app-dev-head">
        <div><small>Developer Panel</small><h2>${APP_INFO.product}</h2></div>
        <button type="button" class="app-dev-close" data-close-dev-panel aria-label="ปิด">×</button>
      </header>
      <div class="app-dev-grid">
        ${row('Version', info.version)}
        ${row('Build', info.build)}
        ${row('Branch', info.branch)}
        ${row('Commit', info.commit)}
        ${row('Firebase', info.firebaseProject)}
        ${row('Environment', info.environment)}
        ${row('Milestone', info.milestone)}
        ${row('Tenant', info.tenantId)}
        ${row('User', info.user)}
        ${row('Role', info.role)}
        ${row('URL', info.url)}
        ${row('Screen', info.screen)}
        ${row('DPR', info.devicePixelRatio)}
        ${row('Retail Cache Keys', info.localStorageKeys)}
      </div>
      <div class="app-dev-section">
        <h3>What's New</h3>
        <ul>${(APP_INFO.whatsNew || []).map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <details class="app-dev-section">
        <summary>Browser</summary>
        <p>${info.userAgent}</p>
      </details>
    </section>`;
  panel.querySelectorAll('[data-close-dev-panel]').forEach(el => el.addEventListener('click', closeDeveloperPanel));
  return panel;
}

function openDeveloperPanel() {
  const panel = renderPanel();
  panel.hidden = false;
  document.body.classList.add('app-dev-panel-open');
}

function closeDeveloperPanel() {
  const panel = document.querySelector('[data-app-dev-panel]');
  if (panel) panel.hidden = true;
  document.body.classList.remove('app-dev-panel-open');
}

function renderVersionBadge() {
  ensureStyles();
  if (document.querySelector('[data-app-version-badge]')) return;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.dataset.appVersionBadge = 'true';
  badge.dataset.env = runtimeEnvironment();
  badge.className = 'app-version-badge';
  badge.textContent = 'DEV';
  badge.setAttribute('aria-label', `Developer panel ${appVersionText()}`);
  badge.title = `${APP_INFO.product} ${appVersionText()}\nBranch: ${APP_INFO.branch}\nCommit: ${APP_INFO.commit}\nFirebase: ${APP_INFO.firebaseProject}`;
  badge.addEventListener('click', openDeveloperPanel);
  document.body.appendChild(badge);
}

document.addEventListener('keydown', event => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    const panel = document.querySelector('[data-app-dev-panel]');
    if (panel && !panel.hidden) closeDeveloperPanel();
    else openDeveloperPanel();
  }
  if (event.key === 'Escape') closeDeveloperPanel();
});

renderVersionBadge();
