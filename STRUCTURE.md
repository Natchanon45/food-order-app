# Project Structure and Working Rules

> Stable orientation document for a new ChatGPT session.
> For the latest active work state, always read `docs/NEXT_CHAT_HANDOFF.md` after this file.

## Repository

- Repository: `Natchanon45/food-order-app`
- Local path: `/Users/natchanonsripleng/Desktop/Sites/food-order-app`
- Current active branch: `feature/react-firebase-port`
- Firebase project: `chat-45754`
- React dev URL: `http://127.0.0.1:5002/react/`

## Laravel MASTER reference

Laravel is the visual and behavioral source of truth during the React + Firebase migration.

- Path: `/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80`
- MASTER branch: `main`
- Do not redesign a React page when a Laravel MASTER implementation exists.
- Compare source, DOM/classes, responsive behavior, icons, dates, dialogs, buttons, and runtime screenshots.

## Important directories

- React source: `react-app/src/`
- React parity CSS: `react-app/public/parity/css/`
- Firebase Functions: `functions/`
- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`
- React build output: `public/react/`
## Canonical Super Admin routes already wired to React

- `/platform`
- `/platform/owners`
- `/platform/contact`
- `/platform/pricing`
- `/admin/tenants`

The same pages remain available under `/react/...` during migration.

## Source-of-truth document order

When starting a new chat, read in this order:

1. `README.md`
2. `STRUCTURE.md`
3. `docs/NEXT_CHAT_HANDOFF.md`
4. `docs/SAAS_MIGRATION.md` for historical SaaS architecture only

If historical documentation conflicts with the latest handoff, `docs/NEXT_CHAT_HANDOFF.md` wins.

## Git safety rules

Before editing:

```bash
git branch --show-current
git log -1 --oneline
git status --short
```

Preserve all uncommitted work. Never reset, clean, discard, or overwrite it.
Do not commit, push, merge, or switch branch unless the user explicitly requests it.
## Laravel parity rules

- Laravel MASTER is authoritative.
- Multi-language and responsive behavior must match MASTER.
- Use existing Bootstrap Icons / parity assets rather than inventing new visuals.
- Dates shown to users must follow the selected locale.
- Shared visual defects should be fixed globally when the same shared class/component is used.

## Global React UI rules already established

- Generated `FOD` in `.brand-mark` is globally centered in shared `app.css`.
- Admin collapse/expand chevrons are centered in shared `admin-workspace.css`.
- Super Admin back actions use the shared Super Admin header layout.
- Custom branding images still suppress the generated FOD pseudo label.

## Firebase Hosting release policy — mandatory

Every Firebase Hosting deployment must use a new release identity.

Minimum rule:
- **Build MUST change before every Firebase Hosting deploy.**
- Version should also bump for a user-visible release/milestone.
- Never deploy Hosting twice with the exact same Version + Build pair.

Before any Hosting deploy, review/update:
- `react-app/src/components/ParityFooter.jsx`
- `public/assets/js/app-info.js`
- current release note at the top of `README.md`
- active handoff/release documentation when relevant
## Hosting deploy checklist

1. Verify branch / HEAD / status.
2. Decide next Version and Build.
3. Update visible Version/Build metadata.
4. Run tests and build.
5. Verify important routes locally.
6. Deploy Hosting only after release identity changed.
7. Verify deployed Version/Build in the UI.

Recommended checks:

```bash
npm run test:react-foundation
npm run test:react-migration
npm run build:react
git diff --check
```

Use `npm run test:operational` when operational/POS/order logic is touched.

Hosting command:

```bash
npx firebase-tools deploy --only hosting --project chat-45754
```

Functions-only deployments do not require a Hosting Build bump unless Hosting is also deployed.

Do not deploy unrelated Firebase services merely because the working tree is dirty.
