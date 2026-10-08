from fastapi import APIRouter, Depends

from app import models
from app.security import require_admin

router = APIRouter(prefix="/admin")


@router.get("/ping")
def ping(admin: models.User = Depends(require_admin)):
    return {"message": f"Namaste admin {admin.name}"}