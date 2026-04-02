# PrintFarm — Kompletan kontekst za Cursor AI

**Ovo je jedini izvor istine za Cursor.** Čitaj ceo fajl pre nego što pišeš ijedan red koda.
CLAUDE.md i PRINTFARM_CONTEXT.md su takođe u repo — čitaj i njih.

---

## Šta je projekat

SaaS platforma za upravljanje farmom Bambu Lab 3D štampača.
Dva proizvoda iz jedne codebase (feature flags kontrolišu razlike):
- **PrintFarm Cloud** — multi-tenant SaaS, mesečna pretplata
- **PrintFarm Local** — one-time flat fee, self-hosted, opcioni Cloud Connect

---

## Tech stack — FINALAN, NE MENJA SE

| Sloj | Tehnologija | Napomena |
|---|---|---|
| Frontend | React 19 + Vite | |
| Routing | TanStack Router (file-based) | `routeTree.gen.ts` generiše Vite plugin, ne editovati ručno |
| Server state | TanStack Query | |
| Tabele | TanStack Table | |
| UI | shadcn/ui + Tailwind CSS v4 | |
| Backend | Hono.js + Node.js LTS | |
| ORM | Drizzle + PostgreSQL | `postgres.js` driver (ne pg, ne node-postgres) |
| Validacija | Zod — jedini izvor tipova | |
| Auth | Session tokens (bcrypt + SHA-256 hash) | NE JWT, NE Better Auth |
| TOTP | Custom impl — `src/lib/totp.ts` | NE otplib — v13 ESM broken |
| Plaćanje | Stripe | |
| Queue | BullMQ + Redis | |
| Email | Resend + React Email | packages/email — NIJE KREIRAN |
| Tunnel | Cloudflare Tunnel (outbound-only) | |
| Monorepo | Turborepo + pnpm workspaces | |
| Mobile | React Native 0.79.6 + Expo 53 | Expo Router v5 |
| AI | FastAPI + YOLOv8 | apps/ai-service |
| Bridge | Python asyncio + paho-mqtt | apps/bridge |

---

## Monorepo struktura — trenutno stanje

```
printfarm/
├── apps/
│   ├── web/           ← React SPA ✅ KREIRAN I TESTIRAN
│   ├── mobile/        ← React Native + Expo ✅ KREIRAN I TESTIRAN
│   ├── api/           ← Hono.js API ✅ KOMPLETAN (88 testova, 92%+ coverage)
│   ├── admin/         ← Super-admin React SPA ✅ KREIRAN (TypeScript clean)
│   ├── admin-api/     ← Super-admin Hono API ✅ KREIRAN I TESTIRAN (20 testova)
│   ├── bridge/        ← Python MQTT agent ✅ KREIRAN I TESTIRAN (62 testa, 95%)
│   └── ai-service/    ← FastAPI YOLOv8 ✅ KREIRAN I TESTIRAN (30 testova, 87%)
├── packages/
│   ├── config/        ← ✅ KREIRAN I TESTIRAN (10 testova, 100% coverage)
│   ├── shared/        ← ✅ KREIRAN I TESTIRAN (12 testova, 100% coverage)
│   ├── db/            ← ✅ KREIRAN (24 tabele, migracije aplicirane)
│   ├── email/         ← ❌ NIJE KREIRAN — sledeće na listi
│   └── tsconfig/      ← ✅ KREIRAN
├── .cursor/rules/     ← 7 Cursor rules fajlova
├── CLAUDE.md          ← tracking fajl, uvek ažuran
├── CURSOR_CONTEXT.md  ← ovaj fajl
├── PRINTFARM_CONTEXT.md ← detaljan originalni kontekst
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
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
| MinIO | 9000 (S3-compatible) |

---

## Okruženje

- **Node**: v22.22.2 via nvm (`~/.nvm/versions/node/v22.22.2/bin/`)
- **Python**: 3.9.6 (system), pip na `/Library/Developer/CommandLineTools/...`
- **pnpm**: `/Users/nikola/.nvm/versions/node/v22.22.2/bin/pnpm`
- **Platform**: macOS (darwin 25.3.0)
- Lokalna baza: PostgreSQL, user=`printfarm`, pass=`printfarm`, db=`printfarm`
- Redis: localhost:6379
- MinIO: localhost:9000 (user=`minioadmin`, pass=`minioadmin`)

---

## KRITIČNA PRAVILA — čitaj svaki put

### 1. Auth — SESSION TOKENS, ne JWT

```typescript
// Token se generiše kao random bytes, hash se čuva u bazi
const token = randomBytes(32).toString('hex')
const tokenHash = createHash('sha256').update(token).digest('hex')
// U bazi: sessions.token_hash = tokenHash
// Klijentu se šalje: token (plain)
// Authorization header: Bearer <plain token>
```

### 2. TOTP — NIKAD otplib

otplib v13 ne exportuje `authenticator` u ESM build-u. Koristiti custom implementaciju:
```typescript
// apps/api/src/lib/totp.ts        ← kopija
// apps/admin-api/src/lib/totp.ts  ← kopija
import { authenticator } from '../../lib/totp.js'
// authenticator.generateSecret()  → base32 string
// authenticator.verify({ token, secret }) → boolean (±1 window)
// authenticator.keyuri(account, issuer, secret) → otpauth:// URL
```

### 3. Database driver — postgres.js (ne pg, ne node-postgres)

```typescript
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })
```

### 4. Dependency injection — UVEK factory pattern

```typescript
// NIKAD ovako
export async function addPrinter(data: AddPrinter) {
  const result = await db.insert(printers)...  // direktan import db
}

