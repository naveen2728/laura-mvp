import argparse

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User
from app.services.api_keys import create_api_key


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a local test user API key.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Local API key")
    args = parser.parse_args()

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email))
        if user is None:
            user = User(email=args.email, name=args.email.split("@")[0])
            db.add(user)
            db.commit()
            db.refresh(user)

        generated = create_api_key(db, user_id=user.id, name=args.name)
        print(generated.plaintext)


if __name__ == "__main__":
    main()
