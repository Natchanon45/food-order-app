# UI Layer Policy

This policy is mandatory for Laravel MASTER and the React/Firebase migration.

## Required stacking order

From highest to lowest:

1. **Toast alert**
2. **SweetAlert / shared confirmation dialog**
3. **Modal / native `<dialog>` / drawer-style modal**
4. **Page UI, loading overlays, menus, and normal content**

A Toast alert must never be covered by a SweetAlert, modal, native dialog, loading overlay, menu, or page content.

## Shared layer tokens

Do not invent page-specific z-index values for these three application layers.

- `--ui-layer-toast-z` — Toast only; highest application layer.
- `--ui-layer-dialog-z` — SweetAlert / shared confirmation layer.
- `--ui-layer-modal-z` — Modal / native dialog / modal backdrop layer.

The canonical definitions live in:

- Laravel MASTER: `public/assets/css/ui-layer-stack.css`
- React parity copy: `react-app/public/parity/css/ui-layer-stack.css`

The React copy must be generated from Laravel MASTER through `tools/sync-react-parity-assets.py`.

## Browser Top Layer rule

A native `<dialog>.showModal()` is placed in the browser Top Layer. A normal element cannot reliably beat it with z-index alone.

Therefore `toast-top-layer.js` is mandatory globally. Whenever a modal/dialog changes, it restores layer order in this sequence:

1. detect the topmost native modal dialog;
2. mount the active Sweet Dialog and visible Toast inside that modal host when one exists;
3. promote Sweet Dialog first;
4. promote Toast last.

This is required because Chromium can keep a native modal above a body-level popover even when that popover is open. The modal-host step plus promotion order guarantees:

`Toast > Sweet Dialog > Modal`

even when the modal was opened after the Toast or Sweet Dialog.

## Implementation rules

- New Toasts must use `.app-toast`, `.toast`, `[data-app-toast]`, or `[data-ui-layer="toast"]`.
- Shared confirmation/alert UI must use `.sweet-dialog-backdrop` or `[data-ui-layer="dialog"]`.
- Custom modal roots may use `[data-ui-layer="modal"]`.
- Do not assign a modal/dialog a z-index equal to or greater than the Toast layer.
- Sweet Dialogs and Toasts promoted with `popover="manual"` must reset browser UA popover framing. A promoted Sweet backdrop must remain full-viewport with no browser-added border, outline, auto margin, or fit-content sizing.
- Do not use a new hard-coded maximum z-index to solve a local screen issue.
- If a component uses native `showModal()`, do not bypass the global layer manager.
- Page-specific CSS may style size, position, animation, and backdrop, but must not reverse the global layer order.
- Any future layer change must update both the layer contract test and this policy.

## Regression requirement

The UI layer contract and browser smoke test must continue to prove:

- numeric layer tokens satisfy `toast > dialog > modal`;
- React and Laravel load the shared layer stylesheet and Top Layer manager;
- a Toast remains visually above Sweet Dialog while a native modal is open.
