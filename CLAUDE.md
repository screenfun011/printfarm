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
| Auth | Session tokens (bcrypt + SHA-256 hash) |
| TOTP | Custom impl u src/lib/totp.ts (Node crypto, bez otplib) |
| Plaćanje | Stripe |
| Queue | BullMQ + Redis |
| Email | Resend + React Email |
| Tunnel | Cloudflare Tunnel (outbound-only) |
| Monorepo | Turborepo + pnpm workspaces |
| Mobile | React Native 0.79.6 + Expo 53 |
| AI | FastAPI + YOLOv8 + OpenVINO/ONNX |
| Bridge | Python — lokalni MQTT agent |

---

## Monorepo struktura

```
printfarm/
├── apps/
│   ├── web/           ← React SPA ✓ KREIRAN I TESTIRAN
│   ├── mobile/        ← React Native + Expo ✓ KREIRAN I TESTIRAN
│   ├── api/           ← Hono.js API ✓ KOMPLETAN (88 testova)
│   ├── admin/         ← Super-admin React SPA ✓ KREIRAN
│   ├── admin-api/     ← Super-admin Hono API ✓ KREIRAN I TESTIRAN
│   ├── bridge/        ← Python MQTT agent ✓ KREIRAN I TESTIRAN
│   └── ai-service/    ← FastAPI YOLOv8 ✓ KREIRAN I TESTIRAN
├── packages/
│   ├── config/        ← KREIRAN I TESTIRAN ✓
│   ├── shared/        ← KREIRAN I TESTIRAN ✓
│   ├── db/            ← KREIRAN, schema kompletna, migracije ✓
│   ├── email/         ← NIJE KREIRAN
│   └── tsconfig/      ← KREIRAN ✓
├── CLAUDE.md          ← ovaj fajl
└── PRINTFARM_CONTEXT.md ← detaljan kontekst
```

---

## Portovi u razvoju

| App | Port |
|---|---|
| apps/api | 3000 |
| apps/admin-api | 3001 |
| apps/web | 5173 |
| apps/admin | 5174 |
| apps/mobile (Expo) | 8081 |
| apps/ai-service | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO | 9000 |

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

### TOTP — NE KORISTITI otplib
otplib v13 ne exportuje `authenticator` u ESM build-u.
Koristiti custom implementaciju:
```typescript
// apps/api/src/lib/totp.ts
// apps/admin-api/src/lib/totp.ts
import { authenticator } from '../../lib/totp.js'
// authenticator.generateSecret(), .verify(), .keyuri()
```

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
2. authMiddleware     → session token validacija
3. tenantMiddleware   → tenant status check
4. featureMiddleware  → feature flag check
5. route handler
```

### Testovi — BLOKIRAJU SVE
- Crveni test = STOP, nema novog koda dok ne prolazi
- Svaka service funkcija: unit test pre pisanja
- Coverage minimum 85%
- Test fajlovi: `__tests__/naziv.test.ts` pored fajla
- Koristiti `vitest` (ne Jest) u svim TS projektima
- Python projekti: `pytest` + `pytest-asyncio` + `pytest-cov`

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

### Dev server pokretanje
`.claude/launch.json` koristi pune putanje:
- `runtimeExecutable`: `/Users/nikola/.nvm/versions/node/v22.22.2/bin/pnpm`
- Ili wrapper skript u `.claude/run-*.sh`
(node nije na default PATH-u jer se koristi nvm)

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
- 24 tabele u 6 schema fajlova
- Drizzle relations kompletne
- Migracije generisane i primenjene na lokalnoj bazi

### apps/api ✓ KOMPLETAN
- 88 testova, 92%+ coverage
- Moduli: auth, printers, jobs, files, ai, bridge
- lib/totp.ts — custom TOTP implementacija (Node crypto)
- WebSocket server
- Bridge endpoints: POST /bridge/printers/:id/status, POST /bridge/printers/:id/frame, GET /bridge/printers
- BRIDGE_TOKEN env var za auth bridge-a
- Radi na portu 3000

### apps/admin-api ✓ KREIRAN I TESTIRAN
- 20 testova, 100% statement coverage
- Moduli: auth (login/logout/me), tenants (list/getById/updateStatus), stats (overview)
- Session-based auth za super admina (super_admin_sessions tabela)
- Port 3001, CORS za localhost:5174

### apps/web ✓ KREIRAN I TESTIRAN
- React 19 + Vite + TanStack Router
- Moduli: printers, jobs, files, ai (hooks + testovi)
- Auth store bez externe state biblioteke
- Port 5173, proxy na API port 3000

### apps/mobile ✓ KREIRAN I TESTIRAN
- React Native 0.79.6 + Expo 53 + Expo Router v5
- 22 testa, 97.18% coverage
- Moduli: printers, jobs, files, ai (hooks + testovi)

### apps/admin ✓ KREIRAN
- React 19 + Vite + TanStack Router
- Rute: /auth/login, /dashboard, /tenants
- Port 5174, proxy na admin-api port 3001
- TypeScript clean

### apps/bridge ✓ KREIRAN I TESTIRAN
- Python 3.9+ asyncio
- 62 testa, 95.48% coverage
- MQTT konekcija na Bambu Lab LAN (port 8883 TLS, user=bblp, pass=access_code)
- Parsira Bambu report payload → PrinterStatus
- Šalje status na /bridge/printers/:id/status
- Šalje JPEG frame-ove na /bridge/printers/:id/frame
- Camera: RTSP stream capture (OpenCV, opcionalno)
- Konfiguracija: .env (API_URL, BRIDGE_TOKEN, PRINTERS JSON array)

### apps/ai-service ✓ KREIRAN I TESTIRAN
- FastAPI + Python 3.9+
- 30 testa, 86.72% coverage
- POST /detect — prima JPEG, vraća DetectionResult
- GET /health — status modela
- Detekcija: spaghetti, knocked_over, layer_shift (YOLOv8)
- Confidence threshold: 0.60
- Radi bez modela (passthrough mode) — sve detekcije vraćaju failure=False
- Model path: models/printfarm.pt (konfigurabilno env varom MODEL_PATH)
- Port 8000

---

## Šta treba uraditi sledeće (po prioritetu)

### 1. packages/email — React Email šabloni
```
- Welcome email (novi tenant)
- Trial expiry warning (3 dana prije)
- Invoice/receipt email
```

### 2. Stripe integracija u apps/api
```
- POST /billing/checkout  → Stripe Checkout Session
- POST /billing/webhook   → Stripe webhook handler
- GET  /billing/portal    → Customer Portal
```

### 3. YOLOv8 model treniranje
```
- Dataset: labeled 3D print failure images
- Klase: spaghetti (0), knocked_over (1), layer_shift (2)
- Export: .pt format → models/printfarm.pt u ai-service
```

### 4. Bridge integracija test
```
- Pokrenuti bridge lokalno sa pravim štampačem
- Verifikovati MQTT konekciju i status updates
```

---

## Bambu Lab integracija

- Firmware late 2024: **cloud API uklonjen**, samo LAN + Developer Mode
- Svaki printer mora imati Developer Mode uključen (jednom, ručno)
- Bridge komunicira: LAN MQTT (port 8883, TLS bez cert verifikacije)
- Kredencijali: username=`bblp`, password=`<access_code>` (8 cifara)
- Camera: RTSPS stream `rtsps://<ip>/streaming/live/1`
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
