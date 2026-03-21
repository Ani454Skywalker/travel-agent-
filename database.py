"""
User accounts live in a SQL database:
- Local default: SQLite file `tripin.db` in the project folder.
- Production (Railway): set DATABASE_URL to Postgres (e.g. add Railway Postgres);
  otherwise SQLite may reset when the container restarts.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_raw_url = os.environ.get("DATABASE_URL", "sqlite:///./tripin.db")
# Railway / Heroku sometimes use postgres://
if _raw_url.startswith("postgres://"):
    _raw_url = "postgresql://" + _raw_url[len("postgres://") :]

connect_args = {"check_same_thread": False} if _raw_url.startswith("sqlite") else {}

engine = create_engine(_raw_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
