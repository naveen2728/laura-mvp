import hashlib
import secrets
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiKey
from app.models.domain import utc_now


API_KEY_PREFIX = "bm_live_"


@dataclass(frozen=True)
class GeneratedApiKey:
    record: ApiKey
    plaintext: str


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    return f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"


def create_api_key(db: Session, *, user_id: int, name: str) -> GeneratedApiKey:
    plaintext = generate_api_key()
    record = ApiKey(
        user_id=user_id,
        name=name,
        key_hash=hash_api_key(plaintext),
        prefix=plaintext[:16],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return GeneratedApiKey(record=record, plaintext=plaintext)


def list_api_keys(db: Session, *, user_id: int) -> list[ApiKey]:
    return list(
        db.scalars(
            select(ApiKey)
            .where(ApiKey.user_id == user_id)
            .order_by(ApiKey.created_at.desc())
        )
    )


def get_api_key(db: Session, *, user_id: int, api_key_id: int) -> ApiKey | None:
    return db.scalar(select(ApiKey).where(ApiKey.id == api_key_id, ApiKey.user_id == user_id))


def revoke_api_key(db: Session, *, api_key: ApiKey) -> ApiKey:
    if api_key.revoked_at is None:
        api_key.revoked_at = utc_now()
        db.commit()
        db.refresh(api_key)
    return api_key


def authenticate_api_key(db: Session, api_key: str, *, mark_used: bool = True) -> ApiKey | None:
    key_hash = hash_api_key(api_key)
    record = db.scalar(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.revoked_at.is_(None),
        )
    )
    if record and mark_used:
        record.last_used_at = utc_now()
        db.commit()
        db.refresh(record)
    return record
