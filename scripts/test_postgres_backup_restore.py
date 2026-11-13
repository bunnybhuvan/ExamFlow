"""PostgreSQL SQL-export restore integration test used by CI's disposable database."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.database import Base
from app import models
from app.main import exports


URL = os.environ["EXAMFLOW_TEST_POSTGRES_URL"]
SOURCE_SCHEMA = "examflow_backup_source"
RESTORE_SCHEMA = "examflow_backup_restore"


def scoped_url(schema: str) -> str:
    sqlalchemy_url = URL.replace("postgresql://", "postgresql+psycopg://", 1)
    return sqlalchemy_url + f"?options=-csearch_path%3D{schema}"


def main():
    with psycopg.connect(URL) as conn:
        conn.execute(f'DROP SCHEMA IF EXISTS {SOURCE_SCHEMA} CASCADE')
        conn.execute(f'DROP SCHEMA IF EXISTS {RESTORE_SCHEMA} CASCADE')
        conn.execute(f'CREATE SCHEMA {SOURCE_SCHEMA}')
        conn.execute(f'CREATE SCHEMA {RESTORE_SCHEMA}')

    source_engine = create_engine(scoped_url(SOURCE_SCHEMA), pool_pre_ping=True)
    restore_engine = create_engine(scoped_url(RESTORE_SCHEMA), pool_pre_ping=True)
    try:
        Base.metadata.create_all(source_engine)
        with Session(source_engine) as db:
            db.add_all([
                models.Student(id="STU-BACKUP-1", name="Aarav Reddy", email="backup-student@example.test",
                    program="Computer Science", year=3, accommodations=["separate_room"]),
                models.Exam(id="EXAM-BACKUP-1", course_code="CS9001", course_name="Database Systems",
                    department="Computer Science", duration_minutes=120, enrollment=1,
                    window_start=__import__("datetime").date(2026, 12, 7),
                    window_end=__import__("datetime").date(2026, 12, 18),
                    required_equipment=[], accommodations=[], status="scheduled"),
                models.Room(id="ROOM-BACKUP-1", name="Srinivasa Block 101", building="Srinivasa Block",
                    capacity=60, equipment=["Projector"], accessible=True, closures=[], utilization=0.1),
                models.Invigilator(id="INV-BACKUP-1", name="Dr. S. Lakshmi", email="backup-staff@example.test",
                    department="Computer Science", qualifications=["Projector"],
                    available_days=["2026-12-07"], max_duties=5, assigned_duties=1, conflicts=0),
            ])
            db.flush()
            db.add(models.Enrollment(student_id="STU-BACKUP-1", exam_id="EXAM-BACKUP-1"))
            db.add(models.Assignment(id="ASN-EXAM-BACKUP-1-ROOM-BACKUP-1",
                exam_id="EXAM-BACKUP-1", room_id="ROOM-BACKUP-1",
                student_ids=["STU-BACKUP-1"], invigilator_ids=["INV-BACKUP-1"],
                start=__import__("datetime").datetime(2026, 12, 7, 9, 0),
                end=__import__("datetime").datetime(2026, 12, 7, 11, 0), status="confirmed"))
            db.commit()
            response = exports("sql", db)
            assert response.status_code == 200
            sql_dump = response.body.decode("utf-8")
            assert "student_ids" in sql_dump
            assert "STU-BACKUP-1" in sql_dump

        # Execute the generated multi-statement PostgreSQL script in a clean schema.
        with psycopg.connect(URL, options=f"-csearch_path={RESTORE_SCHEMA}") as conn:
            conn.execute(sql_dump, prepare=False)

        with restore_engine.connect() as conn:
            assert conn.execute(text("SELECT count(*) FROM students")).scalar_one() == 1
            assert conn.execute(text("SELECT count(*) FROM assignments")).scalar_one() == 1
            assert conn.execute(text("SELECT student_ids FROM assignments")).scalar_one() == ["STU-BACKUP-1"]
            assert conn.execute(text("SELECT count(*) FROM enrollments")).scalar_one() == 1
        print("PostgreSQL SQL export restore: PASS")
    finally:
        source_engine.dispose()
        restore_engine.dispose()
        with psycopg.connect(URL) as conn:
            conn.execute(f'DROP SCHEMA IF EXISTS {SOURCE_SCHEMA} CASCADE')
            conn.execute(f'DROP SCHEMA IF EXISTS {RESTORE_SCHEMA} CASCADE')


if __name__ == "__main__":
    main()
