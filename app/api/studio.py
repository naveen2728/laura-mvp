from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import (
    AgentRoleCreate,
    AgentRoleRead,
    AgentRoleUpdate,
    ModelProviderCreate,
    ModelProviderRead,
    ModelProviderUpdate,
    StudioRunCreate,
    StudioRunRead,
)
from app.services import studio as studio_service

router = APIRouter(prefix="/studio", tags=["studio"])


@router.get("/models", response_model=list[ModelProviderRead])
def list_models(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return studio_service.list_model_providers(db, user_id=current_user.id)


@router.post("/models", response_model=ModelProviderRead, status_code=status.HTTP_201_CREATED)
def create_model(
    payload: ModelProviderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return studio_service.create_model_provider(db, user_id=current_user.id, data=payload)


@router.patch("/models/{provider_id}", response_model=ModelProviderRead)
def update_model(
    provider_id: int,
    payload: ModelProviderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    provider = studio_service.get_model_provider(db, user_id=current_user.id, provider_id=provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    return studio_service.update_model_provider(db, provider=provider, data=payload)


@router.delete("/models/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    provider_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    provider = studio_service.get_model_provider(db, user_id=current_user.id, provider_id=provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    studio_service.delete_model_provider(db, provider=provider)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/agents", response_model=list[AgentRoleRead])
def list_agents(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return studio_service.list_agent_roles(db, user_id=current_user.id)


@router.post("/agents", response_model=AgentRoleRead, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentRoleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    agent = studio_service.create_agent_role(db, user_id=current_user.id, data=payload)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    return agent


@router.patch("/agents/{agent_id}", response_model=AgentRoleRead)
def update_agent(
    agent_id: int,
    payload: AgentRoleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    agent = studio_service.get_agent_role(db, user_id=current_user.id, agent_id=agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent role not found")
    updated = studio_service.update_agent_role(db, user_id=current_user.id, agent=agent, data=payload)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    return updated


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    agent = studio_service.get_agent_role(db, user_id=current_user.id, agent_id=agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent role not found")
    studio_service.delete_agent_role(db, agent=agent)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/runs", response_model=StudioRunRead)
def run_agent(
    payload: StudioRunCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        result = studio_service.run_agent(
            db,
            user_id=current_user.id,
            project_id=payload.project_id,
            agent_id=payload.agent_id,
            prompt=payload.prompt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Model provider request failed: {exc}") from exc

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project, agent, or agent model not found")
    return result
