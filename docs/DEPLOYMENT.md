# Deployment Protocols

FreshOpsPlatform can be deployed to various container clouds and standard server environments.

## Deployment Target Options

### 1. Docker-Based Deployment (Standalone)
We supply both continuous deployment files: `Dockerfile` and `docker-compose.yml`.

To deploy:
```bash
docker-compose up -d --build
```
This builds structural files locally, binds to port `3000`, and runs standard offline data syncing.

### 2. Cloud Run / Container Platforms
The application's `Dockerfile` compiles Vite assets and launches Node’s production bundle. Simply configure the target port to `3000` from the orchestrator configuration.

Ensure critical secrets (`GEMINI_API_KEY`, `SESSION_SECRET`) are mapped from GCP or Vault securely.

## Configuration Variables
Provide these values through operational environment arguments:

| Variable Name | Description | Default |
|---|---|---|
| `PLATFORM_NAME` | Master banner title | `FreshOpsPlatform` |
| `SESSION_SECRET` | Keeps JWT cookie hashes secure | `change-this-in-production` |
| `STATE_FILE_PATH` | Host folder path for state save sync | `./state.json` |
| `DELIVERY_LATE_HOURS` | Late threshold for logs alerts | `3` |


## Firebase / Firestore Deployment

FreshOpsPlatform supports Firestore as a production database backend
via the `DATABASE_ADAPTER=firestore` environment variable.

### Prerequisites

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore in Native mode (not Datastore mode)
3. Select a region close to your users (e.g. `europe-west1` for
   Africa — this is currently the closest Firebase region to East
   Africa)
4. Go to Project Settings → Service Accounts → Generate New Private Key
5. Download the JSON key file and store it securely (never commit
   this file to Git)

### Environment variables

```
DATABASE_ADAPTER=firestore
DATABASE_URL=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
```

### Docker deployment

Mount the service account file into the container:

```yaml
services:
  freshops_wms:
    environment:
      - DATABASE_ADAPTER=firestore
      - DATABASE_URL=your-project-id
      - GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase_sa
    secrets:
      - firebase_sa

secrets:
  firebase_sa:
    file: ./serviceAccount.json
```

### Local development with Firebase Emulator

```bash
npm install -g firebase-tools
firebase login
firebase init emulators  # select Firestore
firebase emulators:start
```

Then set in .env:
```
DATABASE_ADAPTER=firestore
DATABASE_URL=freshops-local
FIRESTORE_EMULATOR_HOST=localhost:8080
```

### Migrating existing data from JSON to Firestore

A one-time migration script is planned. Until then, the system
starts fresh on Firestore — existing state.json data is not
automatically imported. To import manually, use the Firebase
Admin SDK's `saveAll()` method in the FirestoreAdapter with your
existing state.json contents.
