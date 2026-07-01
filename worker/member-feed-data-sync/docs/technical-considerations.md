## Technical draft v2 (WIP)

> **⚠️ LEGACY DOCUMENTATION**: This document describes the original partition-based design.
> The actual implementation uses **schema-per-tenant** architecture where each organization
> has its own PostgreSQL schema (`org_{uuid}`) instead of table partitions.

### 1. Purpose (The "Why")

The technical problem is to reliably sync gigabyte-scale data from an analytical store (BigQuery) to a transactional database (Cloud SQL) without impacting the core application.

```flow
BigQuery (Multiple Daily Exports) → GCS Bucket (File Drop)
             ↓
Eventarc (Real-time File Trigger) → Cloud Run (Per-File Processor)
                                    ↓
                                  Cloud SQL Admin API (Triggers Import Job)
                                    ↓
                                  Cloud SQL (Loads GCS file to Typed Staging Table)
                                    ↓
                                  Cloud Run (Builds Indexes, Swaps Partitions)
```

### 2. Design Principles (The "How")

1. **Strategy: Real-Time Full Refresh with Atomic Partition Swap**
- **Decision:** We will process complete data snapshots for each organization as soon as files arrive. The core database operation will be a **`bulk load into a temporary standalone table`**, which is then **`atomically attached`** as the new live data partition for that organization.
- **Why:** This is the most robust method for a full refresh. It guarantees that the application is **never** querying an incomplete or partially updated dataset. It handles additions, updates, and **deletions** in a single, instantaneous operation, eliminating the need for a separate cleanup job.
1. **Architecture: Event-Driven, Real-Time Processing**
    - **Decision:** **Eventarc triggers** will automatically invoke **Cloud Run services** whenever files are uploaded to GCS. Each file is processed immediately upon arrival, supporting multiple imports per day.
    - **Why:** This architecture provides immediate data freshness as requested by the client. File imports from clients can occur multiple times daily, and changes should be applied as soon as possible after the Ligla import completes. Event-driven processing eliminates delays while maintaining reliability through per-organization advisory locks.
2. **Data Storage: Partitioned Table per Organization**
    - **Decision:** We will use a PostgreSQL **declarative partitioned table**. The API will query a single parent table (member_data), and each organization's data will reside in its own physical partition table (e.g., member_data_acme).
    - **Why:** This provides strong data isolation and performance benefits (partition pruning). Crucially, it **solves the schema migration problem**: Alembic migrations are applied to the parent table, and PostgreSQL automatically propagates changes.
3. **Format & Loading: Compressed CSV with Direct Type Conversion**
    - **Decision:** The required file format is Gzip-compressed **CSV** (.`csv.gz`). The worker will use the **Cloud SQL Admin API's import functionality** to load data directly into properly typed staging tables, leveraging PostgreSQL's COPY command for automatic type conversion.
    - **Why:** Cloud SQL's import functionality uses PostgreSQL's COPY command internally, which can perform data type conversion according to the target table definition. This eliminates the need for a separate transformation stage and reduces complexity while maintaining performance.

### 3. System Architecture & Data Flow

**Data Flow:**

```flow
Trigger: Eventarc (GCS File Upload) → Cloud Run

Stage 1:
	Creates Typed Staging Table in Cloud SQL with proper column types.
	Calls Cloud SQL Admin API to import GCS file directly into typed staging table.
	PostgreSQL COPY command performs automatic type conversion during import.
	Polls Admin API for completion.

Stage 2:
	Builds necessary indexes on the typed staging table.
	Executes Atomic Partition Swap (DETACH/ATTACH).
	Drops old partition and staging table.
	Moves GCS file to /processed/.

```

1. **Data Export:** An external process drops one or more `.csv.gz` files into the GCS client_users/ path for various organizations throughout the day.
2. **Trigger:** **Eventarc** automatically triggers a Cloud Run service whenever a new file is uploaded to the GCS client_users path, providing real-time processing.
3. **Orchestration & Ingest:** Each Cloud Run instance processes a single file with the following logic:

    a. Creates a new, properly-typed staging table with a unique name (e.g., `member_data_acme_staging_20240115_143022`).

    b. **Invokes the Cloud SQL Admin API** to import the organization's CSV file directly into the typed staging table, leveraging PostgreSQL's COPY command for automatic type conversion:
       - `client_user_id` → `VARCHAR(255)`
       - `category_N` → `VARCHAR(255)`
       - `number_N` → `INT`
       - `datetime_N` → `TIMESTAMP`

    c. Polls the Admin API until the import operation is complete.

    d. Builds the necessary indexes on the staging table.

    e. Performs an atomic partition swap: detaches the old partition and attaches the staging table as the new live partition.

    f. Drops the old, detached partition.

4. **State Management:** After successfully processing a file, it is moved from client_users/ to client_users/processed/.

### 4. Detailed Specification

### 4.1. Data Contract (GCS)

- **Bucket:** `ligla-chat-private-data-[stg/prd]`
- **Path:** `{organization_name}/client_users/`
- **File Naming:** `{organization_name}-client_user_data-{YYYYMMDD}.csv.gz`
- **File Content:** A Gzip-compressed CSV file. The file **must not have a header row**. The column order must be fixed and agreed upon.
- **File Size Limits:**
  - **Compressed files:** 4GB limit (Cloud SQL Import API restriction)
  - **Uncompressed files:** No documented limit, but practical limits apply based on processing time and memory
  - Files exceeding limits should be split by the source system before upload

### 4.2. BigQuery Export and CSV Structure

The BigQuery export will produce a CSV with all columns. The pipeline will handle this structure.