// UVEK ovako
export function createPrinterService({ db }: { db: Database }) {
  return {
    async add(tenantId: string, data: AddPrinter) {
      return db.insert(printers)...
    }
  }
}
```

### 5. API response format — bez izuzetka

```typescript
// Uspeh
{ success: true, data: T }

// Greška
{ success: false, error: { code: string, message: string } }

// Error kodovi iz packages/shared/src/types/api.ts → API_ERROR_CODES
```

### 6. Tenant ID — UVEK iz middleware contexta

```typescript
// NIKAD iz body-a
const { tenantId } = c.req.json() // ❌

// UVEK iz middleware contexta
const tenantId = c.get('tenantId') // ✅
```

### 7. Feature flags — UVEK iz packages/config

```typescript
// NIKAD direktno
if (process.env.DEPLOYMENT_MODE === 'cloud') { ... } // ❌

// UVEK ovako
import { features } from '@printfarm/config/features'
if (features.billing) { ... } // ✅
```

### 8. Drizzle .returning() — uvek null guard

```typescript
// Drizzle .returning() vraća array, [0] može biti undefined
const [session] = await db.insert(sessions).values({...}).returning()
if (!session) throw new ServiceError('INTERNAL_ERROR', 'Failed to create session', 500)
```

### 9. Testovi blokiraju SVE

- Test pada → STOP, ispravi, tek onda nastavi
- Coverage minimum 85%
- `vitest` za sve TypeScript projekte
- `pytest` + `pytest-asyncio` za Python projekte
- Test fajlovi: `src/modules/X/__tests__/service.test.ts`

---

## Struktura modula (svaki feature modul u api)

```
modules/X/
  schema.ts    ← Zod schemas (importuje iz packages/shared kad može)
  service.ts   ← business logic, DI pattern, nema HTTP znanja
  router.ts    ← Hono handlers, samo HTTP, zove service
  types.ts     ← izvedeni TypeScript tipovi
  __tests__/
    service.test.ts   ← unit testovi sa mock DB
