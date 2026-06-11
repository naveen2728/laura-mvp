from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import (
    ChatMessageCreate,
    ChatMessageRead,
    ConversationThreadCreate,
    ConversationThreadRead,
    ConversationThreadUpdate,
)
from app.services import threads as thread_service

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("", response_model=list[ConversationThreadRead])
def list_threads(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return thread_service.list_threads(db, user_id=current_user.id)


@router.post("", response_model=ConversationThreadRead, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ConversationThreadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    thread = thread_service.create_thread(db, user_id=current_user.id, data=payload)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {**thread.__dict__, "message_count": 0}


@router.patch("/{thread_id}", response_model=ConversationThreadRead)
def update_thread(
    thread_id: int,
    payload: ConversationThreadUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    thread = thread_service.get_thread(db, user_id=current_user.id, thread_id=thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    updated = thread_service.update_thread(db, user_id=current_user.id, thread=thread, data=payload)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {**updated.__dict__, "message_count": len(updated.messages)}


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    thread = thread_service.get_thread(db, user_id=current_user.id, thread_id=thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    thread_service.delete_thread(db, thread=thread)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{thread_id}/messages", response_model=list[ChatMessageRead])
def list_messages(
    thread_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    messages = thread_service.list_messages(db, user_id=current_user.id, thread_id=thread_id)
    if messages is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return messages


@router.post("/{thread_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
def create_message(
    thread_id: int,
    payload: ChatMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    message = thread_service.create_message(db, user_id=current_user.id, thread_id=thread_id, data=payload)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return message
