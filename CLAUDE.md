# FreshOpsPlatform — Project Context for Claude Code

This file provides context for AI-assisted development sessions.
Read it fully before making any changes to this codebase.

---

## What this project is

FreshOpsPlatform is an open-source warehouse management system for
fresh food and cold chain operators in emerging markets. AGPL-3.0
licensed. Built to be white-label and operator-agnostic — no
hardcoded business names, warehouse IDs, or asset types anywhere
in business logic (only in demo seed data which is clearly labelled).

GitHub: https://github.com/mj-001/freshops-platform

---

## Stack

- **Backend:** Node.js + Express + TypeScript (`server.ts`, single file)
- **Frontend:** React + Vite + Tailwind CSS (`src/` directory)
- **Storage:** JSON file (dev) → Firestore (production) via adapter pattern
- **Auth:** Homegrown scrypt password hashing (planned: Firebase Auth)
- **Docker:** Working `Dockerfile` + `docker-compose.yml`, confirmed running

---

## Architecture decisions — do not change without understanding these

### 1. Single server.ts file
All 166+ API endpoints live in one `server.ts` file. This is
intentional for the current phase. Do not split into separate
route files without a deliberate decision to do so.

### 2. Adapter pattern for storage
`src/adapters/DatabaseAdapter.ts` defines the interface.
`src/adapters/JsonFileAdapter.ts` is the working dev implementation.
`src/adapters/FirestoreAdapter.ts` is the production implementation.
`DATABASE_ADAPTER` env var selects which one runs. Never hardcode
a specific adapter in business logic.

### 3. Append-only stock ledger — TLA+ verified
`db.stock_ledger` (and in Firestore, the `stock_ledger` collection)
is APPEND-ONLY. Never update or delete ledger entries. This is one
of five formally verified invariants (TLA+/TLC model checking). The
other four are: FEFO pick correctness, assembly completion atomicity,
FPO receiving integrity, bundle resolution correctness.

### 4. Self-approval guards — everywhere
Every approval flow (cycle counts, write-offs, transfers, workflow
approvals, assembly templates, markdowns) has a guard preventing
the creator from approving their own submission. Do not remove
these guards. Check for them before modifying any approval endpoint.

### 5. Deny-by-default navigation for custom-role users
Users with `custom_role_id` set see ONLY nav items explicitly
mapped in `NAV_PERMISSION_MAP` in `App.tsx`. Any nav item not in
the map is hidden, not shown. This is intentional security design.
The `return false` in `userHasPermission()` for unmapped items
must never be changed to `return true`.

### 6. Password security
Login returns identical error messages for "email not found" and
"wrong password" — this prevents account enumeration. Do not make
these messages more specific. Password hashing uses Node's built-in
`crypto.scrypt` with timing-safe comparison.

### 7. No self-service password reset
There is no "forgot password" flow. It was built and immediately
removed because it created an account takeover vulnerability
(token returned in API response). Any future forgot-password
implementation requires real email delivery first. Do not re-add
a simulated/token-in-response version.

### 8. Product codes are auto-generated
`POST /api/v1/skus` generates the product code server-side from
`{category.numeric_code × 1000 + sequence}`. Users never supply
a `code` field. The old `CODE_EXISTS` check was removed because
structural impossibility replaced it.

### 9. WorkflowApproval engine
Generic multi-stage approval system in `db.workflow_approvals`.
Stage templates in `db.workflow_templates`. The special value
`'REPORTS_TO_CREATOR'` in `required_user_id` resolves at runtime
to the workflow creator's line manager via `User.reports_to_user_id`.
`handleWorkflowCompletion()` in server.ts dispatches post-approval
side effects by workflow type.

### 10. PriceHistory retroactive rule
When a PRICE_VARIANCE workflow is approved, the `PriceHistory`
record gets `effective_from` = the GRN date of the specific PO
that had the variance — NOT today's date. Only goods from that PO
get corrected cost in margin reports. All other historical POs
are unaffected. The ledger stays immutable.

### 11. Operator-agnostic design
- `db.counting_sections` seeds EMPTY — operators create their own
- `db.asset_types` seeds EMPTY — operators create their own
- No hardcoded warehouse IDs in business logic (only in demo data)
- Setup Wizard generates random warehouse IDs (`WH-{random}`)
- `TempZone`, `ProductClass`, `Warehouse.type` are legitimate
  standards (cold chain industry), not arbitrary — keep them typed

---

## Key data model facts

