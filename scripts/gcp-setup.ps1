# One-time GCP resource setup for FreshOpsPlatform Cloud Run deployment.
# Safe to re-run — all commands are idempotent.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project freshops-platform
#
# Usage:
#   .\scripts\gcp-setup.ps1

$ErrorActionPreference = 'Stop'

$PROJECT_ID  = "freshops-platform"
$REGION      = "europe-west1"
$AR_REPO     = "freshops"
$CR_SA_NAME  = "freshops-cloudrun"
$CR_SA_EMAIL = "${CR_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

Write-Host "==> Fetching project number..."
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$CB_SA = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

Write-Host "==> Enabling required APIs..."
gcloud services enable `
  artifactregistry.googleapis.com `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com `
  firestore.googleapis.com `
  --project=$PROJECT_ID

Write-Host "==> Creating Artifact Registry repository..."
$null = gcloud artifacts repositories create $AR_REPO `
  --repository-format=docker `
  --location=$REGION `
  --description="FreshOpsPlatform Docker images" `
  --project=$PROJECT_ID 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "  (already exists, skipping)" }

Write-Host "==> Creating Cloud Run service account..."
$null = gcloud iam service-accounts create $CR_SA_NAME `
  --display-name="FreshOps Cloud Run SA" `
  --project=$PROJECT_ID 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "  (already exists, skipping)" }

Write-Host "==> Granting Firestore access to Cloud Run SA..."
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:${CR_SA_EMAIL}" `
  --role="roles/datastore.user" `
  --condition=None

Write-Host "==> Granting Secret Manager access to Cloud Run SA..."
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:${CR_SA_EMAIL}" `
  --role="roles/secretmanager.secretAccessor" `
  --condition=None

Write-Host "==> Granting Cloud Build SA permission to deploy Cloud Run..."
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:${CB_SA}" `
  --role="roles/run.admin" `
  --condition=None

Write-Host "==> Granting Cloud Build SA permission to act as Cloud Run SA..."
gcloud iam service-accounts add-iam-policy-binding $CR_SA_EMAIL `
  --member="serviceAccount:${CB_SA}" `
  --role="roles/iam.serviceAccountUser" `
  --project=$PROJECT_ID

Write-Host "==> Granting Cloud Build SA Artifact Registry write access..."
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:${CB_SA}" `
  --role="roles/artifactregistry.writer" `
  --condition=None

Write-Host ""
Write-Host "==> Creating SESSION_SECRET in Secret Manager..."
Write-Host "    Enter the secret value when prompted (input will be hidden):"
$SecureValue = Read-Host "Secret value" -AsSecureString
$SecretValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
)

$TempFile = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllText($TempFile, $SecretValue, [System.Text.Encoding]::UTF8)

  $null = gcloud secrets create SESSION_SECRET `
    --data-file=$TempFile `
    --replication-policy=automatic `
    --project=$PROJECT_ID 2>&1
  if ($LASTEXITCODE -ne 0) {
    gcloud secrets versions add SESSION_SECRET `
      --data-file=$TempFile `
      --project=$PROJECT_ID
  }
} finally {
  Remove-Item $TempFile -Force -ErrorAction SilentlyContinue
}
Write-Host "  SESSION_SECRET stored."

Write-Host ""
Write-Host "==> Setup complete."
Write-Host ""
Write-Host "Next step — submit your first build:"
Write-Host ""
Write-Host '  gcloud builds submit `'
Write-Host '    --config=cloudbuild.yaml `'
Write-Host ('    --project=' + $PROJECT_ID + ' `')
Write-Host '    .'
Write-Host ""
