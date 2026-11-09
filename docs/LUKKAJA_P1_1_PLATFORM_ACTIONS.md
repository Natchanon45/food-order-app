# Phase P1.1 — /platform interaction and scenario inventory

Snapshot: LUKKAJA `e84c8990` / PENGUIN baseline `d87fc375`. Readiness adaptation in PENGUIN `PlatformPage.jsx` starts at `4bbdaa6a`. This is a **first-slice inventory**, not a signed browser/visual acceptance.

## Visible action groups — source JSX reviewed

| ID | Original UI | Action or input | Firebase implementation / scope | Not yet tested |
|---|---|---|---|---|
| NAV-01 | จัดการร้านค้า | navigate `/admin/tenants` | Existing route, PENGUIN notification badge preserved | authenticated navigation |
| NAV-02 | บัญชีเจ้าของร้าน | navigate `/platform/owners` | Existing route | authenticated navigation |
| NAV-03 | ช่องทางติดต่อผู้เยี่ยมชม | navigate `/platform/contact` | Existing route | authenticated navigation |
| NAV-04 | ราคาแพ็กเกจ | navigate `/platform/pricing` | Existing route | authenticated navigation |
| NAV-05 | Header language | select locale | Existing `LocaleSwitcher` | five-locale visual |
| NAV-06 | Header account | open user menu/log out | Existing `UserMenu` | auth state transitions |
| BRAND-01 | Logo, favicon, app icon | choose file, MIME/size and app-icon square validation | client preview + Firebase Storage upload in `platformBrandingService` | live upload/browser |
| BRAND-02 | Logo, favicon, app icon | clear selected/previous asset | `savePlatformBranding`, server-admin Callable, optional old blob cleanup | clear/rollback |
| BRAND-03 | Branding Save | save 3 assets, show toast/preview | `updatePlatformBranding` after read success | storage denied + duplicate |
| MAP-01 | Maps browser key | enter/clear key | `platformSettingsService` + `updatePlatformGoogleApis` | permissions + stale key |
| MAP-02 | Routes API key | enter/clear key | same | permissions |
| MAP-03 | Vision API key | enter/clear key | same | permissions |
| MAP-04 | API Save | send partial masked/clear secrets | admin Callable after successful settings read | read failure + invalid input |
| SLIP-01 | Provider/URL/secret | choose provider, URL, replace/clear secret | `get/updatePlatformSlipVerification` | invalid URL/secret |
| SLIP-02 | Receiver bank | search/select paginated bank | `PlatformReceiverBankSelect`, 35 bank codes | keyboard/mobile |
| SLIP-03 | Beneficiary | edit Thai/English names and account number | same Callable; private platform settings | invalid account |
| SLIP-04 | Test Slip service | test installed provider, show quota/failure | `testPlatformSlipVerification` Callable | provider outage/rejection |
| SLIP-05 | Save Slip settings | save provider/beneficiary | `updatePlatformSlipVerification` Callable | revoked admin/read failed |
| LALA-01 | Environment/credentials | select sandbox/prod, edit/clear API key/secret | `updatePlatformLalamove` Callable | mismatch/no data |
| LALA-02 | Webhook URL/Register | register on HTTPS site only | `registerPlatformLalamoveWebhook` Callable | wrong URL/missing permission |
| LALA-03 | Test connection | source first saves settings, then tests provider | `savePlatformLalamove` → `testPlatformLalamove` | provider failure/non-idempotent |
| LALA-04 | Save settings | write configured options | `updatePlatformLalamove` Callable | transient outage/retry |

**22 action families inventoried** (6 navigation + 3 branding + 4 Google + 5 slip + 4 Lalamove). This is a **grouped inventory**, not a count of individual DOM buttons; multi-asset and multi-input groups expand to more test cases. Source contains the four forms `platformBrandingForm`, `platformGoogleApiForm`, `platformSlipVerificationForm`, `platformLalamoveForm`. The previously owner-hidden Hybrid invoice review link remains hidden despite the route still existing.

## Four implementation pseudocode families (P1.1 current scope)

```text
PSEUDO-01 Load secure settings:
  if auth is not resolved or profile.role != super_admin: block actions
  fetch brand, google, slip and lalamove using authenticated Firebase callables
  for each:
    set readReady = false before loading; loading = true
    if callable returns an object item: apply fields, readReady = true, error = false
    else: readReady = false; error = true; display localized load failure
    loading = false
  do NOT infer readiness from LUKKAJA Go item.storageReady on Firebase
PSEUDO-02 Mutate settings:
  on Save: preventDefault; require ready auth+role+successful original read+not loading
  copy only submitted/clear fields into the existing Firebase Callable
  server enforces super_admin; on success update UI; on failure show localized error
  NEVER use raw browser Firestore write of secrets
PSEUDO-03 Test provider:
  require auth+role+initial read+not already testing
  call only explicitly clicked TEST, display real success/failure data
  never classify a tested connection as payment approved or create a bill
PSEUDO-04 Upload/clear branding:
  validate correct media size/MIME and PWA icon dimensions
  stage temporary preview for the selected asset
  on explicit Save upload new blob through authorized Storage path, call backend
  on failure cleanup newly uploaded blob and preserve committed old asset
```

## Minimum 18 scenario checks to expand into browser/emulator acceptance

| ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| S01 | Anonymous opens /platform | login redirect; no sensitive content | pending browser |
| S02 | Cashier/owner opens /platform | forbidden/redirect; no callable write | pending browser |
| S03 | Auth profile fetch fails | localized alert, not an anonymous redirect | UI guard contract checked; browser pending |
| S04 | Brand settings read fails | upload, clear, Save disabled | UI contract checked |
| S05 | Google settings read fails | key fields/clear/Save disabled | UI contract checked |
| S06 | Slip settings read fails | provider, bank, Test/Save disabled | UI contract checked |
| S07 | Lalamove settings read fails | environment, Test, webhook, Save disabled | UI contract checked |
| S08 | Authenticated reads return malformed data | fail-closed without saving empty defaults | UI contract checked |
| S09 | Loaded settings have no prior keys | editable; show Not configured, do not invent keys | pending runtime |
| S10 | Brand invalid MIME/large file | reject and keep previously saved asset | pending browser |
| S11 | PWA icon non-square/too small | reject preview and avoid Storage write | pending browser |
| S12 | Branding Storage upload denied | old saved paths remain; show error | pending emulator |
| S13 | Google key cleared explicitly | only requested setting is cleared | pending emulator |
| S14 | Slip URL invalid | server rejects, inline error/toast, no key disclosure | pending emulator |
| S15 | Slip provider outage | technical failure displayed, no payment approval | pending mock provider |
| S16 | Bank combobox keyboard/navigation | selected bank code persists; account data scoped | pending browser |
| S17 | Lalamove provider mismatch | failure shown, no false Connected status | pending mock provider |
| S18 | Webhook on localhost or HTTP | register refused; no provider call | pending browser |

**Status:** The 4 pseudocode families and 22 grouped action families are documented. 18 scenarios listed; runtime/browser/Emulator checks remain pending where indicated. Do not promote P1.1 to verified based solely on source matches or a Vite build.
