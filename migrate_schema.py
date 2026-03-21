"""Add columns to existing `users` tables (SQLite / Postgres) without Alembic."""

from sqlalchemy import inspect, text

from database import engine


def run_migrations() -> None:
    insp = inspect(engine)
    if not insp.has_table("users"):
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    stmts: list[str] = []
    if "first_name" not in cols:
        stmts.append("ALTER TABLE users ADD COLUMN first_name VARCHAR(120)")
    if "last_name" not in cols:
        stmts.append("ALTER TABLE users ADD COLUMN last_name VARCHAR(120)")
    if "date_of_birth" not in cols:
        stmts.append("ALTER TABLE users ADD COLUMN date_of_birth DATE")
    if not stmts:
        return
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))