```

---

## Middleware redosled u Hono (NE MENJATI)

```
1. rateLimitMiddleware    (svuda)
2. authMiddleware         → validira token, stavlja userId/tenantId/role u ctx
3. tenantMiddleware       → proverava tenant status (suspended/blocked → 403)
4. featureMiddleware      → proverava feature flag
5. route handler
```

Bridge rute koriste poseban middleware koji proverava `BRIDGE_TOKEN` (ne user sesiju).

---

## Šta je implementirano — detalji po modulu

### packages/config
- `src/env.ts` — Zod discriminated union: cloud/local env schema
- `src/features.ts` — feature flags object (multiTenant, billing, superAdmin, rls, cloudConnect, licenseCheck)

### packages/shared
- `src/schemas/` — tenant, user, printer, job, ai Zod schemas
- `src/ws-events.ts` — typed WebSocket envelope (discriminated union po event type)
- `src/types/api.ts` — `ApiResponse<T>`, `API_ERROR_CODES` enum, paginacija
- `src/constants.ts` — `PLAN_LIMITS` (starter: 3, pro: 10, enterprise: 25), timeouts, thresholds

### packages/db — 24 tabele u 6 schema fajlova

**auth.ts**: tenants, users, tenant_users, sessions
- `tenants.status`: trial | trial_expired | active | suspended | blocked | deleted
- `users`: email, passwordHash, totpEnabled, totpSecret
- `tenant_users.role`: owner | admin | operator | viewer
- `sessions`: tokenHash (SHA-256), expiresAt, lastActiveAt

**printers.ts**: devices, printers, printer_status
- `printers`: model (a1|a1_mini|p1p|p1s|x1c|x1e|h2d), serialNumber, ipAddress, accessCode, isActive, status, lastSeenAt
- `printer_status`: live MQTT status, UNIQUE(printer_id)

**jobs.ts**: print_files, print_jobs, job_printer_assignments
- `print_jobs.status`: queued|preparing|printing|completed|failed|canceled|paused

**billing.ts**: plans, subscriptions, invoices, tenant_features, licenses
- `tenant_features`: aiDetectionEnabled, cameraEnabled, webhooksEnabled, maxPrintersOverride
- `subscriptions.status`: trialing|active|past_due|canceled|unpaid

**events.ts**: ai_detections, printer_events, notifications, push_tokens, audit_logs
- `ai_detections.detectionType`: spaghetti|detached|layer_shift|warping|stringing
- `printer_events` i `audit_logs` su IMMUTABLE — samo INSERT, nikad UPDATE/DELETE

**admin.ts**: super_admins, super_admin_sessions

### apps/api (port 3000)

**Moduli:**
- `auth/` — register, login, logout, me, totp-setup, totp-verify
- `printers/` — CRUD, max limit check po planu, lastSeenAt
- `jobs/` — create, queue, cancel, status
- `files/` — upload (S3/MinIO), list, delete, signed URL
- `ai/` — trigger detection, list detections
- `bridge/` — status update od bridge agenta, AI frame, lista printera

**Lib:**
- `lib/totp.ts` — custom TOTP (Node crypto, RFC 6238, ±1 window)
- `lib/storage.ts` — S3Client wrapper (MinIO u dev)
- `lib/db.ts` — singleton Drizzle instance

**Env vars** (apps/api/.env):
```
NODE_ENV=development
PORT=3000
DEPLOYMENT_MODE=cloud
DATABASE_URL=postgresql://printfarm:printfarm@localhost:5432/printfarm
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-minimum-32-characters-long
JWT_ADMIN_SECRET=dev-jwt-admin-secret-minimum-32-characters
STRIPE_SECRET_KEY=sk_test_devplaceholder...
STRIPE_WEBHOOK_SECRET=whsec_devplaceholder...
RESEND_API_KEY=re_devplaceholder...
CORS_ORIGINS=http://localhost:5173
S3_BUCKET=printfarm
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://localhost:9000
MAX_FILE_SIZE_MB=200
BRIDGE_TOKEN=dev-bridge-token-minimum-sixteen-chars
```

**Test**: `./node_modules/.bin/vitest run` (88 testova, 92%+ coverage)

### apps/admin-api (port 3001)

- **Auth**: Super admin login (email + password + TOTP obavezan), logout, me
- **Tenants**: list (filter po statusu), getById, updateStatus
- **Stats**: overview (ukupno tenants/users/printers po statusu)
- Koristi posebnu `super_admin_sessions` tabelu
- `lib/totp.ts` — identična kopija kao u apps/api
- **Env**: `BRIDGE_TOKEN`, `JWT_ADMIN_SECRET`, `CORS_ORIGINS=http://localhost:5174`

### apps/web (port 5173)

- `src/lib/auth-store.ts` — reactive pub/sub auth store BEZ zustand
- `src/lib/api-client.ts` — typed fetch wrapper
- Proxy: `/api/*` → `localhost:3000`
- Modules sa hooks + tests: printers, jobs, files, ai
- `routeTree.gen.ts` — AUTOMATSKI GENERISAN od Vite plugin-a (ne editovati)

### apps/admin (port 5174)

- `src/lib/auth-store.ts` — isti reaktivni pattern kao web, bez zustand
- `src/lib/api-client.ts` — typed fetch, BASE_URL='/admin-api'
- Proxy: `/admin-api/*` → `localhost:3001`
- Rute: `/auth/login`, `/dashboard`, `/tenants`
- `routeTree.gen.ts` — manuelno kreiran u istom formatu kao generisani

**VAŽNO za admin `routeTree.gen.ts`**: TanStack Router plugin generiše ovaj fajl automatski pri `vite dev`. Ako TypeScript javlja greške tu, pokreni dev server da se fajl regeneriše. Ručna verzija ima `@ts-nocheck` na vrhu.

### apps/mobile (port 8081)

- Expo Router v5 (file-based routing kao u web)
- 22 testa, 97.18% coverage
- Modules: printers, jobs, files, ai (hooks + testovi)
- Auth: isti pattern — reactive store, session token

### apps/bridge (Python)

