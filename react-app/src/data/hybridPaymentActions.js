import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

// The server also has HYBRID_PAYMENT_CALLABLE_READY = false.
// Never allow the client to enable money movement from user settings.
export const HYBRID_PAYMENT_UI_READY = false;

function assertReady() {
  if (!HYBRID_PAYMENT_UI_READY) {
    throw new Error("HYBRID_PAYMENT_NOT_RELEASED");
  }
}
export async function reviewHybridPayment({
  tenantId, invoiceId, attemptId, action,
  note, verifiedExternally = false,
}) {
  assertReady();
  // Only these identifiers, action and reviewer note travel to the server.
  // Amount, bank beneficiary, paid status and reviewer identity must come
  // from the trusted Admin SDK and authenticated Firebase session.
  const callable = httpsCallable(functions, "reviewHybridInvoicePaymentProof");
  const result = await callable({
    tenantId, invoiceId, attemptId, action, note, verifiedExternally,
  });
  return result.data;
}
