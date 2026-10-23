// Never run against a Production Firebase App. Only a guarded demo project,
// using the separate Emulator-only Callable names, may upload synthetic proof.
import { httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { firebaseConfig, functions, storage, isHybridDemoMode } from "@/firebase/client";
import { submitDemoHybridEvidence } from "./hybridDemoProofTransport.js";

const DEMO_ENDPOINTS = Object.freeze({
  prepare: "demoHybridPrepareUpload", submit: "demoHybridSubmitProof",
});

export async function submitHybridDemoProof({ tenantId, invoice, file, isCurrent, onStep }) {
  if (!isHybridDemoMode || firebaseConfig.projectId !== "demo-penguin-hybrid") {
    throw new Error("HYBRID_DEMO_ONLY_LOCAL_EMULATOR");
  }
  return submitDemoHybridEvidence({
    runtime: {
      dev: import.meta.env.DEV === true,
      emulatorFlag: import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true",
      demoFlag: import.meta.env.VITE_HYBRID_DEMO_PAYMENT_E2E === "true",
      projectId: firebaseConfig.projectId,
    },
    tenantId, invoice, file, isCurrent, onStep,
    requestGrant: async input => {
      const result = await httpsCallable(functions, DEMO_ENDPOINTS.prepare)(input);
      return result.data;
    },
    uploadEvidence: async ({ slipPath, file: bytes }) => {
      await uploadBytes(storageRef(storage, slipPath), bytes, {
        contentType: bytes.type,
      });
    },
    submitProof: async input => {
      const result = await httpsCallable(functions, DEMO_ENDPOINTS.submit)(input);
      return result.data;
    },
  });
}
