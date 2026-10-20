import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {SHARDS,shardOf}=require("../../functions/hybrid-billing-receipt-journal.js");
test("journal uses 16 deterministic shards and rejects path traversal",()=>{
 assert.equal(SHARDS,16);
 const ids=Array.from({length:150},(_,n)=>shardOf("order-shard-"+String(n).padStart(4,"0")));
 assert.equal(new Set(ids).size,16);
 assert.equal(shardOf("order-shard-0001"),shardOf("order-shard-0001"));
 assert.throws(()=>shardOf("../../foo"),/HYBRID_JOURNAL_BAD_ORDER/);
});
test("COD journal and strict read fence remain source-only and disabled in production",()=>{
 const index=readFileSync("functions/index.js","utf8");
 const ledger=readFileSync("functions/hybrid-billing-ledger.js","utf8");
 const cod=readFileSync("functions/hybrid-billing-cod-payment.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-receipt-journal|hybrid-billing-cod-payment/);
 assert.match(ledger,/hybridReceiptJournalCoverageReady !== true/);
 assert.match(cod,/prepareCodReceiptJournal/);
});
