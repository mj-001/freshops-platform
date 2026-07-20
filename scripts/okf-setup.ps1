# scripts\okf-setup.ps1
# Provisions GCP resources required by the FreshOps OKF digital-twin exporter.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - PROJECT_ID set as an environment variable, or supplied as a parameter
#
# Usage:
#   .\scripts\okf-setup.ps1 -ProjectId my-gcp-project -Region us-central1

param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectId = $env:PROJECT_ID,

    [Parameter(Mandatory = $false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory = $false)]
    [string]$JobName = "freshops-okf-exporter",

    [Parameter(Mandatory = $false)]
    [string]$BucketName = "",

    [Parameter(Mandatory = $false)]
    [string]$GithubRepoUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$ServiceAccountName = "freshops-okf-sa"
)

if (-not $ProjectId) {
    Write-Error "ProjectId is required. Set the PROJECT_ID environment variable or pass -ProjectId."
    exit 1
}

if (-not $BucketName) {
    $BucketName = "$ProjectId-okf-bundles"
}

$ImageName = "gcr.io/$ProjectId/freshops-okf-exporter"
$ServiceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"

Write-Host ""
Write-Host "============================================================"
Write-Host " FreshOps OKF Exporter - GCP Setup"
Write-Host "============================================================"
Write-Host " Project:         $ProjectId"
Write-Host " Region:          $Region"
Write-Host " Cloud Run Job:   $JobName"
Write-Host " GCS Bucket:      $BucketName"
Write-Host " Image:           $ImageName"
Write-Host " Service Account: $ServiceAccountEmail"
Write-Host "============================================================"
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1: Enable required APIs
# ---------------------------------------------------------------------------
Write-Host "[1/7] Enabling required GCP APIs..."
$apis = @(
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com"
)
foreach ($api in $apis) {
    Write-Host "  Enabling $api ..."
    gcloud services enable $api --project=$ProjectId --quiet
}
Write-Host "  APIs enabled."

# ---------------------------------------------------------------------------
# Step 2: Create service account
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/7] Creating service account $ServiceAccountName ..."
$saExists = gcloud iam service-accounts list --project=$ProjectId --filter="email:$ServiceAccountEmail" --format="value(email)" 2>$null
if ($saExists) {
    Write-Host "  Service account already exists — skipping."
} else {
    gcloud iam service-accounts create $ServiceAccountName `
        --display-name="FreshOps OKF Exporter" `
        --project=$ProjectId
    Write-Host "  Service account created."
}

# Grant Firestore access
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/datastore.viewer" `
    --quiet | Out-Null

Write-Host "  Granted roles/datastore.viewer"

# ---------------------------------------------------------------------------
# Step 3: Create GCS bucket
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/7] Creating GCS bucket gs://$BucketName ..."
$bucketExists = gsutil ls -b "gs://$BucketName" 2>$null
if ($bucketExists) {
    Write-Host "  Bucket already exists — skipping."
} else {
    gsutil mb -p $ProjectId -l $Region "gs://$BucketName"
    Write-Host "  Bucket created."
}

# Grant storage access to service account
gsutil iam ch "serviceAccount:${ServiceAccountEmail}:roles/storage.objectCreator" "gs://$BucketName"
Write-Host "  Granted storage.objectCreator on bucket."

# ---------------------------------------------------------------------------
# Step 4: Build and push Docker image
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/7] Building and pushing OKF exporter image..."
Write-Host "  Image: $ImageName"
gcloud builds submit . `
    --config=cloudbuild-okf.yaml `
    --substitutions="_PROJECT_ID=$ProjectId,_REGION=$Region,_JOB_NAME=$JobName,_IMAGE=$ImageName" `
    --project=$ProjectId

Write-Host "  Image built and pushed."

# ---------------------------------------------------------------------------
# Step 5: Create (or update) Cloud Run Job
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[5/7] Creating Cloud Run Job $JobName ..."

$envVars = @(
    "DATABASE_ADAPTER=firestore",
    "DATABASE_URL=$DatabaseUrl",
    "GCS_BUCKET=$BucketName"
)

if ($GithubRepoUrl) {
    $envVars += "GITHUB_REPO_URL=$GithubRepoUrl"
}

$envVarsStr = $envVars -join ","

$jobExists = gcloud run jobs describe $JobName --region=$Region --project=$ProjectId 2>$null
if ($jobExists) {
    Write-Host "  Job exists — updating..."
    gcloud run jobs update $JobName `
        --image="$ImageName`:latest" `
        --region=$Region `
        --project=$ProjectId `
        --service-account=$ServiceAccountEmail `
        --set-env-vars=$envVarsStr `
        --max-retries=1 `
        --quiet
} else {
    gcloud run jobs create $JobName `
        --image="$ImageName`:latest" `
        --region=$Region `
        --project=$ProjectId `
        --service-account=$ServiceAccountEmail `
        --set-env-vars=$envVarsStr `
        --max-retries=1 `
        --quiet
}
Write-Host "  Cloud Run Job ready."

# ---------------------------------------------------------------------------
# Step 6: Create Cloud Scheduler job (nightly at 02:00 UTC)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[6/7] Creating Cloud Scheduler job to run nightly at 02:00 UTC ..."
$schedulerName = "$JobName-nightly"
$schedulerSa = "$(gcloud iam service-accounts list --project=$ProjectId --filter='displayName:Compute Engine default' --format='value(email)' 2>$null)"

$schedulerExists = gcloud scheduler jobs describe $schedulerName --location=$Region --project=$ProjectId 2>$null
$invokeUri = "https://${Region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${ProjectId}/jobs/${JobName}:run"

if ($schedulerExists) {
    Write-Host "  Scheduler job exists — updating..."
    gcloud scheduler jobs update http $schedulerName `
        --schedule="0 2 * * *" `
        --uri=$invokeUri `
        --http-method=POST `
        --oauth-service-account-email=$ServiceAccountEmail `
        --location=$Region `
        --project=$ProjectId `
        --quiet
} else {
    gcloud scheduler jobs create http $schedulerName `
        --schedule="0 2 * * *" `
        --uri=$invokeUri `
        --http-method=POST `
        --oauth-service-account-email=$ServiceAccountEmail `
        --location=$Region `
        --project=$ProjectId `
        --quiet
}
Write-Host "  Scheduler job created/updated."

# ---------------------------------------------------------------------------
# Step 7: Grant Cloud Run invoker role to service account
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[7/7] Granting Cloud Run Invoker role to service account..."
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/run.invoker" `
    --quiet | Out-Null
Write-Host "  roles/run.invoker granted."

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================"
Write-Host " Setup complete!"
Write-Host "============================================================"
Write-Host ""
Write-Host " Test the job manually:"
Write-Host "   gcloud run jobs execute $JobName --region=$Region --project=$ProjectId"
Write-Host ""
Write-Host " View job logs:"
Write-Host "   gcloud run jobs executions list --job=$JobName --region=$Region --project=$ProjectId"
Write-Host ""
Write-Host " OKF bundle will be written to:"
Write-Host "   gs://$BucketName/okf/"
if ($GithubRepoUrl) {
    Write-Host ""
    Write-Host " And pushed to:"
    Write-Host "   $GithubRepoUrl"
}
Write-Host ""
