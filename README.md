# FreshOpsPlatform

**Open source operations platform for fresh food and cold chain businesses.**

Built for D2C and B2B fresh food operators in emerging markets.
FEFO picking, cold chain compliance, FPO replenishment, BOM
production, batch traceability, product bundles, custom roles and
permissions, and product recall management — in one system.

[![Licence: AGPL-3.0](https://img.shields.io/badge/Licence-AGPL--3.0-blue)](LICENCE)

## Who it's for

Fresh food businesses that need warehouse management with cold
chain integrity, supplier-to-customer batch traceability,
replenishment between warehouses and fulfilment points, kitchen
production with yield tracking, packing accountability separate
from picking, and product recall management.

## Architecture

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + Vite + Tailwind CSS
- **Storage:** JSON file (development) — Firebase/Firestore (production, planned)
- **Analytics:** BigQuery (production, planned)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Formal verification

Five core modules — stock ledger integrity, FEFO pick generation,
assembly completion, FPO receiving, and bundle resolution — have
been formally specified and model-checked with TLA+/TLC. See
[docs/formal-spec/](docs/formal-spec/) for the specifications and
their verified invariants.

## Quick start

Prerequisites: Node.js 18+

```bash
git clone https://github.com/freshops-platform/freshops
cd freshops
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**

The setup wizard runs on first launch — no manual configuration
required to get started.

## Docker

```bash
cp .env.example .env
docker-compose up
```

State persists in a Docker-managed volume. The app runs on
http://localhost:3000 in this mode.

## API

All endpoints at `/api/v1/`

**OpenAPI spec:** `GET /api/v1/openapi.json`

**Authentication:**
- Session (web app): `POST /api/v1/auth/login`
- API keys (integrations): `Authorization: Bearer fop_yourkey`

**Event stream:** `GET /api/v1/events?since=CURSOR` for external sync

Full reference: [docs/API.md](docs/API.md)

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Licence

AGPL-3.0. See [LICENCE](LICENCE).

Copyright (C) 2026 Lumara Holdings.
