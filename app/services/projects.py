from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate


def list_projects(db: Session, *, user_id: int) -> list[Project]:
    return list(db.scalars(select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())))


def get_project(db: Session, *, user_id: int, project_id: int) -> Project | None:
    return db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user_id))


def create_project(db: Session, *, user_id: int, data: ProjectCreate) -> Project:
    project = Project(user_id=user_id, name=data.name, description=data.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, *, project: Project, data: ProjectUpdate) -> Project:
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, *, project: Project) -> None:
    db.delete(project)
    db.commit()
