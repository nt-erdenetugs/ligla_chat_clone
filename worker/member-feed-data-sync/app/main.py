from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.errors import SyncError

# Import logger configuration first to ensure proper setup
from app.core.logger import configure_cloud_logging, logger
from app.core.schemas import FileEvent

# Schema-per-tenant workflow
from app.pipeline.workflow.sync_workflow import (
    execute_daily_sync,
    sync_single_organization,
    sync_specific_file,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_cloud_logging()
    logger.info("Member Data Sync Service starting up - logging configured")

    yield
    logger.info("Member Data Sync Service shutting down...")


app = FastAPI(title="Member Feed Data Sync Service", version="0.1.0", lifespan=lifespan)


@app.exception_handler(SyncError)
async def sync_error_handler(request: Request, exc: SyncError) -> JSONResponse:
    logger.error(f"Member Data Sync error: {exc.message}")
    return JSONResponse(status_code=exc.status_code.value, content={"error": exc.message})


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "member-feed-data-sync"}


@app.post("/sync")
async def run_daily_sync():
    logger.info("[HTTP_REQUEST] Daily sync requested")

    try:
        # Schema-per-tenant: No parent table needed, each org has its own schema
        result = await execute_daily_sync()
        logger.info("[HTTP_RESPONSE] SUCCESS: Daily sync completed")
        logger.info(f"[HTTP_RESPONSE] 200 OK: {result}")
        return result
    except SyncError as sync_err:
        logger.error(f"[HTTP_RESPONSE] Sync Error in daily sync: {sync_err}")
        raise
    except Exception as e:
        logger.error(f"[HTTP_RESPONSE] 500 Internal Server Error in daily sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sync/file")
async def sync_file_event(file_event: FileEvent):
    logger.info(f"[HTTP_REQUEST] Received file event: {file_event.model_dump()}")

    try:
        # Schema-per-tenant: No parent table needed
        file_path = file_event.resolved_file_path

        if not file_path:
            logger.error(f"[HTTP_REQUEST] Missing file_path in event data: {file_event.model_dump()}")
            raise HTTPException(status_code=400, detail="Missing file_path or name in event data")

        logger.info(f"[HTTP_REQUEST] Processing file event: {file_path}")

        if "/client_users/" not in file_path:
            logger.info(f"[HTTP_REQUEST] Ignoring file outside client_users directory: {file_path}")
            response = {"status": "ignored", "reason": "File not in client_users directory"}
            logger.info(f"[HTTP_RESPONSE] 200 OK: {response}")
            return response

        logger.info(f"[HTTP_REQUEST] About to process file: {file_path}")
        result = await sync_specific_file(file_path)

        if result["success"]:
            logger.info(f"[HTTP_RESPONSE] SUCCESS: File sync completed successfully for {file_path}")
            logger.info(f"[HTTP_RESPONSE] 200 OK: {result}")
            return result
        else:
            logger.error(f"[HTTP_RESPONSE] FAILED: File sync failed for {file_path}")
            logger.info(f"[HTTP_RESPONSE] 200 OK (with failure): {result}")
            return result

    except HTTPException as http_err:
        logger.error(f"[HTTP_RESPONSE] {http_err.status_code} {http_err.detail}")
        raise
    except Exception as e:
        logger.error(f"[HTTP_RESPONSE] 500 Internal Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sync/{org_name}")
async def sync_organization_endpoint(org_name: str):
    logger.info(f"[HTTP_REQUEST] Organization sync requested for: {org_name}")

    try:
        # Schema-per-tenant: No parent table needed
        success = await sync_single_organization(org_name)

        if success:
            response = {"organization": org_name, "status": "completed", "success": True}
            logger.info(f"[HTTP_RESPONSE] SUCCESS: Organization sync completed for {org_name}")
            logger.info(f"[HTTP_RESPONSE] 200 OK: {response}")
            return response
        else:
            error_msg = f"No pending files found for organization: {org_name}"
            logger.error(f"[HTTP_RESPONSE] 404 Not Found: {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)

    except HTTPException as http_err:
        logger.error(f"[HTTP_RESPONSE] {http_err.status_code} {http_err.detail}")
        raise
    except SyncError as sync_err:
        logger.error(f"[HTTP_RESPONSE] Sync Error for {org_name}: {sync_err}")
        raise
    except Exception as e:
        logger.error(f"[HTTP_RESPONSE] 500 Internal Server Error for {org_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"service": "member-feed-data-sync", "version": "0.1.0", "status": "ready"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8081)
