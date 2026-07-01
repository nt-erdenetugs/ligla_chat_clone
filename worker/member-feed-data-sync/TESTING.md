# Member Feed Data Sync - Manual Testing Guide

This guide provides step-by-step instructions for manually testing the member-feed-data-sync service to verify the end-to-end data processing pipeline with proper organization handling and **schema-per-tenant** data isolation.

> **Architecture Note**: This service uses schema-per-tenant isolation where each organization has its own PostgreSQL schema (`org_{uuid}`). Data is inserted directly into the tenant's schema, not partitioned tables.

## Prerequisites

- Docker and Docker Compose installed
- Access to the Ligla Chat development environment
- Basic knowledge of curl commands and CSV file structure
- For deployment testing: `gcloud` CLI configured with appropriate permissions

## Deployment

To deploy the member sync worker for testing:

```bash
./deploy-local.sh deploy-member-sync
```

## File Structure & Buckets

- **Local Development**: `ligla-chat-data` (GCS emulator)
- **Staging**: `ligla-chat-data-stg`  
- **Production**: `ligla-chat-data-prd`

**File Path Structure**: `{org_name}/client_users/{org_name}-client_user_data-{YYYYMMDD_HHMMSS}.csv`

## Test Environment Setup

1. **Start the development environment**:
   ```bash
   cd /path/to/ligla_chat
   make install
   ```

2. **Verify services are running**:
   ```bash
   docker-compose ps
   ```

   Expected services:
   - `postgres` (database)
   - `storage-emulator` (GCS emulator)
   - `chat-member-feed-sync` (our service)

3. **Check service health**:
   ```bash
   curl http://localhost:8081/health
   ```
   Expected response: `{"status":"healthy"}`

## Sample Test Data

Use sample file in ./temp/ligla_chat-client_user_data-20250826_120000.csv.gz

**Note**: The `organization_name` column in the CSV will be ignored by the service as it uses the organization name extracted from the file path instead.

## Manual Testing Steps

### Step 1: Create bucket

```bash
curl -X POST --insecure -H "Content-Type: application/json"   -d '{"name": "ligla-chat-data"}'   http://localhost:4443/storage/v1/b?project=nt-tt-chat-test
```

### Step 2: Upload Test Data

Upload the CSV file to the GCS emulator client_users directory:

```bash
curl -X POST \
     --data-binary @worker/member-feed-data-sync/temp/ligla_chat-client_user_data-20250826_120000.csv.gz \
     "http://localhost:4443/upload/storage/v1/b/ligla-chat-data/o?uploadType=media&name=ligla_chat/client_users/ligla_chat-client_user_data-20250826_120000.csv.gz"
```

**Expected Result**: JSON response confirming file upload with `"name": "ligla_chat/client_users/ligla_chat-client_user_data-YYYYMMDD_HHMMSS.csv"`

### Step 3: Verify File Upload

List files in the bucket to confirm upload:

```bash
curl -s "http://localhost:4443/storage/v1/b/ligla-chat-data/o" | grep "ligla_chat/client_users"
```

**Expected Result**: File appears in the client_users directory.

### Step 4: Process the File

Trigger the sync process for the uploaded file:

```bash
# Replace FILENAME with your actual uploaded filename
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"file_path": "ligla_chat/client_users/ligla_chat-client_user_data-20250826_120000.csv.gz"}' \
  "http://localhost:8081/sync/file"
```

**Expected Result**:
```json
{
  "success": true,
  "organization": "ligla_chat",
  "file_path": "ligla_chat/client_users/ligla_chat-client_user_data-YYYYMMDD_HHMMSS.csv.gz",
  "processed_at": "2024-01-17T10:30:00.000000+00:00"
}
```

### Step 5: Verify File Processing

Check that the file was moved to the processed directory:

```bash
curl -s "http://localhost:4443/storage/v1/b/ligla-chat-data/o" | grep "ligla_chat/client_users/processed"
```

