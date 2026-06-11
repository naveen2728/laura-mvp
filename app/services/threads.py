from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ChatMessage, ConversationThread, Project
from app.models.domain import utc_now
from app.schemas import ChatMessageCreate, ConversationThreadCreate, ConversationThreadUpdate


def _project_exists(db: Session, *, user_id: int, project_id: int | None) -> bool:
    if project_id is None:
        return True
    return db.scalar(select(Project.id).where(Project.id == project_id, Project.user_id == user_id)) is not None


def list_threads(db: Session, *, user_id: int) -> list[dict]:
    rows = db.execute(
        select(ConversationThread, func.count(ChatMessage.id).label("message_count"))
        .outerjoin(ChatMessage, ChatMessage.thread_id == ConversationThread.id)
        .where(ConversationThread.user_id == user_id)
        .group_by(ConversationThread.id)
        .order_by(ConversationThread.updated_at.desc())
    ).all()
    return [
        {
            "id": thread.id,
            "user_id": thread.user_id,
            "project_id": thread.project_id,
            "title": thread.title,
            "created_at": thread.created_at,
            "updated_at": thread.updated_at,
            "message_count": message_count,
        }
        for thread, message_count in rows
    ]


def get_thread(db: Session, *, user_id: int, thread_id: int) -> ConversationThread | None:
    return db.scalar(select(ConversationThread).where(ConversationThread.id == thread_id, ConversationThread.user_id == user_id))


def create_thread(db: Session, *, user_id: int, data: ConversationThreadCreate) -> ConversationThread | None:
    if not _project_exists(db, user_id=user_id, project_id=data.project_id):
        return None
    thread = ConversationThread(user_id=user_id, project_id=data.project_id, title=data.title)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def update_thread(
    db: Session,
    *,
    user_id: int,
    thread: ConversationThread,
    data: ConversationThreadUpdate,
) -> ConversationThread | None:
    updates = data.model_dump(exclude_unset=True)
    if "project_id" in updates and not _project_exists(db, user_id=user_id, project_id=updates["project_id"]):
        return None
    for field, value in updates.items():
        setattr(thread, field, value)
    db.commit()
    db.refresh(thread)
    return thread


def delete_thread(db: Session, *, thread: ConversationThread) -> None:
    db.delete(thread)
    db.commit()


def list_messages(db: Session, *, user_id: int, thread_id: int) -> list[ChatMessage] | None:
    thread = get_thread(db, user_id=user_id, thread_id=thread_id)
    if thread is None:
        return None
    return list(db.scalars(select(ChatMessage).where(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at.asc())))


def create_message(
    db: Session,
    *,
    user_id: int,
    thread_id: int,
    data: ChatMessageCreate,
) -> ChatMessage | None:
    thread = get_thread(db, user_id=user_id, thread_id=thread_id)
    if thread is None:
        return None
    message = ChatMessage(thread_id=thread.id, role=data.role, label=data.label, content=data.content)
    thread.updated_at = utc_now()
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
