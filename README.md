# PVIntell

PVIntell is an AI-first workspace for designing, building, commissioning, monitoring, and diagnosing solar power systems. The user describes what they want in ordinary language; Wattson turns that into a structured, explainable system design.

## MVP

- Wattson-first natural-language onboarding with beginner-friendly defaults
- Persistent structured demo project and visible assumption tracking
- Independent load, solar, battery, and inverter calculators
- Simple/technical system topology views
- Safety-aware installation stages and permanent commissioning records
- Manufacturer-independent telemetry, mock inverter/BMS drivers, and rule diagnostics
- Monitoring dashboard, mock weather, seeded 48 V off-grid home, and widget API
- PostgreSQL/Supabase Prisma schema covering the complete project lifecycle

The demo runs without credentials. Browser edits persist in `localStorage`; the schema is ready for live Supabase persistence once database connection variables are supplied.

## Setup

Requirements: Node.js 20.9+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Do not commit `.env.local`.

The supplied Supabase endpoint belongs in `NEXT_PUBLIC_SUPABASE_URL`. Add its anon key for client APIs. Prisma additionally needs the pooled `DATABASE_URL` and migration-safe `DIRECT_URL` shown in Supabase Database → Connect.

The initial Supabase migration is [supabase/migrations/202608140001_initial_pvintell.sql](supabase/migrations/202608140001_initial_pvintell.sql). It creates Auth-linked profiles, all MVP tables, private project-photo storage, signup triggers, and owner-only row-level security policies. Apply it once with the Supabase CLI or paste it into the project's SQL Editor.

```bash
supabase link --project-ref ewrbdrglvjacsyfqlrym
supabase db push
```

Supabase Auth remains the identity authority. Do not create passwords or sessions in the `profiles` table; it stores only application-facing profile information keyed to `auth.users.id`.

```bash
npm run db:generate
npm run db:push
```

## Architecture

```text
src/app             Next.js routes and compact widget API
src/components      Wattson-first product workspace
src/domain          Project types and pure calculation engine
src/ai              Project-aware AIProvider and mock provider
src/telemetry       Normalized measurements and DeviceDriver interface
src/diagnostics     Deterministic rules consumed by Wattson
src/weather         WeatherProvider and mock forecast
src/persistence     Storage adapter (browser MVP; Prisma next)
src/data            Seeded realistic demo system and telemetry
prisma              PostgreSQL data model
```

The structured `Project` is the source of truth. Conversation is an input mechanism, not the database: user statements update loads and assumptions, calculators derive recommendations, and Wattson explains those results using project context.

### AI

`AIProvider` separates orchestration from any model vendor. Its methods cover chat, system analysis, fault diagnosis, recommendation explanation, installation, and commissioning. `MockAIProvider` makes the MVP deterministic without API credentials. A production provider should receive only the structured `WattsonContext`, enforce authorization, and retain tool/audit records.

### Telemetry and hardware

All downstream features consume normalized keys such as `battery.soc`, `pv.power`, and `inverter.state`. Manufacturer payloads must be translated inside a `DeviceDriver`; they never leak into UI or AI code. The included `MockInverterDriver` and `MockBMSDriver` demonstrate the boundary. Future Modbus, CAN, serial, LAN, Bluetooth, or cloud drivers implement the same interface.

Timestamped measurements, faults, events, and alerts have indexed Prisma entities. At production scale, retention/downsampling can move into TimescaleDB or Supabase scheduled jobs without changing the normalized application contract.

### Safety decision

Installation steps explicitly classify user-level, low-voltage, high-current DC, and licensed work. Wattson may explain and collect results, but the UI never presents regulated or hazardous electrical work as trivial.

## APIs

`GET /api/widget` returns a compact normalized payload for future mobile widgets:

```json
{"pvPower":3820,"loadPower":1240,"batterySoc":78,"batteryPower":2487,"batteryDirection":"charging","systemStatus":"normal"}
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

The repository includes `vercel.json`. Import the Git repository in Vercel or run `npx vercel`. Add Supabase/AI environment variables in Vercel Project Settings; use separate Supabase credentials for preview and production where possible.

## Next monitoring integrations

1. Add a server-only Prisma repository and Supabase Auth/RLS policies.
2. Implement one real driver behind a gateway/collector service.
3. Stream normalized readings through a durable ingestion route.
4. Add historical aggregation, alert delivery, and weather-adjusted generation forecasts.
5. Replace the mock AI provider with a tool-using provider and evaluated safety policy.
