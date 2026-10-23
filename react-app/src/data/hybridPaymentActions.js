// Phase 7 review UX is a deliberately non-operational preview.
// Do not reference an unregistered Firebase Callable from the React bundle:
// tools/react-callable-contract.mjs requires every client Callable to be
// exported by functions/index.js, whereas this write endpoint is not released.
//
// Releasing payments requires a separately reviewed change that registers
// the server Callable, passes live Functions Emulator UAT and updates this
// adapter and its independent UI/server gates together.
export const HYBRID_PAYMENT_UI_READY = false;

export async function reviewHybridPayment() {
  if (!HYBRID_PAYMENT_UI_READY) {
    throw new Error("HYBRID_PAYMENT_NOT_RELEASED");
  }
  // A future UI switch must never silently enable a missing/misrouted API.
  throw new Error("HYBRID_PAYMENT_CALLABLE_UNREGISTERED");
}
