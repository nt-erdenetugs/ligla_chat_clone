from fastapi import APIRouter

from app.services.organization.router import router as org_router
from app.services.receiver.router import router as subs_router

root_router = APIRouter()


root_router.include_router(subs_router, prefix="/receive", tags=["[Subscription] Receive New Message"])
root_router.include_router(org_router, prefix="/organization", tags=["[Hypervisor] Organization"])