- **Partitioning**

    ```sql
    -- Parent table (managed by Alembic)
    CREATE TABLE member_data (
        id BIGSERIAL,
        organization_name VARCHAR(255) NOT NULL,
        client_user_id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, organization_name)
    ) PARTITION BY LIST (organization_name);

    -- Per-organization partition (dynamically managed by worker)
    CREATE TABLE member_data_acme PARTITION OF member_data
        FOR VALUES IN ('acme');
    ```

- **Typed Staging Table Schema (for Direct Cloud SQL Import):**

    ```sql
    CREATE TABLE member_data_acme_staging_20240115_143022 (
        id BIGSERIAL,
        organization_name VARCHAR(255) NOT NULL DEFAULT 'acme',
        client_user_id VARCHAR(255) NOT NULL,
        category_1 VARCHAR(255), category_2 VARCHAR(255), -- ... category_15
        number_1 INT, number_2 INT, -- ... number_15
        datetime_1 TIMESTAMP, datetime_2 TIMESTAMP, -- ... datetime_15
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, organization_name)
    );
    ```

- **Direct Type Conversion:** The Cloud SQL Admin API uses PostgreSQL's COPY command internally, which performs automatic type conversion according to the target table definition. This eliminates the need for a separate transformation stage:

    - CSV string values are automatically converted to appropriate types
    - Empty strings are converted to NULL for numeric and timestamp columns
    - Invalid values cause the import to fail with detailed error messages
    - The JSONB `data` column can be populated using a database trigger or computed column if needed

    This approach is both robust and efficient, allowing the database engine to handle type conversion during the import process while maintaining data integrity.


### 4.3 Processing Component: **Cloud Run (The Processor)**

- **Role:** To process individual files as they arrive in real-time
- **Configuration:**
    - **Concurrency:** Can be set higher (e.g., 10-50) to handle multiple files simultaneously, with per-organization advisory locks ensuring data consistency.
    - **Timeout:** 30-60 minutes (depending on file size).
    - **Memory:** 2-4 GiB.
- **Trigger:** Invoked by **Eventarc** on GCS file upload events

### 4.5. Database Strategy

- **Parent Table (Managed by Alembic):** `member_data`
    - This is a **partitioned table**, partitioned by `LIST(organization_name).`
    - The API and SQLAlchemy models **only ever interact with this table.**
- **Partition Tables (Managed by the Worker):** `member_data_{organization_name}`
- **Final Schema (in the partition):**
    - `id (PK)`
    - `organization_name (VARCHAR, Partition Key)`
    - `client_user_id (VARCHAR)`
    - `data (**JSONB**)`
    - `last_synced_at (TIMESTAMP)`
- **Constraint:** A UNIQUE index on (`client_user_id`) will be created on each partition

### 5. Operational Plan & Reliability

### 5.1. Failure Handling

- **Row-Level Failures:** A bad line in a CSV file (e.g., incorrect number of columns, unescaped quotes) will cause the PostgreSQL COPY command to fail. This is a job-level failure. The entire job for that file will fail.
The error log must capture the detailed error message from PostgreSQL, which often includes the line number and the problematic data.
    - `Log: ERROR: [PostgreSQL] COPY command failed for file 'acme/landing/file.csv.gz': invalid input syntax for type integer on line 12345, column 'number_1’`
- **Job-Level Failures:** If the Cloud Run instance itself crashes, the job will fail. The next scheduled run will attempt the process again.
- **Recovery:** An operator investigates the files in the `/failed/` directory, coordinates a fix for the source data, and can manually trigger the job or wait for the next daily run.

### 5.2. Stale Data Cleanup

- This is **natively handled** by the "Atomic Partition Swap" architecture. Since a new, complete table is loaded each day, any users who have been deleted from the source will simply not be present in the new table. **No separate cleanup job is required.**

### 5.3. File Lifecycle Management

- A **GCS Object Lifecycle Policy** will be configured on the bucket (no code required).
    - **Rule 1:** Delete objects in any `/processed/` path older than **30 days**.
    - **Rule 2:** Delete objects in any `/failed/` path older than **90 days**.

### 6. **IAM - Permissions**

- **Principle of Least Privilege:** The Cloud Run processor's service account will have only these roles:
    - Storage Object Admin: To list, read, and move files.
    - Cloud SQL Client: To connect to the database.
    - **Cloud SQL Admin:** To initiate import jobs via the API.
    - Cloud Run Invoker: To be invoked by Eventarc triggers.

### References:

- https://discuss.google.dev/t/push-data-from-big-query-to-cloud-sql/148498
- https://discuss.google.dev/t/move-approx-100-million-records-from-bigquery-to-cloud-sql/186129/3
- https://discuss.google.dev/t/bigquery-to-cloud-sql-optimal-way/43932/2
- https://www.postgresql.org/docs/current/sql-copy.html
- https://cloud.google.com/sql/docs/postgres/import-export/import-export-csv#rest-v1_1 (Cloud SQL Import API - recommended approach)
- https://cloud.google.com/dataflow/docs/guides/large-pipeline-best-practices
- https://discuss.google.dev/t/effective-way-to-transfer-data-from-big-query-to-cloud-sql/174089

### Change Log (Based on Client Feedback):

1. **Replaced Cloud Scheduler with Event-Driven Architecture**: Changed from daily batch processing to real-time Eventarc triggers for immediate processing when files arrive
2. **Simplified Data Processing Stages**: Reduced from 3-stage (raw text → typed → swap) to 2-stage (direct typed import → swap) process
3. **Direct Type Conversion**: Leveraging Cloud SQL's import functionality to perform type conversion during import using PostgreSQL's COPY command
4. **Updated File Size Limits**: Documented 4GB compressed file limit and noted uncompressed file capabilities
5. **Enhanced Concurrency**: Updated Cloud Run configuration to support higher concurrency with per-organization advisory locks
