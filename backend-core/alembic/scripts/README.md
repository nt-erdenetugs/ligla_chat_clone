# Alembic Migration Utilities

This directory contains utility scripts for managing database migrations.

## cleanup_orphaned_partitions.sql

**Purpose:** Removes orphaned partition metadata from PostgreSQL system catalogs.

**When to use:**
- When you see errors like: `relation "[partition_name]" does not exist` during migrations
- After manually dropping partitioned tables
- Before running migrations that query `pg_inherits` for partition information

**What it does:**
1. Scans `pg_inherits` system catalog for partition metadata
2. Identifies partitions that exist in metadata but don't have actual tables
3. Removes orphaned entries from `pg_inherits` and `pg_class`

**Usage:**

```bash
# Run cleanup script
docker compose exec postgres psql -U ligla_user -d ligla_local \
  -f /code/alembic/scripts/cleanup_orphaned_partitions.sql

# Then run migrations
docker compose exec backend-core uv run alembic upgrade head
```

**Example output:**

```
NOTICE:  Scanning for orphaned partition metadata...
NOTICE:
NOTICE:  Found orphaned partition: memberfeeddata_ligla_chat
NOTICE:    Parent table: memberFeedData
NOTICE:    Partition bound: FOR VALUES IN ('ligla_chat')
NOTICE:    ✓ Cleaned up metadata for memberfeeddata_ligla_chat
NOTICE:
NOTICE:  Cleanup complete. Removed 1 orphaned partition(s).
NOTICE:
NOTICE:  You can now run migrations safely.
```

**Why orphaned partitions happen:**
- Tables manually dropped without `CASCADE`
- Migration failures mid-execution
- Incomplete rollback operations
- Direct database schema modifications

**Prevention:**
- Always use `DROP TABLE ... CASCADE` when removing partitioned tables
- Let migrations handle partition creation/deletion
- Avoid manual database schema changes
- Test migrations in development before production

**Technical details:**

The script queries:
- `pg_inherits`: Contains parent-child relationships for table inheritance and partitioning
- `pg_class`: Contains metadata about database objects (tables, indexes, etc.)
- `information_schema.tables`: Contains actual tables in the database

When a partition table is dropped but metadata remains in `pg_inherits`, queries that scan for partitions will find the orphaned entry and try to use it, causing "relation does not exist" errors.

**Safe to run multiple times:**
The script only removes metadata for partitions that genuinely don't have corresponding tables. It's safe to run multiple times - if no orphaned partitions exist, it simply reports "No orphaned partitions found."

**Related migrations:**
- `3a2fe1ae7e5c`: Diagnostic migration that checks for orphaned partitions
- `b0bed3deab2d`: Migration that queries pg_inherits and can fail with orphaned metadata
