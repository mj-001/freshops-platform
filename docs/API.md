# FreshOpsPlatform API Reference

The platform hosts standard REST endpoints partitioned under `/api/v1/`.

## Authentication

### Session Authentication
For standard UI clients, log in using username/password.
- **POST** `/api/v1/auth/login`
- **POST** `/api/v1/auth/logout`
- **GET** `/api/v1/auth/current`

### API Key Authentication
For external server integrations, append your header credentials:
```http
Authorization: Bearer fop_YOUR_API_KEY
```

---

## Key Core Endpoints

### 1. Inventory & Locations
- **GET** `/api/v1/warehouses` - Retrieve active warehouses.
- **GET** `/api/v1/locations` - Retrieve bin locations.
- **GET** `/api/v1/warehouses/:id/stock` - Retrieve complete physical batch quantities for a warehouse.

### 2. Conversions & Assembly
- **GET** `/api/v1/assemblies/templates` - Get valid conversion recipes.
- **POST** `/api/v1/assemblies/templates` - Propose a new recipe template.
- **POST** `/api/v1/assembly-orders` - Instigate a raw batch conversion order.

### 3. Logistic Manifests
- **GET** `/api/v1/manifests` - Active transport manifests.
- **POST** `/api/v1/manifests/:id/dispatch` - Dispatches transport with zone validation and temperature checklist logs.

### 4. Cycle Counts & Audits
- **GET** `/api/v1/cycle-counts` - Active audit cycles.
- **POST** `/api/v1/cycle-counts` - Plan audits.
- **POST** `/api/v1/write-offs` - Report damaged/expired inventory assets. Dual approvals are enforced.

---

## Developer OpenAPI Spec

The full OpenAPI JSON serialization is compiled dynamically and accessible directly by browsing:
`http://localhost:3000/api/openapi.json`
