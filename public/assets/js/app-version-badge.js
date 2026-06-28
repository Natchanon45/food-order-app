import { APP_INFO, appVersionText } from './app-info.js?v=20260628-003';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function row(label, value) {
  return `<div class="app-dev-row"><span>${label}</span><strong>${String(value ?? '-')}</strong></div>`;
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
    environment: APP_INFO.environment,
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
  if (document.querySelector('[data-app-version-badge]')) return;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.dataset.appVersionBadge = 'true';
  badge.className = 'app-version-badge';
  badge.textContent = appVersionText();
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
