// Offline Phase 10 checksum-only inspection (NO external bank provenance).
// No Firebase or network connection; never treats a packet as payout proof.
import fs from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const { verifyDemoHybridPhase10ReviewPacket } =
  require("./hybrid-billing-phase10-review-packet.js");
const args=process.argv.slice(2);
if ((args.length!==1 && args.length!==2)
  || !args[0] || args[0].startsWith("-")
  || (args.length===2
    && !/^--expected-sha256=[a-f0-9]{64}$/.test(args[1]))) {
  throw Error("HYBRID_PHASE10_PACKET_VERIFY_EXPECT_FILE_AND_OPTIONAL_PIN");
}
const filename=args[0];
// The optional SHA-256 must have been independently retained at export.
// Never derive this pin from the untrusted file being reviewed.
const expectedSha256=args[1]?.slice("--expected-sha256=".length) ?? null;
const meta=fs.statSync(filename,{throwIfNoEntry:true});
if (!meta?.isFile() || meta.size<100 || meta.size>131072) {
  throw Error("HYBRID_PHASE10_PACKET_VERIFY_FILE_SIZE_INVALID");
}
let packet;
try { packet=JSON.parse(fs.readFileSync(filename,"utf8")); }
catch { throw Error("HYBRID_PHASE10_PACKET_VERIFY_INVALID_JSON"); }
const evidence=verifyDemoHybridPhase10ReviewPacket(packet);
if (expectedSha256!==null && evidence.checksumSha256!==expectedSha256) {
  throw Error("HYBRID_PHASE10_PACKET_VERIFY_PIN_MISMATCH");
}
// Do not output the file, raw account, signer, receipt, or user-supplied notes.
process.stdout.write(JSON.stringify({
  status:"checksum_consistent_only",
  checksumSha256:evidence.checksumSha256,
  ownerSuppliedChecksumMatched:expectedSha256!==null,
  independentlyAuthenticated:false,
  bankStatementSourceAuthenticated:false,
  bankPayoutConfirmed:false,
  settlementAllowed:false,
  productionReleaseAllowed:false,
},null,2)+"\n");
// Even successful checksum consistency MUST be a nonzero release result.
process.exitCode=2;
