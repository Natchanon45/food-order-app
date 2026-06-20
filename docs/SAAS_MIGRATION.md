# Food Order SaaS Migration

Branch: `saas-development`

## Goal

Convert the current single-store application into a multi-store SaaS while keeping the existing Firebase project during development.

## Data model

```text
shops/{shopId}
shops/{shopId}/menus/{menuId}
shops/{shopId}/tables/{tableId}
shops/{shopId}/orders/{orderId}
shops/{shopId}/staff/{userId}
shops/{shopId}/settings/store

users/{userId}
subscriptions/{shopId}
```

## User roles

- `super_admin`: platform owner
- `shop_owner`: owns one or more shops
- `admin`: manages one shop
- `cashier`: cashier access for one shop
- `kitchen`: kitchen access for one shop

Each user membership must include a `shopId` and role.

## URL strategy

Public customer pages use a shop slug:

```text
/s/{shopSlug}/order/?table=A01
/s/{shopSlug}/delivery/
```

Back-office pages resolve the active shop from the authenticated user's membership.

## Migration phases

### Phase 1 — Tenant foundation

- Add shop context resolver
- Add shop path helpers
- Add `shopId`/`shopSlug` support
- Keep current single-store paths as a temporary fallback

### Phase 2 — Move store data

- Create a default shop document
- Copy current menus, tables, orders and settings under the default shop
- Switch reads and writes to shop-scoped paths

### Phase 3 — Security

- Update Firestore Rules to block cross-shop access
- Update Storage paths to include `shopId`
- Add staff memberships per shop

### Phase 4 — Onboarding

- Shop registration
- Store setup wizard
- Invite staff
- Generate first tables and QR codes

### Phase 5 — Subscription

- Plans and feature limits
- Trial period
- Subscription status
- Platform owner dashboard

## Development policy

- `main` remains the stable single-store version until the SaaS branch is ready.
- `saas-development` may use the current Firebase project because there are no production customers yet.
- Do not merge SaaS changes into `main` until migration and security tests pass.
