import { APP_INFO, appVersionText } from './app-info.js?v=20260628-017';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function ensureStyles() {
  if (document.getElementById('appVersionPanelStyle')) return;
  const style = document.createElement('style');
  style.id = 'appVersionPanelStyle';
  style.textContent = `.app-version-badge{position:fixed!important;right:14px!important;bottom:14px!important;z-index:9999!important;width:26px!important;height:26px!important;border:0!important;border-radius:999px!important;background:rgba(21,148,71,.82)!important;color:transparent!important;font-size:0!important;cursor:pointer!important;display:grid!important;place-items:center!important;opacity:.68!important}.app-version-badge:before{content:"";width:8px;height:8px;border-radius:99px;background:#fff}.app-dev-panel[hidden]{display:none}.app-dev-panel{position:fixed;inset:0;z-index:2147483646}.app-dev-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px)}.app-dev-card{position:absolute;right:18px;bottom:58px;width:min(520px,calc(100vw - 24px));max-height:min(760px,calc(100vh - 90px));overflow:auto;border-radius:22px;background:#fff;color:#0f172a;box-shadow:0 24px 80px rgba(15,23,42,.32);padding:18px}.app-dev-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.app-dev-head small{display:block;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.app-dev-head h2{margin:2px 0 0;font-size:22px}.app-dev-close{border:0;border-radius:999px;width:36px;height:36px;background:#f1f5f9;color:#0f172a;font-size:24px;cursor:pointer}.app-dev-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.app-dev-row{border:1px solid #e2e8f0;border-radius:14px;padding:10px;background:#f8fafc}.app-dev-row span{display:block;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase}.app-dev-row strong{display:block;margin-top:5px;font-size:13px;word-break:break-word}.app-dev-section{margin-top:12px;border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff}.app-dev-section h3{margin:0 0 8px;font-size:14px}.app-dev-section li{margin:4px 0}@media(max-width:640px){.app-version-badge{right:14px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;width:22px!important;height:22px!important}.app-dev-card{right:10px;bottom:48px;padding:14px}.app-dev-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
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

function runtimeInfo() {
  const user = readJson('retail_pos_current_user_v1') || readJson('retail_pos_user_v1') || null;
  return {
    version: APP_INFO.version,
    build: APP_INFO.build,
    branch: APP_INFO.branch,
    commit: APP_INFO.commit,
    firebase: APP_INFO.firebaseProject,
    environment: runtimeEnvironment(),
    milestone: APP_INFO.milestone,
    tenant: localStorage.getItem('retail_pos_tenant_id') || '-',
    user: user?.email || user?.username || user?.name || '-',
    role: user?.roleId || user?.role || '-',
    url: location.pathname + location.search,
    screen: `${innerWidth}×${innerHeight}`,
    dpr: devicePixelRatio || 1,
    cacheKeys: Object.keys(localStorage).filter(key => key.startsWith('retail_')).length,
    browser: navigator.userAgent
  };
}

function closePanel() {
  const panel = document.querySelector('[data-app-dev-panel]');
  if (panel) panel.hidden = true;
}

function renderPanel() {
  ensureStyles();
  let panel = document.querySelector('[data-app-dev-panel]');
  if (!panel) {
    panel = document.createElement('div');
    panel.dataset.appDevPanel = 'true';
    panel.className = 'app-dev-panel';
    document.body.appendChild(panel);
  }
  const info = runtimeInfo();
  panel.innerHTML = `<div class="app-dev-backdrop" data-close-dev-panel></div><section class="app-dev-card" role="dialog" aria-modal="true"><header class="app-dev-head"><div><small>Developer Panel</small><h2>${APP_INFO.product}</h2></div><button type="button" class="app-dev-close" data-close-dev-panel>×</button></header><div class="app-dev-grid">${row('Version', info.version)}${row('Build', info.build)}${row('Branch', info.branch)}${row('Commit', info.commit)}${row('Firebase', info.firebase)}${row('Environment', info.environment)}${row('Milestone', info.milestone)}${row('Tenant', info.tenant)}${row('User', info.user)}${row('Role', info.role)}${row('URL', info.url)}${row('Screen', info.screen)}${row('DPR', info.dpr)}${row('Retail Cache Keys', info.cacheKeys)}</div><div class="app-dev-section"><h3>What's New</h3><ul>${(APP_INFO.whatsNew || []).map(item => `<li>${item}</li>`).join('')}</ul></div><details class="app-dev-section"><summary>Browser</summary><p>${info.browser}</p></details></section>`;
  panel.querySelectorAll('[data-close-dev-panel]').forEach(el => el.addEventListener('click', closePanel));
  panel.hidden = false;
}

function renderBadge() {
  ensureStyles();
  if (document.querySelector('[data-app-version-badge]')) return;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'app-version-badge';
  badge.dataset.appVersionBadge = 'true';
  badge.title = `${APP_INFO.product} ${appVersionText()}\nBranch: ${APP_INFO.branch}\nCommit: ${APP_INFO.commit}`;
  badge.addEventListener('click', renderPanel);
  document.body.appendChild(badge);
}

document.addEventListener('keydown', event => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    const panel = document.querySelector('[data-app-dev-panel]');
    if (panel && !panel.hidden) closePanel(); else renderPanel();
  }
  if (event.key === 'Escape') closePanel();
});

renderBadge();
