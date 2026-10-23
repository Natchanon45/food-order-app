# Billing anniversaries and IconPacks design plan — 2026-10-23

Branch: `feature/react-firebase-port`. GitHub code changes only; not deployed.

## Confirmed billing requirement

Stores can become active on the 5th, 8th, 11th, 15th, 16th, 22nd, or
any other date. A monthly billing cycle is a half-open Bangkok-local interval
`[activation anniversary, next month's same-date anniversary)`.
For example, a 22 October start means 22 October 00:00 Bangkok through
21 November 23:59:59.999. The **next** cycle starts 22 November.

- `billingCycleAnchorAt` (explicit, stable) takes priority; otherwise the
  tenant's actual activation `trialStartsAt`, `activatedAt` or `createdAt`
  from the server is used. The pending signup request date is never an anchor.
- On days 29–31, clamp to the final date of a shorter month **for that
  month only**, always calculating from the original activation day.
  Example 31 Jan → 28 Feb → 31 Mar in 2026; leap year uses 29 Feb.
- Paid Delivery merchandise (excluding shipping, POS and refunded merchandise)
  accumulates and resets each tenant cycle, not at calendar month boundaries.
- Daily reports keep a single Bangkok day. Monthly reports select the cycle
  beginning in the chosen month. Custom/yearly reports remain filters, but
  share eligibility still uses the correct underlying tenant cycles.
- Wallet/Lalamove delivery debits are prepaid and never a Platform
  revenue-share receivable.
- Hybrid `hybrid_v1` (currently **read-only and disabled for registration**)
  uses the same anniversary range in its preview. Original calendar-month
  calculator remains as a compatibility wrapper for legacy tests.
- A prior cycle's verified payment and unpaid balance must not be lost when
  the next cycle opens.

## Production cutover / migration safety

Historical legacy revenue-share tenants may already have payment records keyed
to calendar months. Changing their dates without a migration would risk
overlapping invoices and false suspensions.

The new `reconcileTenant` code **does not automatically suspend** a legacy
tenant based on an anniversary cycle unless
`billingAnniversaryEffectiveAt` is explicitly established. The field must
be an authorized, audited server-side cutover instant after past invoices,
statuses and existing locks have been reconciled. It is intentionally NOT
automatically set for existing tenants by this code. Any already-suspended
legacy tenant retains existing review/unlock controls.

Before enabling production enforcement:
1. Export an audited inventory of tenant `createdAt`/`trialStartsAt`,
   prior billing cycles, payments and suspension flags (read-only).
2. Choose a clean future anniversary boundary for each existing tenant;
   preserve paid/rejected/pending old invoices and never collect overlap twice.
3. Write canonical `billingCycleAnchorAt` and
   `billingAnniversaryEffectiveAt` in an audited, reversible administrator
   migration. Do not overwrite `createdAt` or existing financial ledger.
4. Compare month-based and anniversary-based calculations on staging data.
5. Run the test suite and UAT for day 5/8/11/15/16/22/29/30/31,
   short months, December–January, refunds, repeated retries, daily/monthly
   slip submissions and overdue/approved/unlock.
6. Only then deploy the affected callable/scheduled Functions and Hosting.

The live database was not examined; no tenant records were migrated, no
wallets or payments changed, and no production deployment was performed.
The legacy scheduler guard prevents accidental new anniversary suspensions
until tenant-level cutover is explicitly approved.

## IconPacks (design phase only; no UI replacement yet)

Source: https://www.iconpacks.net/motorcycle-icons.html
Terms: https://www.iconpacks.net/terms/

Per published terms (verified 2026-10-23):
- Free SVG/PNG icons can be used and modified in commercial sites/apps
  without attribution.
- Do not redistribute or resell the icons as standalone icon collections,
  sublicense them as-is, or build a competing icon service.
- Brand logos/trademarks require separate care.
- Do not bulk scrape the catalog; manually choose and download the minimal
  icons needed for this application.

Recommended adoption:
1. Start with three prototype replacement icons, e.g. rider-on-scooter
   for **Delivery**, store icon for in-store service, and a takeaway bag
   for pickup. Review style consistency and legibility with current
   Penguin mint/green/blue design.
2. Download individually selected, permitted **SVGs** from IconPacks;
   sanitize SVG markup and store only necessary files under
   `react-app/public/parity/icons/iconpacks/` and let the Vite
   build copy assets. Do not embed unrelated external SVG scripts or
   live hotlinks.
