from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sqlite3
from app.models import EdgeCaseLabel
import pytest
from app.database import Base, get_db, normalize_database_url
from app.main import app, configured_cors_origins

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db=TestingSession()
    try: yield db
    finally: db.close()

app.dependency_overrides[get_db]=override_get_db

@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client

def test_health_and_database(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.get("/api/v1/health/database").json()["status"] == "connected"

def test_database_health_reports_the_active_engine(client):
    response = client.get("/api/v1/health/database")
    assert response.json()["database"] == "sqlite"


def test_cors_origins_are_configurable(monkeypatch):
    monkeypatch.setenv(
        "EXAMFLOW_CORS_ORIGINS",
        "https://examflow.example, https://preview.example/",
    )
    assert configured_cors_origins() == [
        "https://examflow.example",
        "https://preview.example",
    ]

def test_dataset_and_schedule_round_trip(client):
    generated=client.post("/api/v1/datasets/generate",json={
        "seed":20261111,"students":120,"exams":12,"rooms":10,"invigilators":12,"include_edge_cases":False
    })
    assert generated.status_code == 200, generated.text
    assert generated.json()["students"] == 120
    assert len(client.get("/api/v1/exams").json()) == 12
    result=client.post("/api/v1/schedules/generate",json={
        "start_date":"2026-12-07","end_date":"2026-12-18","daily_start":"09:00",
        "daily_end":"18:00","break_buffer_minutes":15,"seed":20261111,"strategy":"balanced"
    })
    assert result.status_code == 200, result.text
    body=result.json()
    assert body["scheduled"] + body["unassigned"] == 12
    assert len(client.get("/api/v1/schedules").json()) == body["scheduled"]
    assert len(client.get("/api/v1/schedules/unassigned").json()) == body["unassigned"]

def test_faculty_scale_dataset_and_schedule_smoke(client):
    generated=client.post("/api/v1/datasets/generate",json={
        "seed":20261111,"students":5000,"exams":300,"rooms":100,"invigilators":200,
        "include_edge_cases":False
    })
    assert generated.status_code == 200, generated.text
    assert generated.json()["students"] == 5000
    assert generated.json()["exams"] == 300
    assert generated.json()["rooms"] == 100
    assert generated.json()["invigilators"] == 200
    assert len(client.get("/api/v1/students").json()) == 5000
    assert len(client.get("/api/v1/exams").json()) == 300
    assert len(client.get("/api/v1/rooms").json()) == 100
    assert len(client.get("/api/v1/invigilators").json()) == 200

    result=client.post("/api/v1/schedules/generate",json={
        "start_date":"2026-12-07","end_date":"2027-01-01","daily_start":"09:00",
        "daily_end":"18:00","break_buffer_minutes":15,"seed":20261111,"strategy":"balanced"
    })
    assert result.status_code == 200, result.text
    body=result.json()
    assert body["scheduled"] + body["unassigned"] == 300
    validation=client.get("/api/v1/reports/validation").json()
    assert validation["failed"] == 0
    assert all(check["violations"] == 0 for check in validation["checks"])

def test_invalid_schedule_window_is_rejected(client):
    response=client.post("/api/v1/schedules/generate",json={
        "start_date":"2026-12-20","end_date":"2026-12-01","daily_start":"09:00","daily_end":"18:00"
    })
    assert response.status_code == 422

def test_csv_export_requires_valid_format(client):
    response=client.get("/api/v1/exports/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_labelled_edge_cases_are_separate_and_never_break_hard_constraints(client):
    generated=client.post("/api/v1/datasets/generate",json={
        "seed":20261111,"students":500,"exams":12,"rooms":10,"invigilators":12,"include_edge_cases":True
    })
    assert generated.status_code == 200, generated.text
    labels=client.get("/api/v1/edge-cases").json()
    codes={x["case_code"] for x in labels}
    assert {"STUDENT_OVERLAP","INSUFFICIENT_ROOM_CAPACITY","EXAM_IN_CLOSED_ROOMS",
            "ACCOMMODATION_UNAVAILABLE","INVIGILATOR_DOUBLE_BOOKING"} <= codes

    result=client.post("/api/v1/schedules/generate",json={
        "start_date":"2026-12-07","end_date":"2027-01-01","daily_start":"09:00",
        "daily_end":"10:30","break_buffer_minutes":15,"seed":20261111,"strategy":"balanced"
    })
    assert result.status_code == 200, result.text
    reasons={x["reason_code"] for x in client.get("/api/v1/schedules/unassigned").json()}
    assert "NO_ROOM_CAPACITY" in reasons
    assert "ROOM_CLOSED" in reasons
    assert "ACCOMMODATION_CONFLICT" in reasons
    assert "NO_INVIGILATOR" in reasons

    validation=client.get("/api/v1/reports/validation").json()
    assert validation["failed"] == 0
    assert all(check["violations"] == 0 for check in validation["checks"])



def _generate_small_schedule(client, include_edge_cases=False):
    generated = client.post("/api/v1/datasets/generate", json={
        "seed": 20261113, "students": 180, "exams": 16, "rooms": 12,
        "invigilators": 16, "include_edge_cases": include_edge_cases,
    })
    assert generated.status_code == 200, generated.text
    schedule = client.post("/api/v1/schedules/generate", json={
        "start_date": "2026-12-07", "end_date": "2026-12-18",
        "daily_start": "09:00", "daily_end": "18:00",
        "break_buffer_minutes": 15, "seed": 20261113, "strategy": "balanced",
    })
    assert schedule.status_code == 200, schedule.text
    return {
        "students": client.get("/api/v1/students").json(),
        "exams": client.get("/api/v1/exams").json(),
        "rooms": client.get("/api/v1/rooms").json(),
        "invigilators": client.get("/api/v1/invigilators").json(),
        "assignments": client.get("/api/v1/schedules").json(),
        "unassigned": client.get("/api/v1/schedules/unassigned").json(),
    }


def test_fixed_seed_reproduces_dataset_and_schedule(client):
    first = _generate_small_schedule(client)
    second = _generate_small_schedule(client)
    assert first == second


def test_evaluation_labels_do_not_change_scheduler_output(client):
    baseline = _generate_small_schedule(client)
    db = TestingSession()
    try:
        db.add(EdgeCaseLabel(
            id="EVAL-ONLY-001", case_code="SYNTHETIC_EVALUATION_LABEL",
            entity_type="exam", entity_id="EXAM-2026-000001",
            expected_detection="Must remain evaluation-only.",
        ))
        db.commit()
    finally:
        db.close()

    rerun = client.post("/api/v1/schedules/generate", json={
        "start_date": "2026-12-07", "end_date": "2026-12-18",
        "daily_start": "09:00", "daily_end": "18:00",
        "break_buffer_minutes": 15, "seed": 20261113, "strategy": "balanced",
    })
    assert rerun.status_code == 200, rerun.text
    assert client.get("/api/v1/schedules").json() == baseline["assignments"]
    assert client.get("/api/v1/schedules/unassigned").json() == baseline["unassigned"]


def test_sql_export_round_trips_schema_and_data(client):
    generated = client.post("/api/v1/datasets/generate", json={
        "seed": 20261113, "students": 80, "exams": 8, "rooms": 6,
        "invigilators": 8, "include_edge_cases": True,
    })
    assert generated.status_code == 200, generated.text
    response = client.get("/api/v1/exports/sql")
    assert response.status_code == 200
    assert "application/sql" in response.headers["content-type"]
    assert 'filename="examflow-database.sql"' in response.headers["content-disposition"]
    assert "CREATE TABLE students" in response.text
    assert "CREATE TABLE edge_case_labels" in response.text

    restored = sqlite3.connect(":memory:")
    try:
        restored.executescript(response.text)
        assert restored.execute("SELECT COUNT(*) FROM students").fetchone()[0] == 80
        assert restored.execute("SELECT COUNT(*) FROM exams").fetchone()[0] == 8
        assert restored.execute("SELECT COUNT(*) FROM edge_case_labels").fetchone()[0] > 0
        assert restored.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        restored.close()




def test_postgresql_connection_url_normalization():
    assert normalize_database_url(
        "postgres://user:secret@host.example/db?sslmode=require"
    ) == "postgresql+psycopg://user:secret@host.example/db?sslmode=require"
    assert normalize_database_url(
        "postgresql://user:secret@host.example/db?sslmode=require"
    ) == "postgresql+psycopg://user:secret@host.example/db?sslmode=require"
    assert normalize_database_url(
        "sqlite:///./data/test.db"
    ) == "sqlite:///./data/test.db"



def test_separate_room_accommodation_allocates_student_to_private_room(client):
    generated = client.post("/api/v1/datasets/generate", json={
        "seed": 20261113, "students": 80, "exams": 8, "rooms": 12,
        "invigilators": 16, "include_edge_cases": False,
    })
    assert generated.status_code == 200, generated.text
    db = TestingSession()
    try:
        student = db.get(__import__("app.models", fromlist=["Student"]).Student, "STU-000001")
        assert student is not None
        student.accommodations = ["separate_room"]
        db.commit()
    finally:
        db.close()

    result = client.post("/api/v1/schedules/generate", json={
        "start_date": "2026-12-07", "end_date": "2027-01-01",
        "daily_start": "09:00", "daily_end": "18:00",
        "break_buffer_minutes": 15, "seed": 20261113, "strategy": "balanced",
    })
    assert result.status_code == 200, result.text
    rows = client.get("/api/v1/schedules").json()
    private_rows = [row for row in rows if "STU-000001" in row["student_ids"]]
    assert private_rows
    assert all(row["enrolled"] == 1 for row in private_rows)
    for exam_id in {row["exam_id"] for row in private_rows}:
        same_exam = [row for row in rows if row["exam_id"] == exam_id]
        assert sum("STU-000001" in row["student_ids"] for row in same_exam) == 1
    report = client.get("/api/v1/reports/validation").json()
    assert report["failed"] == 0, report
    assert any(check["name"] == "Separate-room accommodations isolated" and check["status"] == "pass"
               for check in report["checks"])



def test_auth_config_and_password_login(client, monkeypatch):
    from app.models import User
    from app.security import hash_password

    monkeypatch.setenv("EXAMFLOW_AUTH_SECRET", "test-secret-" + "x" * 40)
    db = TestingSession()
    try:
        db.add(User(id="USR-TEST-LOGIN", email="admin@example.test",
            password_hash=hash_password("Strong-Test-Password-2026"),
            role="admin", active=True))
        db.commit()
    finally:
        db.close()

    assert client.get("/api/v1/auth/config").json() == {"enabled": False}
    response = client.post("/api/v1/auth/login", json={
        "email": "ADMIN@example.test", "password": "Strong-Test-Password-2026"
    })
    assert response.status_code == 200, response.text
    assert response.json()["user"]["role"] == "admin"
    assert response.json()["token_type"] == "bearer"
    invalid = client.post("/api/v1/auth/login", json={
        "email": "admin@example.test", "password": "incorrect-password"
    })
    assert invalid.status_code == 401


def test_role_based_access_control_enforces_read_only_viewers(client, monkeypatch):
    from app.models import User
    from app.security import hash_password
    import app.security as security

    monkeypatch.setenv("EXAMFLOW_AUTH_ENABLED", "true")
    monkeypatch.setenv("EXAMFLOW_AUTH_SECRET", "unit-test-secret-" + "x" * 40)
    monkeypatch.setattr(security, "SessionLocal", TestingSession)
    db = TestingSession()
    try:
        db.add(User(id="USR-VIEWER", email="viewer@example.test",
            password_hash=hash_password("Strong-Viewer-Password-2026"),
            role="viewer", active=True))
        db.commit()
    finally:
        db.close()

    assert client.get("/api/v1/students").status_code == 401
    login = client.post("/api/v1/auth/login", json={
        "email": "viewer@example.test", "password": "Strong-Viewer-Password-2026"
    })
    assert login.status_code == 200, login.text
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert client.get("/api/v1/students", headers=headers).status_code == 200
    denied = client.post("/api/v1/datasets/generate", headers=headers, json={
        "students": 1, "exams": 1, "rooms": 1, "invigilators": 1
    })
    assert denied.status_code == 403
    assert client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "Strong-Viewer-Password-2026",
        "new_password": "Even-Stronger-Password-2026"
    }).status_code == 200


