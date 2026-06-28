import { APP_INFO, appVersionText } from './app-info.js?v=20260628-002';

function renderVersionBadge() {
  if (document.querySelector('[data-app-version-badge]')) return;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.dataset.appVersionBadge = 'true';
  badge.className = 'app-version-badge';
  badge.textContent = appVersionText();
  badge.title = `${APP_INFO.product} ${appVersionText()}\nBranch: ${APP_INFO.branch}\nFirebase: ${APP_INFO.firebaseProject}`;
  badge.addEventListener('click', () => {
    alert([
      `${APP_INFO.name} / ${APP_INFO.product}`,
      `Version: ${APP_INFO.version}`,
      `Build: ${APP_INFO.build}`,
      `Branch: ${APP_INFO.branch}`,
      `Firebase: ${APP_INFO.firebaseProject}`,
      `Repo: ${APP_INFO.repository}`
    ].join('\n'));
  });
  document.body.appendChild(badge);
}

renderVersionBadge();
