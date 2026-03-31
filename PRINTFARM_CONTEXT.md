# PrintFarm — Kompletan kontekst projekta

Ovaj dokument sadrži sve odluke, arhitekturu i pravila definisane pre pisanja koda.
**Ništa ovde se ne menja bez svesne odluke. Ovo je jedini izvor istine.**

---

## Šta je projekat

SaaS platforma za upravljanje farmom Bambu Lab 3D štampača.
Dva proizvoda iz jedne codebase:
- **PrintFarm Cloud** — multi-tenant SaaS, mesečna pretplata
- **PrintFarm Local** — one-time flat fee, self-hosted, opcioni Cloud Connect add-on

---

## Tech stack — finalan, ne menja se

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
| Auth (tenant) | Better Auth (multi-tenant) |
| Auth (admin) | Custom TOTP + WebAuthn |
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
│   ├── web/           React SPA — tenant frontend
│   ├── mobile/        React Native + Expo
│   ├── api/           Hono.js — glavni API (REST + WebSocket)
│   ├── admin/         React — super-admin frontend
│   ├── admin-api/     Hono.js — super-admin API, potpuno odvojen
│   ├── bridge/        Python — LAN MQTT + kamera + Cloudflare Tunnel
│   └── ai-service/    FastAPI + YOLOv8 — inference only
├── packages/
│   ├── config/        env validacija + feature flags ← KREIRAN
│   ├── shared/        Zod schemas + TypeScript tipovi ← KREIRAN
│   ├── db/            Drizzle schema + migracije ← KREIRAN
│   ├── email/         React Email templates
│   └── tsconfig/      Shared TypeScript config ← KREIRAN
├── .cursor/rules/     Cursor rules (7 fajlova) ← KREIRANI
├── turbo.json         ← KREIRAN
├── pnpm-workspace.yaml ← KREIRAN
└── docker-compose.yml  ← NIJE KREIRAN
```

---

## Feature flags — NAJVAŽNIJE PRAVILO

```typescript
// packages/config/src/features.ts
// Ovaj fajl je jedini koji odlučuje šta je Cloud a šta Local

import { env } from './env'

export const isCloud = () => env.DEPLOYMENT_MODE === 'cloud'
export const isLocal = () => env.DEPLOYMENT_MODE === 'local'

