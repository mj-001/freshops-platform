#!/usr/bin/env bash
# One-time GCP resource setup for FreshOpsPlatform Cloud Run deployment.
# Safe to re-run — all commands are idempotent.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project freshops-platform
#
# Usage:
#   bash scripts/gcp-setup.sh

set -euo pipefail

PROJECT_ID="freshops-platform"
REGION="europe-west1"
AR_REPO="freshops"
CR_SA_NAME="freshops-cloudrun"
CR_SA_EMAIL="${CR_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Fetching project number..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "==> Enabling required APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  --project="$PROJECT_ID"

echo "==> Creating Artifact Registry repository..."
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="FreshOpsPlatform Docker images" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (already exists, skipping)"

echo "==> Creating Cloud Run service account..."
gcloud iam service-accounts create "$CR_SA_NAME" \
  --display-name="FreshOps Cloud Run SA" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (already exists, skipping)"

echo "==> Granting Firestore access to Cloud Run SA..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA_EMAIL}" \
  --role="roles/datastore.user" \
  --condition=None

echo "==> Granting Secret Manager access to Cloud Run SA..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

echo "==> Granting Cloud Build SA permission to deploy Cloud Run..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --condition=None

echo "==> Granting Cloud Build SA permission to act as Cloud Run SA..."
gcloud iam service-accounts add-iam-policy-binding "$CR_SA_EMAIL" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"

echo "==> Granting Cloud Build SA Artifact Registry write access..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None

echo ""
echo "==> Creating SESSION_SECRET in Secret Manager..."
echo "    Enter the secret value when prompted (input will be hidden):"
printf "Secret value: "
read -rs SECRET_VALUE
echo ""
printf '%s' "$SECRET_VALUE" | gcloud secrets create SESSION_SECRET \
  --data-file=- \
  --replication-policy=automatic \
  --project="$PROJECT_ID" 2>/dev/null || \
  printf '%s' "$SECRET_VALUE" | gcloud secrets versions add SESSION_SECRET \
    --data-file=- \
    --project="$PROJECT_ID"
echo "  SESSION_SECRET stored."

echo ""
echo "==> Setup complete."
echo ""
echo "Next step — submit your first build:"
echo ""
echo "  gcloud builds submit \\"
echo "    --config=cloudbuild.yaml \\"
echo "    --project=${PROJECT_ID} \\"
echo "    ."
echo ""
