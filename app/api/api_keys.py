from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import ApiKeyCreate, ApiKeyMetadataRead, ApiKeyRead
from app.services.api_keys import create_api_key, get_api_key, list_api_keys, revoke_api_key

router = APIRouter(prefix="/api-keys", tags=["api keys"])


@router.post("", response_model=ApiKeyRead, status_code=status.HTTP_201_CREATED)
def create_key(payload: ApiKeyCreate, db: Session = Depends(get_db)) -> ApiKeyRead:
    user = db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    generated = create_api_key(db, user_id=user.id, name=payload.name)
    return ApiKeyRead(
        id=generated.record.id,
        user_id=user.id,
        name=generated.record.name,
        prefix=generated.record.prefix,
        key=generated.plaintext,
        created_at=generated.record.created_at,
    )


@router.get("", response_model=list[ApiKeyMetadataRead])
def list_keys(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return list_api_keys(db, user_id=current_user.id)


@router.delete("/{api_key_id}", response_model=ApiKeyMetadataRead)
def revoke_key(
    api_key_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    api_key = get_api_key(db, user_id=current_user.id, api_key_id=api_key_id)
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return revoke_api_key(db, api_key=api_key)
