# PrintFarm — Kontekst za Claude Code

Ovaj fajl čita Claude Code automatski kada se pokrene u ovom folderu.
Sadrži sve odluke, arhitekturu i trenutni status projekta.

---

## Projekat

SaaS platforma za upravljanje farmom Bambu Lab 3D štampača.
Dva proizvoda iz jedne codebase (feature flags kontrolišu razlike):
- **PrintFarm Cloud** — multi-tenant SaaS, mesečna pretplata
- **PrintFarm Local** — one-time flat fee, self-hosted, opcioni Cloud Connect

---

## Tech stack

| Sloj | Tehnologija |
|---|---|
| Frontend | React 19 + Vite |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query |
| Tabele | TanStack Table |
| UI | shadcn/ui + Tailwind CSS v4 |
| Backend | Hono.js + Node.js LTS |
| ORM | Drizzle + PostgreSQL |
| Validacija | Zod — jedini izvor tipova |
| Auth | Better Auth (multi-tenant) |
| Plaćanje | Stripe |
| Queue | BullMQ + Redis |
| Email | Resend + React Email |
| Tunnel | Cloudflare Tunnel (outbound-only) |
| Monorepo | Turborepo + pnpm workspaces |
| Mobile | React Native + Expo |
| AI | FastAPI + YOLOv8 + OpenVINO/ONNX |
| Bridge | Python — lokalni MQTT agent |

---

## Monorepo struktura

```
printfarm/
├── apps/
│   ├── web/           ← React SPA (NIJE KREIRAN)
│   ├── mobile/        ← React Native + Expo (NIJE KREIRAN)
│   ├── api/           ← Hono.js API ← KREIRAN, delimično
│   ├── admin/         ← Super-admin frontend (NIJE KREIRAN)
│   ├── admin-api/     ← Super-admin API (NIJE KREIRAN)
│   ├── bridge/        ← Python MQTT agent (NIJE KREIRAN)
│   └── ai-service/    ← FastAPI YOLOv8 (NIJE KREIRAN)
├── packages/
│   ├── config/        ← KREIRAN I TESTIRAN ✓
│   ├── shared/        ← KREIRAN I TESTIRAN ✓
│   ├── db/            ← KREIRAN, schema kompletna ✓
│   ├── email/         ← NIJE KREIRAN
│   └── tsconfig/      ← KREIRAN ✓
├── .cursor/rules/     ← 7 pravila fajlova ✓
├── CLAUDE.md          ← ovaj fajl
└── PRINTFARM_CONTEXT.md ← detaljan kontekst
```

---

## Feature flags — NAJVAŽNIJE PRAVILO

```typescript
// packages/config/src/features.ts
// NIKAD ne čitaj process.env.DEPLOYMENT_MODE direktno
// UVEK importuj odavde

import { features } from '@printfarm/config/features'

features.multiTenant   // true samo u cloud
features.billing       // true samo u cloud
features.superAdmin    // true samo u cloud
features.rls           // true samo u cloud
features.cloudConnect  // true samo u local + CC aktivan
features.licenseCheck  // true samo u local
```

---

## Kritična pravila

### Dependency injection — UVEK ovaj pattern
```typescript
// NIKAD direktan import
export async function addPrinter(data: AddPrinter) { ... }

// UVEK factory sa deps
export function createPrinterService(deps: { db: Database }) {
  return {
    async add(tenantId: string, data: AddPrinter) { ... }
  }
}
```

### API response format — UVEK ovaj format
```typescript
// Uspeh
{ success: true, data: T }

// Greška
{ success: false, error: { code: string, message: string } }
```

### Middleware redosled u Hono (ne menjati)
```
1. rateLimitMiddleware
2. authMiddleware     → JWT validacija
3. tenantMiddleware   → status check
4. featureMiddleware  → feature flag check
5. route handler
```

### Testovi — BLOKIRAJU SVE
- Crveni test = STOP, nema novog koda dok ne prolazi
- Svaka service funkcija: unit test pre pisanja
- Coverage minimum 85%
- Test fajlovi: `__tests__/naziv.test.ts` pored fajla

