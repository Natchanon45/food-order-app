#!/usr/bin/env node
// One immutable source-of-truth inventory (pinned 7e47e85f) + auditable
// module completion: do NOT equate file presence, LOC or a passing build with
// Source JSX / Firebase action parity.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const inventory=readFileSync(resolve(root,"docs/LUKKAJA_JSX_SOURCE_REBASELINE_20261125.md"),"utf8");
const pages=[...inventory.matchAll(/^\| `([A-Za-z0-9]+\.jsx)` \| ([0-9]+|—) \| ([0-9]+|—) \|/gm)]
 .map(m=>({name:m[1],source:m[2],target:m[3]}));
const sourcePages=pages.filter(p=>p.source!=="—");
const originalTarget=pages.filter(p=>p.target!=="—");
if(sourcePages.length!==65||originalTarget.length!==53)throw Error("PINNED_JSX_INVENTORY_DRIFT");
const accepted=new Map([
 ["PlatformPage.jsx","P1.5 central receiver, disabled live collection rail"],
 ["PlatformPricingPage.jsx","P1.4/P1.5 Premium SaaS pricing and immutable quota"],
 ["PlatformContactPage.jsx","P1.5 Superadmin notification/contact UI"],
 ["AdminTenantsPage.jsx","P1.5 canonical real-wallet history and review"],
 ["AdminPage.jsx","P2.1 Android observer; P2.2 Store Master/branding/QR"],
 ["RegisterPage.jsx","P2.3 Owner signup/verified email/native Firebase"],
 ["LoginPage.jsx","P2.3 login role/next policy"],
 ["AdminSalesReportPage.jsx","P2.4 complete sales history and receipt UI"],
 ["CashierPage.jsx","P3.1 signed Cashier cash/pickup/cancel, Source courier/receipt/Telegram UI; bank/LINE/Stripe live provider settlement gated"],
 ["KitchenPage.jsx","P3.2 signed Kitchen item/status/paid-adjustment audit, Source delivery header/courier lock; external finance review and live provider gated"],
 ["PublicOrderPage.jsx","P3.3 Table QR live session revocation, canonical signed Tenant/menu/table-token/round intake"],
 ["TakeawayPage.jsx","P3.3 live suspended-store gate, canonical menu price, signed idempotent guest queue"],
 ["PublicRouteMissingPage.jsx","P3.3 Source route reviewed, PENGUIN branding retained"],
 ["StorefrontCompatibilityEntry.jsx","P3.3 validated slug, target allowlist, canonical Firebase storefront URL"],
]);
const disposition=new Map([
 ["AdminStoreMasterPage.jsx","Source-only extract not routed: integrated into AdminPage P2.2; no duplicate route"],
]);
const group=name=>{
 if(/^Pos/.test(name))return "POS และ Source-only POS Master";
 if(/^(Cashier|Kitchen|QuickOrder|WaitingQueue)/.test(name))return "Cashier / Kitchen / Queue";
 if(/^(Delivery|Takeaway|PublicOrder|Storefront|PublicRouteMissing)/.test(name))return "Delivery / Public Ordering";
 if(/^(Platform|RevenueShare|HybridBilling|SaasSetup)/.test(name))return "Superadmin / Billing";
 if(/^(CanonicalLaravel|LaravelSession|PortMissingRoute)/.test(name))return "Laravel transport/route wrapper audit";
 return "Merchant Admin / General / Auth";
};
const audited=sourcePages.filter(p=>accepted.has(p.name)).length;
const dispositioned=sourcePages.filter(p=>disposition.has(p.name)).length;
const remaining=sourcePages.length-audited-dispositioned;
const presence=sourcePages.filter(p=>p.target!=="—").length;
const pct=(n)=>((n/65)*100).toFixed(1);
const lines=[
 "# Master Checklist — LUKKAJA → PENGUIN JSX (pinned 2026-11-25)",
 "",
 "## Accounting rules (fixed denominator)",
 "",
 "- **Authoritative JSX Source:** cosmatch/lukkhaja / feature/react-golang-vite-tailwind-axios @ 7e47e85f9012e4b084b68d816b32b6e60b15f3d2.",
 "- **Target:** Natchanon45/food-order-app / feature/react-firebase-port. Source is read-only.",
 "- A page earns **accepted** only after its latest Source behavior is explicitly adapted to Firebase, role/security and scenario contracts are tested, and its module is accepted locally. This is a *conservative page-level acceptance ledger*, not a prediction or arbitrary equivalence to deployed functionality.",
 "- A Source-only page can earn **dispositioned** only when Source routing proves it is an unused extracted wrapper and the equivalent existing target route is accepted. An unreviewed wrapper remains outstanding.",
 "- The target-only native Firebase AccountEmailVerificationPage is a separate necessary implementation and **not** one of the 65 Source pages.",
 "- Commit/Push, local emulator acceptance and Staging/Production acceptance are different states. **Zero** remaining real-provider acceptance gates should be claimed without authorized Staging evidence.",
 "",
 "## Current measurable JSX progress",
 "",
 "| Metric | Verified count | Percent | Meaning |",
 "|---|---:|---:|---|",
 `| Source JSX audited and accepted against latest branch | ${audited}/65 | ${pct(audited)}% | Tested at page/module level, local only |`,
 `| Source-only route extract dispositioned without a duplicate page | ${dispositioned}/65 | ${pct(dispositioned)}% | Existing accepted target Admin UI |`,
 `| **Accepted or explicitly dispositioned** | **${audited+dispositioned}/65** | **${pct(audited+dispositioned)}%** | **Conservative overall Source JSX parity progress** |`,
 `| **Still requires latest-Source acceptance review** | **${remaining}/65** | **${pct(remaining)}%** | Not necessarily absent: old port code/tests already exist |`,
 `| JSX filename already present in Target before rebaseline | ${presence}/65 | ${pct(presence)}% | **Presence only** — never call it functional progress |`,
 "",
 "### Do not misread this %",
 "",
 "The 65-page baseline includes POS/Laravel thin wrappers and legacy transport. The low accepted count does **not** mean those pages have no existing code, tests or business logic. This strict bar prevents the assistant from announcing 80% merely because 52 files share names. The figure will rise when the remaining existing pages are actually audited/accepted, without recreating projects or repeating finished implementations.",
 "",
 "## Exact page-by-page Source ledger",
 "",
 "| Source JSX | Functional area | Target JSX at pinned baseline | Acceptance state | Audit evidence / required next step |",
 "|---|---|---|---|---|",
];
for(const row of sourcePages){
 const state=accepted.has(row.name)?"Accepted (local)":disposition.has(row.name)?"Dispositioned (no new route)":"Pending latest-Source audit";
 const evidence=accepted.get(row.name)||disposition.get(row.name)||
  (row.target==="—"?"Source-only: verify route/wrapper before adding Firebase JSX":"Target exists: validate latest Source actions, security, UI and tests");
 lines.push(`| ${row.name} | ${group(row.name)} | ${row.target==="—"?"Not present":`Present (${row.target} baseline LOC)`} | ${state} | ${evidence} |`);
}
const grouped=Object.groupBy(sourcePages.filter(p=>!accepted.has(p.name)&&!disposition.has(p.name)),p=>group(p.name));
lines.push("","## Remaining work by function group","","| Workstream | Remaining JSX pages | Named pages |","|---|---:|---|");
for(const [area,rows] of Object.entries(grouped))
 lines.push(`| ${area} | ${rows.length} | ${rows.map(x=>x.name.replace(".jsx","")).join(", ")} |`);
