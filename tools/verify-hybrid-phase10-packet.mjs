// Offline Phase 10 checksum-only inspection (NO external bank provenance).
// No Firebase or network connection; never treats a packet as payout proof.
import fs from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const { verifyDemoHybridPhase10ReviewPacket } =
  require("./hybrid-billing-phase10-review-packet.js");
if (process.argv.length!==3 || process.argv[2].startsWith("-")) {
  throw Error("HYBRID_PHASE10_PACKET_VERIFY_EXPECT_ONE_LOCAL_FILE");
}
const filename=process.argv[2];
const meta=fs.statSync(filename,{throwIfNoEntry:true});
if (!meta?.isFile() || meta.size<100 || meta.size>131072) {
  throw Error("HYBRID_PHASE10_PACKET_VERIFY_FILE_SIZE_INVALID");
}
let packet;
try { packet=JSON.parse(fs.readFileSync(filename,"utf8")); }
catch { throw Error("HYBRID_PHASE10_PACKET_VERIFY_INVALID_JSON"); }
const evidence=verifyDemoHybridPhase10ReviewPacket(packet);
// Do not output the file, raw account, signer, receipt, or user-supplied notes.
process.stdout.write(JSON.stringify({
  status:"checksum_consistent_only",
  checksumSha256:evidence.checksumSha256,
  independentlyAuthenticated:false,
  bankStatementSourceAuthenticated:false,
  bankPayoutConfirmed:false,
  settlementAllowed:false,
  productionReleaseAllowed:false,
},null,2)+"\n");
// Even successful checksum consistency MUST be a nonzero release result.
process.exitCode=2;