**Arhitektura:**
```
src/
  mqtt/
    handlers.py   ← parse_report(bytes) → PrinterStatus | None
    client.py     ← PrinterMqttClient (paho-mqtt, TLS, port 8883)
  printers/
    manager.py    ← PrinterManager (add/remove printers, route status)
  api/
    client.py     ← BridgeApiClient (aiohttp, POST status/frame)
  camera/
    stream.py     ← CameraStream (OpenCV, RTSP, async loop)
  config.py       ← load_config() iz env
  main.py         ← asyncio entry point
```

**Bambu Lab MQTT detalji:**
- Host: `<printer_ip>`, port: `8883`, TLS bez cert verifikacije
- Username: `bblp`, Password: `<access_code>` (8 cifara sa ekrana printera)
- Subscribe topic: `device/<serial>/report`
- Publish topic: `device/<serial>/request`
- Payload: JSON sa `print.gcode_state` (IDLE/RUNNING/PAUSE/FINISH/FAILED)

**Konfiguracija (.env):**
```
API_URL=http://localhost:3000
BRIDGE_TOKEN=dev-bridge-token-minimum-sixteen-chars  # mora da se poklapa sa API
CAMERA_ENABLED=true
CAMERA_INTERVAL_SECONDS=10
PRINTERS=[{"serial":"...","ip":"...","access_code":"...","device_id":"..."}]
```

**Pokretanje:**
```bash
cd apps/bridge
pip install -r requirements.txt
python3 -m src.main
```

**Test**: `python3 -m pytest tests/ -q` (62 testa, 95.48% coverage)

### apps/ai-service (Python, port 8000)

**API:**
- `GET /health` → `{ status: "ok", modelLoaded: bool }`
- `POST /detect` (multipart/form-data, field `frame` = JPEG bytes) → `DetectionResult`

**DetectionResult format:**
```json
{
  "failure": true,
  "failureType": "spaghetti",
  "confidence": 0.93,
  "boundingBox": { "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.4 }
}
```

**FailureType enum:** `spaghetti` (class 0), `knocked_over` (class 1), `layer_shift` (class 2)

**Confidence threshold:** 0.60 (ispod = nema failure)

**BoundingBox:** normalizovan na [0,1] relativno na dimenzije slike

**Model:** YOLOv8, čeka se na `models/printfarm.pt`. Bez modela radi u passthrough modu (sve vraća `failure: false`).

**Pokretanje:**
```bash
cd apps/ai-service
pip install fastapi uvicorn python-multipart python-dotenv
# Za model:
# pip install ultralytics opencv-python-headless
python3 -m src.main
```

**Test**: `python3 -m pytest tests/ -q` (30 testova, 86.72% coverage)

---

## Šta sledeće treba uraditi

### 1. packages/email (SLEDEĆE) — React Email templates

```
packages/email/
  src/
    templates/
      WelcomeEmail.tsx         ← novi tenant, link za login
      TrialExpiryEmail.tsx     ← 3 dana pre isteka triala
      InvoiceEmail.tsx         ← potvrda plaćanja
    index.ts                   ← export svih templates
  package.json
```

Koristiti `@react-email/components`. Integracija u apps/api: `Resend` klijent.

### 2. Stripe integracija u apps/api

```
apps/api/src/modules/billing/
  schema.ts
  service.ts   ← createCheckoutSession, handleWebhook, createPortalSession
  router.ts    ← POST /billing/checkout, POST /billing/webhook, GET /billing/portal
  __tests__/service.test.ts
```

Webhook events koji trebaju handler:
- `checkout.session.completed` → aktiviraj subscription
- `invoice.payment_succeeded` → sačuvaj invoice
- `invoice.payment_failed` → promena statusa na `past_due`
- `customer.subscription.deleted` → promena statusa tenanta

### 3. YOLOv8 model trening

Dataset klase:
- 0: `spaghetti` — filament spaghetti na printeru
- 1: `knocked_over` — print koji je pao
- 2: `layer_shift` — vidljivi layer shift

Export: `model.export(format='pt')` → `apps/ai-service/models/printfarm.pt`

### 4. Bridge → AI integracija

Trenutno `POST /bridge/printers/:id/frame` samo prima frame i vraca `queued: true`.
Treba:
1. API prima JPEG, čuva u S3/MinIO
2. BullMQ job za AI analizu
3. AI service odgovori → `ai_detections` tabela INSERT
4. WebSocket event klijentima ako je detektovan failure

---

## Bambu Lab integracija — kritični detalji

- Firmware late 2024: **cloud API uklonjen**, samo LAN + Developer Mode
- Svaki printer: Settings → Network → Developer Mode → ON (jednom, ručno)
- Camera: RTSPS stream `rtsps://<ip>/streaming/live/1` (OpenCV + FFMPEG backend)
- Bridge živi na kupčevoj lokalnoj mreži (Docker container)
- Cloud konekcija: Cloudflare Tunnel (outbound-only, zero port forwarding)

