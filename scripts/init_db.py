from app.db.session import Base, engine
from app.models import ApiKey, Project, Task, User


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")


if __name__ == "__main__":
    main()
