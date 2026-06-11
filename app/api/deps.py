from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ApiKey, User
from app.services.api_keys import authenticate_api_key

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_api_key(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiKey:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    api_key = authenticate_api_key(db, credentials.credentials)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return api_key


def get_current_user(api_key: Annotated[ApiKey, Depends(get_current_api_key)]) -> User:
    return api_key.user