---

## Sigurnosna arhitektura

### 4 sloja tenant izolacije
1. Hono `tenantMiddleware` — proverava status tenanta (suspended/blocked → 403)
2. Drizzle queries — `eq(table.tenantId, tenantId)` u svakom upitu
3. PostgreSQL RLS — baza sama blokira cross-tenant pristup (cloud only)
4. `BRIDGE_TOKEN` — odvojen od user auth, sinhronizovan između api i bridge

### Super-admin sistem
- **Potpuno odvojen** — poseban frontend (5174), poseban backend (3001), poseban JWT secret
- Auth: email + bcrypt lozinka + **TOTP obavezan** (nikad skip)
- Sesija: 8h (user sesije: 30 dana)
- Tabele: `super_admins`, `super_admin_sessions` — ne mešati sa `users`/`sessions`

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
- Počinje od prvog online bridge-a (ne od registracije)

---

## Pokretanje u razvoju

```bash
# Infrastruktura (PostgreSQL, Redis, MinIO)
docker compose up -d

# API
cd apps/api && pnpm dev       # port 3000

# Web
cd apps/web && pnpm dev       # port 5173

# Admin API
cd apps/admin-api && pnpm dev # port 3001

# Admin frontend
cd apps/admin && pnpm dev     # port 5174

# Bridge (Python)
cd apps/bridge
pip install -r requirements.txt
cp .env.example .env  # pa popuni PRINTERS
python3 -m src.main

# AI Service (Python)
cd apps/ai-service
pip install fastapi uvicorn python-multipart python-dotenv
python3 -m src.main  # port 8000

# Mobile
cd apps/mobile && pnpm dev    # port 8081
```

## Testovi

```bash
# TypeScript projekti
cd apps/api && ./node_modules/.bin/vitest run          # 88 testova
cd apps/admin-api && ./node_modules/.bin/vitest run    # 20 testova
cd apps/web && ./node_modules/.bin/vitest run          # web hooks
cd apps/mobile && ./node_modules/.bin/vitest run       # 22 testa
cd packages/config && ./node_modules/.bin/vitest run   # 10 testova
cd packages/shared && ./node_modules/.bin/vitest run   # 12 testova

# Python projekti
cd apps/bridge && python3 -m pytest tests/ -q          # 62 testa, 95%
cd apps/ai-service && python3 -m pytest tests/ -q      # 30 testova, 87%
```

---

## Cursor rules (.cursor/rules/)

7 fajlova koji su uvek aktivni ili aktivni po glob patternu:

| Fajl | Scope | Opis |
|---|---|---|
| `core.mdc` | uvek | TypeScript strict, Zod, DI, API format, test pravila |
| `backend.mdc` | `apps/api/**`, `apps/admin-api/**` | Hono struktura, middleware, tenant izolacija |
| `frontend.mdc` | `apps/web/**`, `apps/admin/**` | React, TanStack Router, auth store pattern |
| `database.mdc` | `packages/db/**` | Drizzle patterns, migracije, RLS |
| `mobile.mdc` | `apps/mobile/**` | Expo Router, React Native specifičnosti |
| `bridge.mdc` | `apps/bridge/**`, `apps/ai-service/**` | Python asyncio, paho-mqtt, FastAPI |
| `testing.mdc` | `**/*.test.ts` | Vitest patterns, mock factory, naming |

---

## GitHub repo

https://github.com/screenfun011/printfarm

---

## Napomene za agenta koji nastavlja

1. **Nikad ne edituj `routeTree.gen.ts` ručno** u apps/web — pokreni `vite dev` da se regeneriše
2. **Nikad ne koristi `otplib`** — koristiti `src/lib/totp.ts`
3. **Nikad ne koristi `pg` ili `node-postgres`** — koristiti `postgres` (postgres.js)
4. **Nikad ne koristi `zustand`** — auth store je custom pub/sub (Set of listeners)
5. **`tenant_id` uvek iz `c.get('tenantId')`** — nikad iz body-a
6. **Drizzle `.returning()` uvek sa null guard** — `if (!result) throw ...`
7. **Python testovi**: `pytest-asyncio` sa `asyncio_mode = "auto"` u `pyproject.toml`
8. **Bridge PRINTERS env** je JSON array string — `json.loads()` u config.py
9. **AI service radi bez modela** — passthrough mode, sve vraća `failure: false`
10. **Super admin sesija = 8h**, tenant user sesija = 30 dana
