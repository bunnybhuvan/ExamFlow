from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest
from app.database import Base, get_db
from app.main import app

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

def test_invalid_schedule_window_is_rejected(client):
    response=client.post("/api/v1/schedules/generate",json={
        "start_date":"2026-12-20","end_date":"2026-12-01","daily_start":"09:00","daily_end":"18:00"
    })
    assert response.status_code == 422

def test_csv_export_requires_valid_format(client):
    response=client.get("/api/v1/exports/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