export const features = {
  multiTenant: isCloud(),
  billing: isCloud(),
  superAdmin: isCloud(),
  rls: isCloud(),
  cloudConnect: isLocal() && env.CLOUD_CONNECT_ENABLED,
  licenseCheck: isLocal(),
} as const
```

**Pravilo:** Nikad ne čitaj `process.env.DEPLOYMENT_MODE` direktno u app kodu.
Uvek importuj iz `@printfarm/config/features`.

---

## Bambu Lab integracija

- Bambu je **uklonio cloud API pristup** u firmware updateima krajem 2024
- Jedino što radi za third-party: **LAN mode + Developer Mode**
- Svaki printer mora imati Developer Mode uključen (jednom, ručno)
- Mi koristimo: LAN MQTT direktno + JPEG frame extraction za kameru
- Bridge (Python Docker container) živi na kupčevoj lokalnoj mreži
- Bridge se konektuje na naš cloud kroz **Cloudflare Tunnel** (outbound-only, bez port forwarding)

```
Kupčeva mreža:
  [A1 #1] [A1 #2] [A1 #3]
       ↓ LAN MQTT + JPEG
  [Bridge — Docker container]
       ↓ Cloudflare Tunnel (outbound)
Naš cloud:
  [API + WebSocket + AI Service]
       ↓ HTTPS
  Kupčev browser (bilo gde)
```

---

## Poslovni model

### Cloud tierovi
| | Starter | Pro | Enterprise |
|---|---|---|---|
| Cena/mes | $29 | $69 | $149 |
| Printeri | do 3 | do 10 | do 25 |
| Add-on printer | $12/mes | $12/mes | $10/mes |
| Kamera | ✓ | ✓ | ✓ |
| AI detekcija | Add-on +$19 | ✓ | ✓ |
| Webhooks | ✗ | ✗ | ✓ |

### Local
- Flat fee, unlimited printeri, one-time plaćanje
- Cloud Connect add-on: $12/mes, aktivira se u app-u
- RPi5 (pre-konfigurisan, plug & play) kao opcioni hardware

### Trial
- 14 dana pun Pro pristup
- Kartica obavezna pri registraciji
- Trial počinje od prvog online bridge-a, ne od registracije

---

## Sigurnosna arhitektura

### 4 sloja izolacije (Cloud)
```
1. Hono middleware — proverava tenant status pre svake rute
2. Drizzle queries — tenant_id eksplicitno u svakom upitu
3. PostgreSQL RLS — baza sama blokira cross-tenant pristup
4. Bridge API key — vezan za jedan tenant
```

### Super-admin (potpuno odvojen sistem)
- Poseban frontend, poseban Hono backend, poseban JWT secret
- Auth: email + lozinka + **TOTP obavezan** + WebAuthn podrška
- Sesija: max 4 sata, posle ponovna autentikacija
- Audit log: immutable, 2 godine retention

### Tenant lifecycle
```
trial → active → suspended → blocked → deleted
```
- Block: jedan API poziv, efekat za sekunde
- Restore: jedan API poziv
- Soft delete: podaci 30 dana, posle hard delete

---

## Data model — 24 tabele

### Auth domain
- `tenants` — status: trial|trial_expired|active|suspended|blocked|deleted
- `users` — email, password_hash, totp_enabled, totp_secret
- `tenant_users` — role: owner|admin|operator|viewer, UNIQUE(tenant_id, user_id)
- `sessions` — token_hash, expires_at, last_active_at

### Billing domain (Cloud only)
- `plans` — slug: starter|pro|enterprise, max_printers, price_monthly, features jsonb
- `subscriptions` — status: trialing|active|past_due|canceled|unpaid
- `invoices` — stripe_invoice_id, amount_cents, status

### Local product domain
- `licenses` — license_key, device_hardware_id, status: inactive|active|revoked
- `cloud_connect_subscriptions` — za Cloud Connect add-on

### Features
- `tenant_features` — ai_detection_enabled, camera_enabled, webhooks_enabled, max_printers_override

### Devices & Printers
- `devices` — provision_token (unique, upisuje se na SD), hardware_id, status: provisioning|paired|online|offline|error
- `printers` — model: a1|a1_mini|p1p|p1s|x1c|x1e|h2d, serial_number, access_code (encrypted), UNIQUE(tenant_id, serial_number)
- `printer_status` — live status, UNIQUE(printer_id), update-uje se iz MQTT

### Print management
- `print_files` — file_hash (SHA-256), storage_path, metadata jsonb
- `print_jobs` — status: queued|preparing|printing|completed|failed|canceled|paused
- `job_printer_assignments` — kopija po printeru, copy_number

### AI & Events
- `ai_detections` — detection_type: spaghetti|detached|layer_shift|warping|stringing, confidence decimal
- `printer_events` — **immutable**, insert-only, event_type enum
- `notifications` — type enum, user_id nullable (null = svi u tenantu)
- `notification_preferences` — per_type_settings jsonb
- `push_tokens` — Expo push tokens, platform: ios|android

### Super-admin (odvojen)
- `super_admins` — potpuno odvojen od users
- `super_admin_sessions` — poseban token sistem
- `audit_logs` — **immutable**, insert-only, 2 godine retention

---

## Roles unutar tenanta

```
OWNER    → plaća, briše nalog, menja plan
ADMIN    → sve osim billing-a i brisanja
OPERATOR → kreira i upravlja printovima
VIEWER   → read-only
```

---

## API response format — uvek ovaj, bez izuzetka

```typescript
// Uspeh
{ success: true, data: T }

// Greška
{ success: false, error: { code: string, message: string } }

// Error kodovi su u packages/shared/src/types/api.ts → API_ERROR_CODES
```

---

## Dependency injection — obavezan pattern

```typescript
// NIKAD ovako (direktni import)
import { db } from '../../lib/db'
export async function createPrinter(data: AddPrinter) { ... }

// UVEK ovako (dependency injection)
type PrinterServiceDeps = { db: Database; email: EmailService }

export function createPrinterService(deps: PrinterServiceDeps) {
  return {
    async add(tenantId: string, data: AddPrinter) { ... },
    async list(tenantId: string) { ... },
  }
}
```

---

## Module struktura (svaki feature modul)

```
modules/printers/
  schema.ts      ← Zod schemas za ovaj modul (uvozi iz packages/shared)
  service.ts     ← business logic, DB pozivi, dependency injection
  router.ts      ← Hono route handlers, samo HTTP logika
  types.ts       ← izvedeni TypeScript tipovi
  __tests__/
    service.test.ts
    router.test.ts
```

---

## Middleware redosled u Hono (ne menjati)

```
1. rateLimitMiddleware
2. authMiddleware     → validira JWT, stavlja user u context
3. tenantMiddleware   → proverava status tenanta, stavlja tenantId
4. featureMiddleware  → proverava da li je feature aktivan
5. route handler
```

---

## Testing — apsolutna pravila

**Crveni test blokira sve. Nijedan novi kod dok test ne prolazi.**

### Redosled rada
1. Napiši Zod schema → test validacije
2. Napiši service → unit test sa mock dependencies
3. Napiši route → integration test za svaki status kod
4. Napiši komponentu → render + interaction test

### Coverage minimum
- `packages/` → 85% lines, 85% functions
- `apps/api/src/modules/` → 85%

### Svaka service funkcija mora imati
- Test: happy path
- Test: svaki error case
- Test: edge cases (null, empty, boundary)

### Svaki API route mora imati integration test za
- 200/201 happy path
- 400 invalid input
- 401 unauthorized
- 403 wrong tenant / forbidden
- 404 not found (gde relevantno)
- 409 conflict (gde relevantno)

---

## Šta je već kreirano

### ✅ packages/tsconfig
- `node.json`, `react.json`

### ✅ packages/config
- `src/env.ts` — Zod discriminated union za Cloud i Local env
- `src/features.ts` — feature flags
- `src/__tests__/env.test.ts` — testovi za env validaciju
- `src/__tests__/features.test.ts` — testovi za feature flags
- `vitest.config.ts`

### ✅ packages/shared
- `src/schemas/tenant.ts` — tenant statusi, role-ovi
- `src/schemas/user.ts` — register, login, session
- `src/schemas/printer.ts` — svi Bambu modeli, AMS slot
- `src/schemas/job.ts` — print files, jobs, assignments
- `src/schemas/ai.ts` — detection types i actions
- `src/ws-events.ts` — typed WebSocket envelope (discriminated union)
- `src/types/api.ts` — ApiResponse, API_ERROR_CODES, pagination
- `src/constants.ts` — PLAN_LIMITS, timeouts, thresholds
- `src/__tests__/schemas.test.ts`
- `vitest.config.ts`

### ✅ packages/db
- `src/schema/auth.ts` — tenants, users, tenant_users, sessions
- `src/schema/printers.ts` — devices, printers, printer_status
- `src/schema/jobs.ts` — print_files, print_jobs, job_printer_assignments
- `src/schema/billing.ts` — plans, subscriptions, invoices, tenant_features, licenses
- `src/schema/events.ts` — ai_detections, printer_events, notifications, push_tokens, audit_logs
- `src/schema/admin.ts` — super_admins, super_admin_sessions
- `src/schema/index.ts`
- `src/client.ts` — getDb(), closeDb(), singleton pattern
- `src/index.ts`
- `drizzle.config.ts`

### ✅ .cursor/rules/
- `core.mdc` — uvek aktivan
- `backend.mdc` — apps/api/**, apps/admin-api/**
- `frontend.mdc` — apps/web/**, apps/admin/**
- `database.mdc` — packages/db/**
- `mobile.mdc` — apps/mobile/**
- `bridge.mdc` — apps/bridge/**, apps/ai-service/**
- `testing.mdc` — **/*.test.ts

---

## Šta treba uraditi sledeće (redosledom)

### 1. Fix unused imports u packages/db
```
packages/db/src/schema/printers.ts — ukloniti `text` iz importa
packages/db/src/schema/events.ts — ukloniti `integer` iz importa
```

### 2. Pokrenuti testove
```bash
pnpm --filter @printfarm/shared test
pnpm --filter @printfarm/config test
```

### 3. apps/api — Hono.js setup
```
apps/api/
  src/
    env.ts                  ← Zod env za API
    index.ts                ← entry point, Hono app
    middleware/
      auth.ts               ← JWT validacija, user u context
      tenant.ts             ← tenant status check, tenantId u context
      feature.ts            ← feature flag check
      rate-limit.ts         ← rate limiting
    modules/
      auth/                 ← register, login, logout, TOTP
      printers/             ← CRUD + live status
      jobs/                 ← queue, create, cancel
      files/                ← upload, list, delete
    ws/
      server.ts             ← WebSocket server
      handlers/             ← typed event handlers
    lib/
      db.ts                 ← re-export getDb iz packages/db
      redis.ts              ← Redis klijent
  package.json
  tsconfig.json
  vitest.config.ts
```

### 4. Git init + push na GitHub
```bash
cd /home/claude/printfarm
git init
git add .
git commit -m "feat: initial monorepo setup — config, shared, db, cursor rules"
git remote add origin https://github.com/TVOJ_USERNAME/printfarm.git
git push -u origin main
```

---

## Važne napomene za agenta koji nastavlja

1. **Svaki novi fajl** mora pratiti `.cursor/rules/` pravila
2. **Svaki service** mora koristiti dependency injection pattern
3. **Svaki modul** mora imati schema.ts, service.ts, router.ts, types.ts
4. **Testovi pre koda** — nije preporuka, to je proces
5. **Feature flags** — svaki Cloud-only feature ide kroz `if (features.X)`
6. **API response** — uvek `{ success: true, data }` ili `{ success: false, error: { code, message } }`
7. **tenant_id** uvek iz middleware contexta, nikad iz request body-a
8. **Local varijanta** mora raditi bez ijedne Cloud zavisnosti
9. **packages/shared** je jedini izvor Zod schemas i TypeScript tipova
10. **packages/db/src/schema/events.ts** i **audit_logs** su immutable tabele — samo INSERT
