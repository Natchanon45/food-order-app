"use strict";
// P1.3 Final Audit: Firebase Admin SDK bypasses client Firestore/Storage rules.
// Every v2 HTTPS Callable enters through this module; managed, unverified
// Owner/Staff are denied BEFORE any handler reads or mutates business state.
//
// This is an opt-in rollout: user profiles without emailVerificationRequired
// remain unchanged. Public and customer sessions have no managed user profile.
const https = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const {HttpsError} = https;

async function assertManagedEmailVerified(request, {db} = {}) {
  const uid = String(request?.auth?.uid || "");
  if (!uid) return; // Preserve per-handler public/unauthenticated policy.
  // Signed Firebase Auth ID token: only a native provider-verification claim,
  // never a client-supplied Firestore flag, can enable the account.
  if (request.auth?.token?.email_verified === true) return;
  // For unverified identities only: read the canonical opt-in marker.
  // A lookup failure must fail closed; no assumed legacy status on error.
  let snap;
  try {
    snap = await (db || getFirestore()).collection("users").doc(uid).get();
  } catch (_) {
    throw new HttpsError("unavailable","MANAGED_EMAIL_VERIFICATION_CHECK_UNAVAILABLE");
  }
  if (snap.exists && snap.data()?.emailVerificationRequired === true) {
    throw new HttpsError("permission-denied","MANAGED_EMAIL_VERIFICATION_REQUIRED");
  }
}

function onCall(options, callback) {
  const handler = typeof options === "function" ? options : callback;
  if (typeof handler !== "function") throw new TypeError("CALLABLE_HANDLER_REQUIRED");
  const guarded = async (request, ...rest) => {
    await assertManagedEmailVerified(request);
    return handler(request,...rest);
  };
  return typeof options === "function"
    ? https.onCall(guarded)
    : https.onCall(options,guarded);
}

module.exports = {...https,onCall,assertManagedEmailVerified};