### Module struktura (svaki modul)
```
modules/X/
  schema.ts    ← Zod schemas
  service.ts   ← business logic, DI pattern
  router.ts    ← Hono handlers, samo HTTP
  types.ts     ← izvedeni tipovi
  __tests__/
    service.test.ts
```

---

## Šta je kreirano i testovano

### packages/config ✓
- Zod discriminated union za Cloud/Local env
- Feature flags sa type-safe narrowing
- 10 testova, 100% coverage

### packages/shared ✓
- Zod schemas: tenant, user, printer, job, ai
- Typed WebSocket envelope (discriminated union)
- API response tipovi i error kodovi
- Konstante (PLAN_LIMITS, timeouts, thresholds)
- 12 testova, 100% coverage

### packages/db ✓
- 24 tabele u 6 schema fajlova:
  - auth.ts: tenants, users, tenant_users, sessions
  - printers.ts: devices, printers, printer_status
  - jobs.ts: print_files, print_jobs, job_printer_assignments
  - billing.ts: plans, subscriptions, invoices, tenant_features, licenses
  - events.ts: ai_detections, printer_events, notifications, push_tokens, audit_logs
  - admin.ts: super_admins, super_admin_sessions
- Drizzle relations kompletne
- TypeScript clean

### apps/api (delimično) ✓
- env.ts — Zod validacija
- lib/db.ts, lib/redis.ts — singleton klijenti
- middleware/auth.ts — JWT + session validacija
- middleware/tenant.ts — tenant status check
- middleware/feature.ts — feature flag guard
- middleware/rate-limit.ts — in-memory rate limiting
- modules/printers/service.ts — CRUD sa DI, 14 testova ✓
- modules/printers/router.ts — Hono handlers
- ws/server.ts — typed WebSocket server
- index.ts — Hono app entry point

---

## Šta treba uraditi sledeće (po prioritetu)

### 1. apps/api — preostali moduli

**modules/auth** (SLEDEĆE)
```
- POST /auth/register
- POST /auth/login (+ TOTP)
- POST /auth/logout
- POST /auth/totp/setup
- POST /auth/totp/verify
- GET  /auth/me
```

**modules/jobs**
```
- GET    /jobs
- POST   /jobs (create + assign na printere)
- GET    /jobs/:id
- PATCH  /jobs/:id/cancel
- PATCH  /jobs/:id/pause
- PATCH  /jobs/:id/resume
- DELETE /jobs/:id
```

**modules/files**
```
- GET    /files
- POST   /files (upload .3mf)
- GET    /files/:id
- DELETE /files/:id
```

**modules/ai**
```
- GET    /ai/detections
- PATCH  /ai/detections/:id/action (pause/cancel/skip/dismiss)
```

### 2. docker-compose.yml
```yaml
services:
  postgres:  # PostgreSQL 16
  redis:     # Redis 7
  api:       # apps/api
  web:       # apps/web (kad bude kreiran)
```

### 3. apps/web — React SPA
```
src/
  routes/           ← TanStack Router, file-based
  modules/
    printers/
    jobs/
    files/
  lib/
    query-client.ts
    ws-client.ts
    api-client.ts
  features.ts       ← importuje iz @printfarm/config/features
```

---

## Bambu Lab integracija

- Firmware late 2024: **cloud API uklonjen**, samo LAN + Developer Mode
- Svaki printer mora imati Developer Mode uključen (jednom, ručno)
- Bridge komunicira: LAN MQTT + JPEG frame extraction (kamera)
- Cloudflare Tunnel: outbound-only, bez port forwarding

---

## Poslovni model

### Cloud
| Tier | Cena | Printeri | AI |
|---|---|---|---|
| Starter | $29/mes | do 3 | Add-on +$19 |
| Pro | $69/mes | do 10 | Uključen |
| Enterprise | $149/mes | do 25 | Uključen |
| Add-on printer | +$12/mes | +1 | — |

### Local
- Flat fee, unlimited printeri
- Cloud Connect add-on: $12/mes

### Trial
- 14 dana pun Pro pristup
- Kartica obavezna pri registraciji
- Počinje od prvog online bridge-a

---

## GitHub repo
https://github.com/screenfun011/printfarm

