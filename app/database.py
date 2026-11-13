from pathlib import Path
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

ROOT = Path(__file__).resolve().parent.parent
_raw_database_url = os.getenv("DATABASE_URL", "").strip()

# Render and several hosted PostgreSQL providers still expose the legacy
# postgres:// scheme. SQLAlchemy's psycopg 3 dialect uses postgresql+psycopg.
if _raw_database_url.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + _raw_database_url[len("postgres://"):]
elif _raw_database_url.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + _raw_database_url[len("postgresql://"):]
elif _raw_database_url:
    DATABASE_URL = _raw_database_url
else:
    DB_PATH = Path(os.getenv("EXAMFLOW_DB_PATH", ROOT / "data" / "examflow.db"))
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, future=True)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