**Expected Result**: File appears in the client_users/processed directory, confirming successful processing.

### Step 6: Verify Organization Creation

Check that the organization was automatically created in the database:

```bash
docker compose exec postgres psql -U ligla_user -d ligla_local -c "SELECT * FROM organization WHERE name = 'ligla_chat';"
```

**Expected Result**:
```
   name   |         displayName          | ... | apiKey
----------+------------------------------+-----+----------------------
 ligla_chat | ligla_chat | ... | test-api-key-ligla_chat
```

### Step 6: Verify Data Import

Check if the data was imported into the memberFeedData table:

```bash
docker compose exec postgres psql -U ligla_user -d ligla_local -c "SELECT COUNT(*) as record_count FROM \"memberFeedData\" WHERE \"organizationName\" = 'ligla_chat';"
```

**Expected Result**:
```
 record_count
--------------
            18
```

### Step 7: Test Organization-Specific Sync

Test processing all files for a specific organization:

```bash
curl -X POST "http://localhost:8081/sync/ligla_chat"
```

**Expected Result**: Either successful processing or "No pending files found" if all files are already processed.

## Testing with Real GCS (Staging Environment)

For testing against the actual staging environment (as shown in your evidence log):

### Upload Test File to Staging GCS

```bash
# Upload the test file directly to staging bucket
gcloud storage cp temp/ligla_chat-client_user_data-20250826_120000.csv gs://ligla-chat-data-stg/nasha_tech/client_users/nasha_tech-client_user_data-$(date +%Y%m%d_%H%M%S).csv
```

### Trigger Processing via Staging Service

```bash
# Call the staging Cloud Run service directly
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"file_path": "nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv"}' \
  "https://chat-member-feed-sync-{service_id}.asia-northeast1.run.app/sync/file"
```

### Verify Processing in Staging