lines.push(
 "",
 "## Stage and financial gates (separate from JSX acceptance)",
 "",
 "- **Local only:** P1.4/P1.5, P2.1, P2.2, P2.3 and P2.4 slices tested under demo Firebase Emulators; source adaptation accepted above does not prove complete end-to-end Production behavior.",
 "- **Not enabled as real money:** central bank/LINE LK Connect collection and Stripe LIVE, signed provider webhook/idempotent settlement, bank-backed appeal approvals, provider cash reconciliation and third-party production confirmation.",
 "- **Staging:** a distinct authorized non-production Firebase project, verified email inbox/provider test credentials, release and rollback sign-off are still required.",
 "- **Production:** no deploy, main merge, APK/IPA or real bank payments in these completion receipts.",
 "",
 "## How to update each module",
 "",
 "1. Pin or verify Source HEAD, then compare changed JSX and Data/backend behavior.",
 "2. Add only verified page entries to the audited mapping above; source-only wrappers need explicit router evidence before being dispositioned.",
 "3. Run read/write, RBAC, data-completeness, responsive UI and all relevant financial test gates.",
 "4. Regenerate this document via `node tools/update-port-master-checklist.mjs`; report accepted/65, remaining/65 and % after Commit/Push.",
 "5. Keep outstanding financial Staging/Production gates separate from page-parity %.",
 "");
const destination=resolve(root,"docs/LUKKAJA_TO_PENGUIN_MASTER_CHECKLIST_20261125.md");
writeFileSync(destination,lines.join("\n"));
console.log(JSON.stringify({source:sourcePages.length,shared:presence,accepted:audited,
 dispositioned,done:audited+dispositioned,remaining,percentComplete:pct(audited+dispositioned),
 percentRemaining:pct(remaining),groups:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.length]))}));
