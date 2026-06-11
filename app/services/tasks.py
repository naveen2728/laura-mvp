from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, Task, TaskStatus
from app.schemas import TaskCreate, TaskUpdate


def list_tasks(db: Session, *, user_id: int, project_id: int) -> list[Task] | None:
    project = db.scalar(select(Project.id).where(Project.id == project_id, Project.user_id == user_id))
    if project is None:
        return None
    return list(db.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())))


def get_task(db: Session, *, user_id: int, task_id: int) -> Task | None:
    return db.scalar(
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(Task.id == task_id, Project.user_id == user_id)
    )


def create_task(db: Session, *, user_id: int, data: TaskCreate) -> Task | None:
    project = db.scalar(select(Project).where(Project.id == data.project_id, Project.user_id == user_id))
    if project is None:
        return None
    task = Task(project_id=project.id, instructions=data.instructions, context=data.context)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, *, task: Task, data: TaskUpdate) -> Task:
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def update_task_status(db: Session, *, task: Task, status: TaskStatus) -> Task:
    task.status = status
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, *, task: Task) -> None:
    db.delete(task)
    db.commit()
