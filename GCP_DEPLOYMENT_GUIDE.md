# GCP Deployment Guide for RIA Compliance Tool

This guide walks you through deploying the RIA Compliance Tool to Google Cloud Platform (GCP) using Cloud Run, Cloud SQL, and load balancing for a production-ready setup.

## Prerequisites

1. A Google Cloud Platform account
2. Google Cloud SDK installed locally
3. Terraform installed (for infrastructure setup)
4. Docker installed locally

## Step 1: Set Up Google Cloud Project

```bash
# Create a new GCP project (or use an existing one)
gcloud projects create ria-compliance-tool --name="RIA Compliance Tool"
gcloud config set project ria-compliance-tool

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

## Step 2: Set Up Database (Cloud SQL)

```bash
# Create a PostgreSQL instance
gcloud sql instances create ria-compliance-db \
  --database-version=POSTGRES_14 \
  --cpu=1 \
  --memory=4GB \
  --region=us-central1

# Create database and user
gcloud sql databases create ria_compliance_prod --instance=ria-compliance-db
gcloud sql users create ria_app --instance=ria-compliance-db --password=YOUR_SECURE_PASSWORD
```

## Step 3: Set Up Storage (Cloud Storage)

```bash
# Create a bucket for file storage
gcloud storage buckets create gs://ria-compliance-storage --location=us-central1

# Create a bucket for database backups
gcloud storage buckets create gs://ria-compliance-backups --location=us-central1
```

## Step 4: Set Up Secrets

```bash
# Create secrets for environment variables
gcloud secrets create DATABASE_URL --data-file=- << EOF
postgresql://ria_app:YOUR_SECURE_PASSWORD@/ria_compliance_prod?host=/cloudsql/ria-compliance-tool:us-central1:ria-compliance-db
EOF

gcloud secrets create AUTH_SECRET --data-file=- << EOF
$(openssl rand -base64 32)
EOF

# Create secrets for other environment variables
gcloud secrets create S3_ACCESS_KEY_ID --data-file=- << EOF
YOUR_S3_ACCESS_KEY
EOF

gcloud secrets create S3_SECRET_ACCESS_KEY --data-file=- << EOF
YOUR_S3_SECRET_KEY
EOF

# ... create other secrets as needed
```

## Step 5: Build and Push Docker Image

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create ria-compliance-repo \
  --repository-format=docker \
  --location=us-central1

# Build and push the image
gcloud builds submit --tag us-central1-docker.pkg.dev/ria-compliance-tool/ria-compliance-repo/app:latest
```

## Step 6: Deploy to Cloud Run

```bash
# Deploy the service
gcloud run deploy ria-compliance-tool \
  --image us-central1-docker.pkg.dev/ria-compliance-tool/ria-compliance-repo/app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,S3_ACCESS_KEY_ID=S3_ACCESS_KEY_ID:latest,S3_SECRET_ACCESS_KEY=S3_SECRET_ACCESS_KEY:latest
```

## Step 7: Set Up Load Balancing using Terraform

1. Navigate to the `infra` directory
2. Update the Terraform variables in `terraform.tfvars`:

```hcl
# terraform.tfvars
project_id  = "ria-compliance-tool"
region      = "us-central1"
service_name = "ria-compliance-tool"
domain_name = "app.ria-compliance.com"
```

3. Run Terraform:

```bash
terraform init
terraform plan
terraform apply
```

## Step 8: Set Up DNS

1. Get the IP address from Terraform output
2. Create an A record in your DNS provider:
   - Name: app.ria-compliance.com
   - Type: A
   - Value: <IP_ADDRESS_FROM_TERRAFORM>

## Step 9: Set Up CI/CD with Cloud Build

1. Create a `cloudbuild.yaml` file in your repository:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ria-compliance-repo/app:$COMMIT_SHA', '.']
  
  # Push the container image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/ria-compliance-repo/app:$COMMIT_SHA']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
    - 'run'
    - 'deploy'
    - 'ria-compliance-tool'
    - '--image'
    - 'us-central1-docker.pkg.dev/$PROJECT_ID/ria-compliance-repo/app:$COMMIT_SHA'
    - '--region'
    - 'us-central1'
    
  # Run database migrations
  - name: 'us-central1-docker.pkg.dev/$PROJECT_ID/ria-compliance-repo/app:$COMMIT_SHA'
    entrypoint: 'npm'
    args: ['run', 'db:migrate']
    env:
    - 'DATABASE_URL=$$DATABASE_URL'

substitutions:
  _DATABASE_URL: 'from-secret'

availableSecrets:
  secretManager:
  - versionName: projects/$PROJECT_ID/secrets/DATABASE_URL/versions/latest
    env: 'DATABASE_URL'
```

2. Connect your GitHub repository to Cloud Build:
   - Go to Cloud Build > Triggers
   - Connect your GitHub repository
   - Create a trigger that runs on push to main branch

## Step 10: Set Up Database Backups

Create a Cloud Scheduler job to run backups:

```bash
gcloud scheduler jobs create http db-backup \
  --schedule="0 1 * * *" \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/ria-compliance-tool/jobs/db-backup/run" \
  --http-method=POST \
  --oauth-service-account-email=ria-compliance-tool@appspot.gserviceaccount.com
```

## Step 11: Set Up Monitoring

1. Create a custom dashboard in Cloud Monitoring
2. Set up alerts for:
   - Error rates
   - Latency
   - CPU/Memory usage
   - Database connections

## Step 12: Set Up Vertex AI Integration

1. Create a Vertex AI endpoint:

```bash
gcloud ai endpoints create \
  --region=us-central1 \
  --display-name=ria-compliance-ai-endpoint
```

2. Deploy a model to the endpoint:

```bash
gcloud ai models upload \
  --region=us-central1 \
  --display-name=ria-compliance-model \
  --container-image-uri=us-docker.pkg.dev/vertex-ai/prediction/text-bison:latest \
  --artifact-uri=gs://cloud-samples-data/vertex-ai/model-deployment/models/text-bison \
  --endpoint=ria-compliance-ai-endpoint
```

3. Update the environment variables in your Cloud Run service:

```bash
gcloud run services update ria-compliance-tool \
  --set-env-vars=EXTRACTION_PROVIDER=vertex,VERTEX_PROJECT_ID=ria-compliance-tool,VERTEX_LOCATION=us-central1
```

## Conclusion

You now have a production-ready deployment of the RIA Compliance Tool with:

- Containerized application on Cloud Run
- PostgreSQL database on Cloud SQL
- Global load balancer with HTTPS
- Automated CI/CD pipeline
- Database backups
- Monitoring and alerting
- Vertex AI integration

For more information, refer to the Google Cloud documentation.