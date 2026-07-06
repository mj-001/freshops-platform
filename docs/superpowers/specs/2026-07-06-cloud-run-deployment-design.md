# Cloud Run Deployment Design — Round 54

**Date:** 2026-07-06
**Project:** FreshOpsPlatform
**Firebase project:** freshops-platform
**Region:** europe-west1

---

## Goal

Deploy the single Express server (API + React SPA) to Cloud Run using a
`cloudbuild.yaml` submitted manually with `gcloud builds submit`. All GCP
resources are created from scratch via a setup script.

---

## Architecture

One Cloud Run service (`freshops-wms`) in `europe-west1` runs the container
built from the existing Dockerfile. The image is stored in Artifact Registry.
Firestore is the database (`DATABASE_ADAPTER=firestore`). The Cloud Run service
account carries Firestore and Secret Manager permissions — no credential JSON
file is needed in the image.

```
Developer
  └─ gcloud builds submit
       └─ Cloud Build
            ├─ docker build (Dockerfile, multi-stage)
            ├─ docker push → Artifact Registry
            └─ gcloud run deploy
                 └─ Cloud Run (freshops-wms, europe-west1)
                      ├─ Firestore (DATABASE_ADAPTER=firestore)
                      └─ Secret Manager (SESSION_SECRET)
```

---

## Files Changed / Created

| File | Action | Purpose |
|---|---|---|
| `server.ts` line 10682 | Edit | Read `process.env.PORT` so Cloud Run health check passes |
| `cloudbuild.yaml` | Create | Build → push → deploy pipeline |
| `scripts/gcp-setup.sh` | Create | One-time GCP resource provisioning |
| `.dockerignore` | Create/verify | Exclude node_modules, .env, state.json from image |

---

## 1. Server PORT Fix

**File:** `server.ts`, line 10682

Change:
```typescript
const PORT = 3000;
```
To:
```typescript
const PORT = parseInt(process.env.PORT || '3000', 10);
```

Cloud Run injects `PORT=8080` at runtime. Without this the container starts
but Cloud Run's health check never gets a response and the service fails to
become healthy.

---

## 2. GCP Resources (scripts/gcp-setup.sh)

One-time setup. Safe to re-run (all commands are idempotent).

### Artifact Registry
```
Repository: freshops
Location:   europe-west1
Format:     DOCKER
Full path:  europe-west1-docker.pkg.dev/freshops-platform/freshops
```

### Cloud Run Service Account
```
Name:  freshops-cloudrun
Email: freshops-cloudrun@freshops-platform.iam.gserviceaccount.com
Roles:
  - roles/datastore.user          (Firestore read/write)
  - roles/secretmanager.secretAccessor (read SESSION_SECRET at startup)
```

### Secret Manager
```
Secret name: SESSION_SECRET
Value:       set interactively via gcloud secrets versions add
```

### Cloud Build Permissions
The default Cloud Build service account
(`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`) needs two extra roles
to deploy Cloud Run:
```
  - roles/run.admin
  - roles/iam.serviceAccountUser  (scoped to freshops-cloudrun SA)
```

---

## 3. cloudbuild.yaml

Three steps: build, push, deploy.

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'IMAGE:$COMMIT_SHA', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'IMAGE:$COMMIT_SHA']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - freshops-wms
      - --image=IMAGE:$COMMIT_SHA
      - --region=europe-west1
      - --service-account=freshops-cloudrun@freshops-platform.iam.gserviceaccount.com
      - --set-env-vars=DATABASE_ADAPTER=firestore,DATABASE_URL=freshops-platform,...
      - --set-secrets=SESSION_SECRET=SESSION_SECRET:latest
      - --allow-unauthenticated
      - --min-instances=0
      - --max-instances=3
      - --memory=512Mi
      - --cpu=1
      - --port=8080
      - --platform=managed

images:
  - IMAGE:$COMMIT_SHA
```

IMAGE = `europe-west1-docker.pkg.dev/freshops-platform/freshops/wms`

### Environment variables set on the Cloud Run service

| Variable | Value | Source |
|---|---|---|
| `DATABASE_ADAPTER` | `firestore` | plain env var |
| `DATABASE_URL` | `freshops-platform` | plain env var |
| `NODE_ENV` | `production` | plain env var |
| `PLATFORM_NAME` | `FreshOpsPlatform` | plain env var |
| `TENANT_ID` | `default` | plain env var |
| `TENANT_NAME` | `Default Operator` | plain env var |
| `SESSION_SECRET` | — | Secret Manager `SESSION_SECRET:latest` |

`STATE_FILE_PATH` is not set — with `DATABASE_ADAPTER=firestore` it is unused.
`GOOGLE_APPLICATION_CREDENTIALS` is not set — `applicationDefault()` uses the
attached service account automatically on Cloud Run.

---

## 4. .dockerignore

Ensure these are excluded from the build context:
```
node_modules/
.env
state.json
*.bak
docs/
```

---

## 5. Deployment Command

After setup script has run once:
```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=freshops-platform \
  "c:\Users\Administrator\fresh-ops platform\freshops-platform"
```

---

## 6. Verification

After deploy, confirm:
```bash
curl -X POST https://<CLOUD_RUN_URL>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```
Expected: `200 OK` with `{ token, user, must_reset_password }`.

---

## What is NOT in scope for Round 54

- Firebase Auth (JWT token verification) — Round 55+
- CI/CD push trigger — can be added in a future round by pointing a Cloud Build
  trigger at `cloudbuild.yaml`
- Custom domain / HTTPS certificate — Cloud Run provides a default HTTPS URL
- Flutter mobile app — Round 55+