3. Create a single reusable mapping component (a11y title/aria-hidden,
   CSS size/currentColor handling where supported), and standard
   20/24/32px sizes. Multicolor art should not be recolored blindly.
4. Replace first the current `bi bi-scooter` Delivery icon on the
   revenue-share report and compare 320/390/768/1280px PC/mobile.
5. Keep Bootstrap Icons for ordinary actions (back/refresh/close),
   until each new illustrated concept has an approved match. Add
   attribution references for provenance even though display credit
   is not mandated.

No external icons were downloaded or added to the repository.

## Read-only production inventory (2026-10-23)

Added a bounded **read-only** Firestore audit tool. It does not modify Tenant records,
slips, Wallet balances, subscriptions, Hosting, Functions, or billing cutover fields.

Use authorized Google Application Default Credentials with Firestore read permission.
From the feature branch, ensure functions dependencies are installed and run:

```bash
npm run test:billing-anniversary-audit
node tools/audit-billing-anniversary.mjs \
  --project chat-45754 \
  --out "$HOME/Desktop/billing-anniversary-audit-$(date +%Y%m%d-%H%M%S).json" \
  --max-tenants 500 --payments-limit 200
```

Report JSON is saved **only on the authorized local Mac** with 0600 permissions,
outside the repository. It includes tenant IDs and historical financial metadata:
do NOT commit it, upload it, or paste the full report into public chats.
The tool prints only aggregate counts and flags overlapping historical
payments, unconfirmed anchors, pending review, suspension, and capped scans.
A bounded scan is **not** evidence that older payment records do not exist.
Run `--tenant TENANT_ID` to inspect one store with the same read-only behavior.

Running the inventory is **not approval to migrate**; it never sets
`billingCycleAnchorAt` or `billingAnniversaryEffectiveAt`, never rewrites
invoices, and never issues payments. Existing calendar billing cutovers
require a separate reviewed finance decision. Do not deploy billing Functions
or Hosting until the specific tenant migration risks are resolved.

## Cutover proposal — audited dry run, no writes (2026-10-23)

Added `tools/billing-anniversary-cutover-plan-core.mjs` and
`tools/plan-billing-anniversary-cutover.mjs`, with a regression suite.
The planner consumes **only** a prior local read-only inventory JSON,
does not connect to Firestore, and generates an advisory JSON outside the
Git repository with private 0600 permissions and no overwrite.

Use the report generated on 2026-10-23:

```bash
npm run test:billing-anniversary-audit
node tools/plan-billing-anniversary-cutover.mjs \
  --audit "$HOME/Desktop/billing-anniversary-audit-20261023-191156.json" \
  --out "$HOME/Desktop/billing-cutover-dry-run-$(date +%Y%m%d-%H%M%S).json"
```

**Expected anonymous classification from 2026-10-23 audit:**

| Example | Existing billing type | Next anniversary candidate | Review state |
|---|---|---|---|
| SHOP_1 | Revenue share, daily slips | 2026-11-21 | Pending explicit manual approval (not production-ready) |
| SHOP_2 | Unverified legacy Premium, suspended | 2026-11-04 | Blocked; preserve suspension and annual expiry |
| SHOP_3 | Unverified legacy Premium, active | 2026-11-22 | Blocked; verify implicit billingMode, monthly membership entitlements |

Do not infer a shop is eligible solely because `revenueSharePayments` is
empty. The audit does not prove absence of Premium membership history.
At the time of cutover, refresh the audit and review new invoices created
after this snapshot. Inventories older than seven days or with truncated
data are automatically blocked in the dry-run planner.

**Billing policy safety correction:** `revenue-share.js` now uses the
original calendar-month threshold and settlement periods before
`billingAnniversaryEffectiveAt`. For eligible paid Delivery sales **from**
the approved cutover date, `eligibleDeliveryShareDays()` switches buckets
to the activation anniversary cycle and resets its cumulative threshold.
Daily `revenueShareBillingCycle` remains daily throughout. Before cutover,
existing legacy monthly settlement enforcement continues according to
its prior rules, rather than being silently suspended just because an
activation timestamp exists. After cutover, no unfinished or pre-cutover
anniversary cycle can be collected as a new monthly invoice.

Production go/no-go remains **NO-GO** until source review, billing
entitlement review, finance cutover authorization, a separate audited
data migration and staging/UAT are complete. This work never overwrites
`subscriptionExpiresAt`, `planCode`, `subscriptionStatus`,
`revenueShareSuspended`, Wallet entries or any paid invoice.
