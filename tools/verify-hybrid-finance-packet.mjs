// Offline content-integrity-only verifier. Does not access Firebase, bank,
// wallets or the internet. "Valid checksum" NEVER authorizes actual refunds.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { verifyDemoHybridFinanceReviewPacket } =
  require("./hybrid-billing-finance-review-packet.js");

if (process.argv.length !== 3 || process.argv[2].startsWith("-")) {
  throw new Error("HYBRID_PACKET_VERIFY_REQUIRES_ONE_LOCAL_JSON_FILE");
}
const filename = process.argv[2];
const size = fs.statSync(filename, { throwIfNoEntry: true });
if (!size?.isFile() || size.size < 100 || size.size > 131072) {
  throw new Error("HYBRID_PACKET_VERIFY_FILE_SIZE_INVALID");
}
let input;
try {
  input = JSON.parse(fs.readFileSync(filename, "utf8"));
} catch {
  throw new Error("HYBRID_PACKET_VERIFY_JSON_INVALID");
}
const result = verifyDemoHybridFinanceReviewPacket(input);
// Intentionally never echo the file, paths, user inputs, account or notes.
process.stdout.write(JSON.stringify({
  status: "checksum_consistent_only",
  checksumSha256: result.checksumSha256,
  independentlyAuthenticated: false,
  bankPaymentConfirmed: false,
  settlementAllowed: false,
  releaseReady: false,
}, null, 2) + "\n");
// Exit 2 even on consistent packet: external bank settlement remains blocked.
process.exitCode = 2;