- `User.reports_to_user_id` — org chart for workflow routing
- `User.must_reset_password` — true for all admin-created accounts
- `SKU.cost_price_kes` / `SKU.selling_price_kes` — kept in sync
  with the latest `PriceHistory` entry, in cents
- `CountingSection.item_filter` — e.g. `'status:draft'` or
  `'unlocated'` to surface items during counting
- `AssetEvent.reference_id` + `reference_type` — the document
  (order, FPO, repair job) that caused an asset movement
- `GoodsReceiptLine.actual_unit_cost_kes` — what supplier actually
  charged; triggers PRICE_VARIANCE workflow if differs from PO price
- `PublicationStatus` values: `draft | ready | published | blocked
  | delisted | archived`
- All monetary values in KES cents (integer). Divide by 100 to display.

---

## What's in each directory

```
server.ts              — All API endpoints (166+), middleware, auth,
                         scheduler, webhook delivery
src/
  types.ts             — All TypeScript interfaces and types
  db_initial_state.ts  — Demo seed data (Nairobi operator scenario)
                         LABELLED AS DEMO — not constraints
  App.tsx              — React shell, nav, auth gates, routing
  adapters/            — DatabaseAdapter interface + implementations
  components/          — One .tsx file per screen/feature
  utils/               — offlineQueue.ts, uom.ts, audit_pdf_generator.ts
docs/                  — API.md, ARCHITECTURE.md, DEPLOYMENT.md
```

---

## Permissions system

26 named permissions in `Permission` type (types.ts). Key ones:
- `finance:approve` — Finance custom role approval
- `catalogue:view` — Category manager access
- `dispatch:execute` — Dispatch orders
- `users:manage` — Manage team and roles

`userHasPermission(user, permission)` in server.ts:
- Admin → always true
- User with `custom_role_id` → check their custom role's permissions
- Everyone else → false (legacy roles use hardcoded role checks)

---

## Git workflow

```bash
git add .
git status          # verify only expected files changed
git commit -m "Round N — description"
git push
# Credentials cached, no auth prompt needed
```

Repo remote: https://github.com/mj-001/freshops-platform.git
Branch: main

---

## Firebase migration status (in progress)

**Plan:** Cloud Run + Firestore. Keep Express server, swap data layer.

**Round 51 (next):** Implement real `FirestoreAdapter`
**Round 52:** Wire adapter into server.ts (`db.*` → adapter calls)
**Round 53+:** Firebase Auth migration
**Round 54+:** Cloud Run deployment
**Round 55+:** Flutter mobile app (warehouse counting, packing,
               delivery screens — see screenshots in docs/)

**`DATABASE_ADAPTER` env var selects storage:**
- `json` (default) — local JSON file, dev/testing
- `firestore` — Firebase Firestore, production

**Firebase emulator for local Firestore dev:**
```
FIRESTORE_EMULATOR_HOST=localhost:8080
DATABASE_ADAPTER=firestore
DATABASE_URL=freshops-local
```

---

## Things Gemini has added unrequested that we've had to remove

Document these so future sessions don't re-introduce them:

1. **Forgot-password flow** (round 39) — removed immediately.
   Creates account takeover vulnerability. Token was returned in
   API response. Do not re-add without real email delivery.

2. **Offline request queue** (round 33) — kept but completed
   properly. Required idempotency keys to prevent duplicate
   cycle count submissions on retry.

3. **Audit log system** (round 33) — kept after full review.
   `logAudit()` is called after mutations, not instead of them.
   `saveState()` still called inside `logAudit()`.

4. **BarcodeInput component** (round ~24) — kept, small and safe.

5. **Asset seed data** — removed. Assets seed empty now.
   Operators create their own asset types.

---

## Code patterns to follow

**Error responses:**
```typescript
return res.status(4xx).json({
  error: { code: 'SCREAMING_SNAKE_CASE', message: 'Human readable.', field?: 'field_name' }
});
```

**Success responses:**
```typescript
res.json({ data: result });
// or for lists:
res.json({ data: items });
```

**Saving state:**
Always call `saveState()` after every mutation. Never forget this.

**Notifications:**
```typescript
createNotification(event_type, title, message, severity, {
  reference_id, reference_type, target_roles
});
```

**Webhooks:**
```typescript
fireWebhooks('EVENT_TYPE', { payload });
```
Fire after every significant state change that external systems
might need to react to.

**Touch targets:** 44px minimum on all interactive elements.
**Mobile responsive:** All screens must work on narrow viewports.
**Tone:** Match existing dark slate sidebar, teal accent visual style.