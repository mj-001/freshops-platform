# Architecture Documentation

FreshOpsPlatform is a highly modular, secure, full-stack platform designed for robust and compliant Cold-Chain, Warehouse, and Inventory Management Systems. 

## Architectural Overview

The application follows a full-stack SPA & API service design:

```
┌─────────────────────────────────────────────────────────┐
│                    React Client (SPA)                   │
│   (Vite + Tailwind CSS + Lucide Icons + Recharts + motion)│
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ HTTP JSON Requests
┌─────────────────────────────────────────────────────────┐
│               Express API Server (server.ts)            │
│    (Session-auth + API Key Middleware + Mock DB State)  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ Local Persistence
┌─────────────────────────────────────────────────────────┐
│                 State File Sync (state.json)            │
└─────────────────────────────────────────────────────────┘
```

## Core Modules & Subsystems

1. **Inventory & Stock Ledger:**
   - Standard double-entry-like bookkeeping for all warehouse movements.
   - Strictly immutable: PUT/DELETE requests on the ledger are rejected. Real-time reversals are used instead.
   - Temperature zones and FEFO (First Expired First Out) stock selection.

2. **Assembly & Conversion Engine:**
   - Multi-stage recipe conversion tracking with validation, workflow approvals, and automatic yield calculation.

3. **Cold Chain Logistics & Manifest Verification:**
   - Validates multi-temperature zone rules.
   - Implements strict temperature logging requirements before dispatches of chilled/frozen items are permitted.

4. **API and Security Layer:**
   - Uses session-based authentication for interactive panel usage.
   - Implements bearer tokens via API Key prefixes for automated integrations.
   - Standardized rate limiters for both internal and external callers.

## State Management

The server manages a file-backed persistent memory database (`state.json`), representing real stock configurations, assemblies, webhooks, and audit logs. At start-up, if no file exists, the server bootstraps an initial regulatory state config containing pre-defined temperature locations across regional warehouses.