Check the staging logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chat-member-feed-sync" --limit=50 --format="table(timestamp,textPayload)" --project=your-project-id
```

### Step 8: Monitor Processing Logs

Check the service logs during processing to see the structured logging:

```bash
docker-compose logs --tail=20 member-feed-data-sync
```

**Expected Log Messages**:
```
[HTTP_REQUEST] Received file event: {'file_path': 'nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv'}
[HTTP_REQUEST] Processing simple file event: nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv
[HTTP_REQUEST] About to process file: nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv
Starting file-specific sync: nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Starting sync.
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 1/6: Validating file...
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] File validation successful. GCS URI: gs://ligla-chat-data-local/nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 2/6: Preparing database and creating staging table...
Organization nasha_tech already exists (or created automatically)
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Staging table created: memberfeeddata_nasha_tech_staging_YYYYMMDD_HHMMSS
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 3/6: Importing data from CSV...
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Using CLOUD SQL API mode (or LOCAL COPY mode for local testing).
Starting Cloud SQL Admin API streaming import: gs://ligla-chat-data-local/... -> memberfeeddata_nasha_tech_staging_...
Creating transformed CSV: ... -> gs://ligla-chat-data-local/temp/temp_transformed_nasha_tech_....csv
Processing BigQuery CSV with headers: ['client_user_id', 'organization_name', 'category_1', 'number_1']
WARNING - IGNORING redundant 'organization_name' column in source CSV. Using org_name parameter: 'nasha_tech'
Column mapping: {0: 'clientUserId', 2: 'category1', 3: 'number1'}
Transformed 3 rows for nasha_tech
Starting Cloud SQL import operation for nasha_tech
Cloud SQL import operation started: [operation-id]
Operation Status: RUNNING, Poll #1, Elapsed: 0.0s
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] CSV import successful. Imported 3 records in X.XX seconds.
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 4/6: Swapping data to tenant schema...
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Data swap completed in X.XX seconds. 3 records now active in org_{uuid}.memberFeedData.
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 5/6: Verifying imported data...
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Data verification passed: 3 records confirmed in main table.
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] Step 6/6: Finalizing and cleaning up...
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] File moved to processed: nasha_tech/client_users/processed/nasha_tech-client_user_data-20250826_120000.csv
[SYNC_WORKFLOW][org:nasha_tech][file:nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv] 🎉 SUCCESS: Sync completed in X.XX seconds. Total records synced: 3.
SYNC_COMPLETE - Organization: nasha_tech, Records: 3, Duration: X.XX seconds, Status: SUCCESS
[HTTP_RESPONSE] SUCCESS: File sync completed successfully for nasha_tech/client_users/nasha_tech-client_user_data-20250826_120000.csv
```

## Validation Checklist

✅ **Service Health**: `/health` endpoint returns HTTP 200
✅ **File Upload**: CSV successfully uploaded to GCS emulator
✅ **File Processing**: API returns `"success": true`
✅ **File Lifecycle**: File moved from `/client_users/` to `/client_users/processed/`
✅ **Organization Creation**: `nasha_tech` exists in database
✅ **Data Import**: Records visible in `memberFeedData` table
✅ **No Errors**: No database constraint errors in logs

## Troubleshooting

### Common Issues

1. **"File not found" error**:
   - Verify file was uploaded correctly
   - Check exact filename in the API call

2. **Database constraint errors**:
   - Organization should be automatically created during sync
   - Check organization creation logs if errors persist

3. **Service unhealthy**:
   ```bash
   docker compose logs member-feed-data-sync
   ```

4. **Database connection issues**:
   ```bash
   docker compose logs postgres
   ```

### Debug Commands

**View service logs**:
```bash
docker compose logs --tail=50 member-feed-data-sync
```

**Check database connectivity**:
```bash
docker compose exec postgres psql -U ligla_user -d ligla_local -c "SELECT current_database();"
```

**List all tables**:
```bash
docker compose exec postgres psql -U ligla_user -d ligla_local -c "\dt"
```

## Test Scenarios

### Scenario 1: New Organization (Primary Test)
- Upload CSV for a new organization name
- Verify automatic organization creation
- Confirm data processing without database constraint errors

### Scenario 2: Existing Organization
- Process another file for the same organization
- Verify data is added/updated correctly in tenant schema
- Check data swap operation completes successfully

### Scenario 3: Multiple Files
- Upload multiple CSV files for different organizations
- Test batch processing with `/sync` endpoint
- Verify each organization is processed independently

### Scenario 4: Error Handling
- Upload an invalid CSV file
- Verify graceful error handling
- Check that file is moved to `/members/failed/` directory

## Expected Performance

- **File Upload**: < 1 second for small test files
- **Processing Time**: < 5 seconds for 100 records
- **API Response**: < 200ms for health checks
- **Memory Usage**: Service should remain stable

## Clean Up

After testing, clean up test data:

```bash
# Remove test organizations (optional)
docker compose exec postgres psql -U ligla_user -d ligla_local -c "DELETE FROM organization WHERE name = 'ligla_chat';"

# Clear test files from storage (they're in emulator, will be lost on restart)
docker compose restart storage-emulator
```

## Success Criteria

The sync process is working correctly when:

1. ✅ CSV files process successfully without database constraint errors
2. ✅ Organizations have tenant schemas provisioned (`org_{uuid}`)
3. ✅ Files are moved to `/client_users/processed/` directory after successful processing
4. ✅ Data appears in the tenant schema's `memberFeedData` table
5. ✅ Service remains healthy and responsive throughout testing
6. ✅ Advisory locks prevent concurrent processing for same organization

---

**Note**: This testing guide validates the complete end-to-end data processing pipeline with schema-per-tenant data isolation. All steps should complete without database constraint violations.

For more detailed schema-per-tenant verification, see [TESTING_SCHEMA_PER_TENANT.md](./TESTING_SCHEMA_PER_TENANT.md).