def test_dataset_regeneration_preserves_audit_and_schedule_run_history(client):
    first = _generate_small_schedule(client)
    first_events = client.get("/api/v1/audit").json()
    first_schedule_event = next(
        event for event in first_events if event["action"] == "schedule.generated"
    )
    assert first_schedule_event["after"]["assignments"]
    assert len(first_schedule_event["after"]["assignments"]) == len(first["assignments"])

    second = client.post("/api/v1/datasets/generate", json={
        "seed": 20261114, "students": 40, "exams": 5, "rooms": 6,
        "invigilators": 8, "include_edge_cases": False,
    })
    assert second.status_code == 200, second.text

    db = TestingSession()
    try:
        from app.models import ScheduleRun, ScheduleEvent
        assert db.query(ScheduleRun).count() == 1
        assert db.query(ScheduleEvent).filter_by(action="schedule.generated").count() == 1
        assert db.query(ScheduleEvent).filter_by(action="dataset.generated").count() == 2
    finally:
        db.close()


def test_metrics_calculate_conflicts_from_validation_not_a_constant(client):
    _generate_small_schedule(client)
    metrics = client.get("/api/v1/reports/metrics").json()
    validation = client.get("/api/v1/reports/validation").json()
    expected = sum(
        check["violations"]
        for check in validation["checks"]
        if check["name"] in {
            "Every enrolled student allocated once",
            "Room capacity respected",
            "No room double booking",
            "No student exam overlap",
            "No invigilator double booking",
            "Room closures honoured",
            "Required equipment available",
            "Accessibility accommodations respected",
            "Invigilator availability respected",
            "Separate-room accommodations isolated",
        }
    )
    assert metrics["conflicts"] == expected
    assert metrics["conflicts"] == 0
    assert metrics["constraint_violations"] == sum(
        check["violations"] for check in validation["checks"]
    )
