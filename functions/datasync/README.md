Cloud Function for Processing CSV Files

This Cloud Function processes CSV files uploaded to a Google Cloud Storage bucket. It parses the content of the CSV and performs database operations based on the data.

## How to Test FOR local environment.

### 1. Start the containers

```
make install

```

### 2. Create a bucket

``` bash
curl -X POST --insecure -H "Content-Type: application/json"   -d '{"name": "ligla-chat-data"}'   http://localhost:4443/storage/v1/b?project=nt-tt-chat-test
```

### 3. Upload a test CSV file to the storage emulator
*Store data sync*

``` bash
curl -X POST \
     --data-binary @functions/datasync/temp/ligla_chat-store_data-20250207_133705.csv \
     "http://localhost:4443/upload/storage/v1/b/ligla-chat-data/o?uploadType=media&name=ligla_chat-store_data-20250207_133705.csv"
```
*Member feed alias data sync*

``` bash
curl -X POST \
     --data-binary @functions/datasync/temp/ligla_chat-client_users-20250207_133705.csv \
     "http://localhost:4443/upload/storage/v1/b/ligla-chat-data/o?uploadType=media&name=ligla_chat-client_users-20250207_133705.csv"
```
*Survey feed alias data sync*

``` bash
curl -X POST \
     --data-binary @functions/datasync/temp/ligla_chat-additions-20250207_133705.csv \
     "http://localhost:4443/upload/storage/v1/b/ligla-chat-data/o?uploadType=media&name=ligla_chat-additions-20250207_133705.csv"
```

### 4. Trigger the Cloud Function with a test event
*Store data sync*

``` bash
curl -X POST http://localhost:9090 \
     -H "Content-Type: application/json" \
     -d '{
           "bucket": "ligla-chat-data",
           "name": "ligla_chat-store_data-20250207_133705.csv"
         }'
```

*Member feed alias data sync*
``` bash
curl -X POST http://localhost:9090 \
     -H "Content-Type: application/json" \
     -d '{
           "bucket": "ligla-chat-data",
           "name": "ligla_chat-client_users-20250207_133705.csv"
         }'
```
*Survey feed alias data sync*
``` bash
curl -X POST http://localhost:9090 \
     -H "Content-Type: application/json" \
     -d '{
           "bucket": "ligla-chat-data",
           "name": "ligla_chat-additions-20250207_133705.csv"
         }'
```

## How to Deploy

### 1. Set Your GCP Project

```
gcloud config set project [PROJECT_ID]
```

### 2. Check your GCP Project

```
gcloud config configurations list
```

### 3. Deploy the Function: Deploy the Cloud Function with the following command

run

```
make deploy-stg-func-datasync
```

# [HELPFUL] Enable required GCP services

```
gcloud services enable \
    cloudfunctions.googleapis.com \
    pubsub.googleapis.com \
    cloudbuild.googleapis.com \
    logging.googleapis.com \
    eventarc.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    --quiet
```

# Set derived variables

```
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
```

```
export GCS_SERVICE_ACCOUNT=$(gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.members)" --filter="bindings.role:roles/storage.legacyBucketOwner AND bindings.members~storage")
```

Prepare to deploy

```
SERVICE_ACCOUNT="{SERVICE_ACCOUNT_NAME}@{GCP_PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_ID=<GCP_PROJECT_ID>
# Get project number using gcloud command
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
```

# Add IAM bindings

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/artifactregistry.reader"
```

```
gcloud projects add-iam-policy-binding $PROJECT_NUMBER \
    --member "serviceAccount:$SERVICE_ACCOUNT" \
    --role "roles/pubsub.publisher"
```

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/storage.objectCreator"
```

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/run.invoker"
```

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/eventarc.eventReceiver"
```
