/** Real HTTP upload bytes only. 100% is reserved for a completed HTTP upload,
 * not bank verification, so the browser cannot imply a paid order. */
export function slipUploadPercent(event) {
  const loaded = Number(event?.loaded);
  const total = Number(event?.total);
  if (!Number.isFinite(loaded) || !Number.isFinite(total) || loaded < 0 || total <= 0) return null;
  return Math.min(99, Math.max(0, Math.floor(loaded / total * 100)));
}

export function isSupportedRetrySlip(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 1 || file.size > 8 * 1024 * 1024) return false;
  return /^image\/(jpeg|png|webp|heic|heif)$/i.test(String(file.type || ""))
    || (!file.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(String(file.name || "")));
}

/** Show a genuine completed upload for at least 9 seconds from file choice.
 * This does not throttle the HTTP request or claim bank verification. */
export function slipUploadDisplayHoldMs(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 9000;
  return Math.max(0, 9000 - Math.max(0, now - startedAt));
}

/** Deliberately paced display of actual observed bytes over nine seconds.
 * Never shows more progress than the HTTP client has sent. The display can
 * lag the network, but cannot reach 100 before server staging confirmation.
 * This is a VISUAL animation, not the true instantaneous network rate. */
export function slipUploadAnimatedPercent(observedPercent, elapsedMs, durationMs = 9000) {
  const observed = Number(observedPercent);
  const elapsed = Number(elapsedMs);
  if (!Number.isFinite(observed) || !Number.isFinite(elapsed) || elapsed <= 0) return 0;
  const visual = Math.floor(Math.max(0, Math.min(1, elapsed / durationMs)) * 99);
  return Math.min(99, Math.max(0, Math.floor(observed)), visual);
}
