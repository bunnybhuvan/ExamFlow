from contextlib import asynccontextmanager
from datetime import datetime
import csv, io, json, os, hashlib, zipfile
from datetime import timezone
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field
import uuid
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, select, JSON
from sqlalchemy.schema import CreateTable, CreateIndex
from .database import Base, engine, get_db, SessionLocal
from .security import auth_middleware, auth_enabled, hash_password, verify_password, issue_token
from . import models
from .schemas import DatasetRequest, ScheduleRequest, ExamInput
from .services.scheduler import (generate_dataset, generate_schedule, assignment_rows,
    unassigned_rows, metrics_report, validation_report, add_event)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS student_ids JSON NOT NULL DEFAULT '[]'::json"))
            connection.execute(text("ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_exam_id_key"))
    elif engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(assignments)")}
            table_sql = connection.exec_driver_sql("SELECT sql FROM sqlite_master WHERE type='table' AND name='assignments'").scalar_one()
            if "student_ids" not in columns or "UNIQUE (exam_id)" in (table_sql or ""):
                connection.exec_driver_sql("ALTER TABLE assignments RENAME TO assignments_legacy")
                connection.exec_driver_sql("""
                    CREATE TABLE assignments (
                        id VARCHAR(160) NOT NULL PRIMARY KEY,
                        exam_id VARCHAR(40) NOT NULL,
                        student_ids JSON NOT NULL DEFAULT '[]',
                        room_id VARCHAR(32) NOT NULL,
                        invigilator_ids JSON NOT NULL,
                        start DATETIME NOT NULL,
                        "end" DATETIME NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
                        FOREIGN KEY(room_id) REFERENCES rooms(id)
                    )
                """)
                legacy_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(assignments_legacy)")}
                student_expr = "student_ids" if "student_ids" in legacy_columns else "'[]'"
                connection.exec_driver_sql(f"""
                    INSERT INTO assignments (id,exam_id,student_ids,room_id,invigilator_ids,start,"end",status)
                    SELECT id,exam_id,{student_expr},room_id,invigilator_ids,start,"end",status FROM assignments_legacy
                """)
                connection.exec_driver_sql("DROP TABLE assignments_legacy")
                connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_assignments_exam_id ON assignments(exam_id)")
                connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_assignments_start ON assignments(start)")
    if auth_enabled():
        secret = os.getenv("EXAMFLOW_AUTH_SECRET", "")
        email = os.getenv("EXAMFLOW_ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("EXAMFLOW_ADMIN_PASSWORD", "")
        if len(secret) < 32 or not email or len(password) < 12:
            raise RuntimeError("Secure startup requires EXAMFLOW_AUTH_SECRET (32+ chars), EXAMFLOW_ADMIN_EMAIL and EXAMFLOW_ADMIN_PASSWORD (12+ chars).")
        db = SessionLocal()
        try:
            admin = db.query(models.User).filter_by(email=email).first()
            if not admin:
                db.add(models.User(id=f"USR-{uuid.uuid4().hex[:16]}", email=email,
                    password_hash=hash_password(password), role="admin", active=True))
                db.commit()
        finally:
            db.close()
    yield

app = FastAPI(title="ExamFlow API", description="Deterministic examination scheduling and validation service.", version="1.0.0", lifespan=lifespan)
app.middleware("http")(auth_middleware)
def configured_cors_origins():
    configured = os.getenv("EXAMFLOW_CORS_ORIGINS")
    if configured is None:
        return [
            "http://localhost:8080",
            "http://localhost:5173",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:5173",
        ]
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
def health():
    return {"status":"ok","version":app.version}

@app.get("/api/v1/health/database")
def health_database(db: Session=Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status":"connected","database":engine.dialect.name}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=256)


class UserCreateInput(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=12, max_length=256)
    role: str = Field(default="viewer")


class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=256)


@app.get("/api/v1/auth/config")
def auth_config():
    return {"enabled": auth_enabled()}


@app.post("/api/v1/auth/login")
def auth_login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email.strip().lower()).first()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"access_token": issue_token(user), "token_type": "bearer", "expires_in": 28800,
        "user": {"id": user.id, "email": user.email, "role": user.role}}


@app.get("/api/v1/auth/me")
def auth_me(request: Request):
    return request.state.user


@app.post("/api/v1/auth/change-password")
def auth_change_password(payload: PasswordChangeInput, request: Request, db: Session = Depends(get_db)):
    user = db.get(models.User, request.state.user["id"])
    if not user or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"status": "password_updated"}


@app.post("/api/v1/auth/users", status_code=201)
def auth_create_user(payload: UserCreateInput, request: Request, db: Session = Depends(get_db)):
    if request.state.user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required.")
    if payload.role not in {"admin", "scheduler", "viewer"}:
        raise HTTPException(status_code=422, detail="Role must be admin, scheduler or viewer.")
    email = payload.email.strip().lower()
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = models.User(id=f"USR-{uuid.uuid4().hex[:16]}", email=email,
        password_hash=hash_password(payload.password), role=payload.role, active=True)
    db.add(user)
    db.commit()
    add_event(db, "user.created", "user", user.id, f"Created {payload.role} account {email}.",
        after={"email": email, "role": payload.role})
    db.commit()
    return {"id": user.id, "email": user.email, "role": user.role, "active": user.active}


@app.get("/api/v1/auth/users")
def auth_list_users(request: Request, db: Session = Depends(get_db)):
    if request.state.user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required.")
    return [{"id": u.id, "email": u.email, "role": u.role, "active": u.active}
        for u in db.query(models.User).order_by(models.User.email).all()]


@app.post("/api/v1/datasets/generate")
def datasets_generate(payload: DatasetRequest, db: Session=Depends(get_db)):
    try:
        return generate_dataset(db,payload)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400,detail=str(exc))

@app.get("/api/v1/students")
def students_list(db: Session=Depends(get_db)):
    students=db.query(models.Student).order_by(models.Student.id).all()
    exams={e.id:e.course_code for e in db.query(models.Exam).all()}
    enrollments={}
    for row in db.query(models.Enrollment).all():
        if row.exam_id in exams: enrollments.setdefault(row.student_id,[]).append(exams[row.exam_id])
    return [{"id":s.id,"name":s.name,"email":s.email,"program":s.program,"year":s.year,
        "enrollments":sorted(enrollments.get(s.id,[])),"accommodations":s.accommodations or []} for s in students]

@app.get("/api/v1/exams")
def exams_list(db: Session=Depends(get_db)):
    return db.query(models.Exam).order_by(models.Exam.id).all()

@app.post("/api/v1/exams", status_code=201)
def exams_create(payload: ExamInput, db: Session=Depends(get_db)):
    if db.query(models.Exam).filter_by(course_code=payload.course_code).first():
        raise HTTPException(409,detail="Course code already exists.")
    data=payload.model_dump()
    data["id"]=f"EXAM-2026-{db.query(models.Exam).count()+1:06d}"
    exam=models.Exam(**data)
    db.add(exam); db.commit(); db.refresh(exam)
    add_event(db,"exam.created","exam",exam.id,f"Created exam {exam.course_code}.",after=data); db.commit()
    return exam

@app.put("/api/v1/exams/{exam_id}")
def exams_update(exam_id: str, payload: ExamInput, db: Session=Depends(get_db)):
    exam=db.get(models.Exam,exam_id)
    if not exam: raise HTTPException(404,detail="Exam not found.")
    duplicate=db.query(models.Exam).filter(models.Exam.course_code==payload.course_code,models.Exam.id!=exam_id).first()
    if duplicate: raise HTTPException(409,detail="Course code already exists.")
    before={"course_code":exam.course_code,"duration_minutes":exam.duration_minutes,"status":exam.status}
    for k,v in payload.model_dump().items(): setattr(exam,k,v)
    db.commit(); db.refresh(exam)
    add_event(db,"exam.updated","exam",exam.id,f"Updated exam {exam.course_code}.",before=before,after=payload.model_dump(mode="json")); db.commit()
    return exam

@app.delete("/api/v1/exams/{exam_id}",status_code=204)
def exams_delete(exam_id: str, db: Session=Depends(get_db)):
    exam=db.get(models.Exam,exam_id)
    if not exam: raise HTTPException(404,detail="Exam not found.")
    before={"course_code":exam.course_code}
    db.delete(exam); db.commit()
    add_event(db,"exam.deleted","exam",exam_id,f"Deleted exam {exam_id}.",before=before); db.commit()
    return Response(status_code=204)

@app.get("/api/v1/rooms")
def rooms_list(db: Session=Depends(get_db)):
    return db.query(models.Room).order_by(models.Room.id).all()

@app.get("/api/v1/invigilators")
def invigilators_list(db: Session=Depends(get_db)):
    return db.query(models.Invigilator).order_by(models.Invigilator.id).all()

@app.post("/api/v1/schedules/generate")
def schedules_generate(payload: ScheduleRequest, db: Session=Depends(get_db)):
    try: return generate_schedule(db,payload)
    except ValueError as exc: raise HTTPException(400,detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(500,detail=f"Schedule generation failed: {exc}")

@app.get("/api/v1/schedules")
def schedules_list(db: Session=Depends(get_db)):
    return assignment_rows(db)

@app.get("/api/v1/schedules/unassigned")
def schedules_unassigned(db: Session=Depends(get_db)):
    return unassigned_rows(db)

@app.get("/api/v1/reports/validation")
def reports_validation(db: Session=Depends(get_db)):
    return validation_report(db)

@app.get("/api/v1/reports/metrics")
def reports_metrics(db: Session=Depends(get_db)):
    return metrics_report(db)

@app.get("/api/v1/audit")
def audit_list(db: Session=Depends(get_db)):
    return [{"id":e.id,"timestamp":(e.timestamp.replace(tzinfo=timezone.utc) if e.timestamp.tzinfo is None else e.timestamp.astimezone(timezone.utc)).isoformat().replace("+00:00", "Z"),"actor":e.actor,"action":e.action,
        "entity_type":e.entity_type,"entity_id":e.entity_id,"summary":e.summary,"before":e.before,"after":e.after}
        for e in db.query(models.ScheduleEvent).order_by(models.ScheduleEvent.timestamp.desc()).limit(1000).all()]

@app.get("/api/v1/exports/bundle")
def export_dataset_bundle(db: Session=Depends(get_db)):
    """Download a reproducible, self-describing dataset and evaluation package."""
    tables = [
        models.Student, models.Course, models.Exam, models.ExamCourse, models.Enrollment,
        models.ExamRequirement, models.Room, models.RoomCapacity, models.Invigilator,
        models.Availability, models.Accommodation, models.Assignment,
        models.UnassignedExam, models.EdgeCaseLabel,
    ]
    archive_buffer = io.BytesIO()
    latest_dataset_event = (db.query(models.ScheduleEvent)
        .filter_by(action="dataset.generated").order_by(models.ScheduleEvent.timestamp.desc()).first())
    dataset_metadata = latest_dataset_event.after if latest_dataset_event and latest_dataset_event.after else {}
    manifest = {"project": "ExamFlow", "format_version": 1, "tables": {},
                "seed": dataset_metadata.get("seed"),
                "generator_command": {
                    "endpoint": "POST /api/v1/datasets/generate",
                    "payload": {
                        "seed": dataset_metadata.get("seed"),
                        "students": dataset_metadata.get("students"),
                        "exams": dataset_metadata.get("exams"),
                        "rooms": dataset_metadata.get("rooms"),
                        "invigilators": dataset_metadata.get("invigilators"),
                        "include_edge_cases": dataset_metadata.get("edge_cases"),
                    },
                },
                "source_manifest": {"provenance": "Deterministic synthetic data generated by ExamFlow; no external personal data."}}
    with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for model in tables:
            rows = db.query(model).all()
            columns = list(model.__table__.columns)
            records = []
            for row in rows:
                item = {}
                for column in columns:
                    value = getattr(row, column.name)
                    item[column.name] = value.isoformat() if hasattr(value, "isoformat") else value
                records.append(item)
            records.sort(key=lambda item: json.dumps(item.get(model.__table__.primary_key.columns.values()[0].name), sort_keys=True))
            json_content = json.dumps(records, ensure_ascii=False, sort_keys=True, indent=2)
            csv_buffer = io.StringIO()
            writer = csv.DictWriter(csv_buffer, fieldnames=[column.name for column in columns])
            writer.writeheader()
            for record in records:
                writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                                 for key, value in record.items()})
            json_path = f"data/{model.__tablename__}.json"
            csv_path = f"data/{model.__tablename__}.csv"
            archive.writestr(json_path, json_content)
            archive.writestr(csv_path, csv_buffer.getvalue())
            manifest["tables"][model.__tablename__] = {
                "rows": len(records),
                "json_sha256": hashlib.sha256(json_content.encode("utf-8")).hexdigest(),
                "csv_sha256": hashlib.sha256(csv_buffer.getvalue().encode("utf-8")).hexdigest(),
            }
        manifest["ground_truth_separation"] = "edge_case_labels is evaluation-only and is not a scheduler input."
        sql_response = exports("sql", db)
        archive.writestr("database/examflow-database.sql", sql_response.body.decode("utf-8"))
        manifest["sql_export"] = "database/examflow-database.sql"
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        archive.writestr("README.txt", (
            "ExamFlow dataset bundle\n"
            "Contains CSV, JSON and SQL exports for domain, scheduling and evaluation tables.\n"
            "manifest.json records the fixed seed, generator command, source provenance, row counts and SHA-256 checksums.\n"
            "edge_case_labels contains evaluation ground truth and must not be used as a scheduler feature.\n"
            "The SQL file contains schema and data for the active database snapshot.\n"
        ))
    return Response(content=archive_buffer.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="examflow-dataset-bundle.zip"'})


@app.get("/api/v1/exports/reproducibility")
def export_reproducibility_report(db: Session=Depends(get_db)):
    """Return stable row counts and checksums for deterministic generated data."""
    tables = [
        models.Student, models.Course, models.Exam, models.ExamCourse, models.Enrollment,
        models.ExamRequirement, models.Room, models.RoomCapacity, models.Invigilator,
        models.Availability, models.Accommodation, models.EdgeCaseLabel,
    ]
    report = {"tables": {}, "seed": max((run.seed for run in db.query(models.ScheduleRun).all()), default=None)}
    for model in tables:
        records = []
        for row in db.query(model).all():
            item = {}
            for column in model.__table__.columns:
                value = getattr(row, column.name)
                item[column.name] = value.isoformat() if hasattr(value, "isoformat") else value
            records.append(item)
        records.sort(key=lambda item: json.dumps(item, sort_keys=True, separators=(",", ":")))
        canonical = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        report["tables"][model.__tablename__] = {
            "rows": len(records),
            "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        }
    return report


@app.get("/api/v1/exports/{file_format}")
def exports(file_format: str, db: Session=Depends(get_db)):
    if file_format=="json":
        data={"metrics":metrics_report(db),"exams":[{**{k:getattr(e,k) for k in ["id","course_code","course_name","department","duration_minutes","enrollment","status"]},"window_start":e.window_start.isoformat(),"window_end":e.window_end.isoformat(),"required_equipment":e.required_equipment,"accommodations":e.accommodations} for e in db.query(models.Exam).all()],
            "assignments":assignment_rows(db),"unassigned":unassigned_rows(db),"validation":validation_report(db)}
        return Response(content=json.dumps(data,default=str,indent=2),media_type="application/json",
            headers={"Content-Disposition":'attachment; filename="examflow-schedule.json"'})
    if file_format=="sql":
        bind = db.get_bind()
        if bind.dialect.name == "sqlite":
            raw_connection = bind.raw_connection()
            try:
                sqlite_connection = raw_connection.driver_connection
                dump = "\n".join(sqlite_connection.iterdump())
                sql_script = (
                    "-- ExamFlow database export; generated from the active SQLite database.\n"
                    "PRAGMA foreign_keys=OFF;\n"
                    + dump
                    + "\nPRAGMA foreign_keys=ON;\n"
                )
            finally:
                raw_connection.close()
        elif bind.dialect.name == "postgresql":
            # Produce a portable, provider-independent PostgreSQL SQL script.
            # SQLAlchemy supplies dialect-correct DDL and identifier quoting.
            dialect = bind.dialect
            quote = dialect.identifier_preparer.quote
            statements = [
                "-- ExamFlow PostgreSQL database export.\n",
                "BEGIN;\n",
            ]

            def sql_value(value, column):
                if value is None:
                    return "NULL"
                if isinstance(column.type, JSON):
                    rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                elif isinstance(value, bool):
                    return "TRUE" if value else "FALSE"
                elif isinstance(value, (int, float)):
                    return str(value)
                elif isinstance(value, datetime):
                    rendered = value.isoformat(sep=" ")
                elif hasattr(value, "isoformat"):
                    rendered = value.isoformat()
                else:
                    rendered = str(value)
                return "'" + rendered.replace("'", "''") + "'"

            tables = list(Base.metadata.sorted_tables)
            for table in tables:
                statements.append(str(CreateTable(table).compile(dialect=dialect)) + ";\n")
            for table in tables:
                result = db.execute(select(table))
                column_names = [column.name for column in table.columns]
                columns_sql = ", ".join(quote(name) for name in column_names)
                table_sql = quote(table.name)
                for row in result.mappings():
                    values_sql = ", ".join(
                        sql_value(row[name], table.columns[name]) for name in column_names
                    )
                    statements.append(
                        f"INSERT INTO {table_sql} ({columns_sql}) VALUES ({values_sql});\n"
                    )
            for table in tables:
                for index in table.indexes:
                    statements.append(str(CreateIndex(index).compile(dialect=dialect)) + ";\n")
            statements.append("COMMIT;\n")
            sql_script = "".join(statements)
        else:
            raise HTTPException(status_code=501, detail="SQL export is not supported for this database dialect.")
        return Response(
            content=sql_script,
            media_type="application/sql",
            headers={"Content-Disposition": 'attachment; filename="examflow-database.sql"'},
        )
    if file_format=="csv":
        output=io.StringIO()
        writer=csv.DictWriter(output,fieldnames=["assignment_id","exam_id","course_code","course_name","room_id","room_name","invigilator_ids","start","end","enrolled","capacity","status"])
        writer.writeheader()
        for row in assignment_rows(db):
            writer.writerow({"assignment_id":row["id"],**{k:row[k] for k in writer.fieldnames if k!="assignment_id" and k in row},"invigilator_ids":";".join(row["invigilator_ids"])})
        return Response(content=output.getvalue(),media_type="text/csv",
            headers={"Content-Disposition":'attachment; filename="examflow-schedule.csv"'})
    raise HTTPException(404,detail="Export format must be csv, json or sql.")

@app.get("/api/v1/exports/ground-truth/{file_format}")
def export_ground_truth(file_format: str, db: Session=Depends(get_db)):
    """Export evaluation labels separately from scheduler input and schedule exports."""
    labels = db.query(models.EdgeCaseLabel).order_by(models.EdgeCaseLabel.id).all()
    rows = [{"id": row.id, "case_code": row.case_code, "entity_type": row.entity_type,
             "entity_id": row.entity_id, "expected_detection": row.expected_detection}
            for row in labels]
    if file_format == "json":
        return Response(
            content=json.dumps({"ground_truth": rows}, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="ground_truth.json"'},
        )
    if file_format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "id", "case_code", "entity_type", "entity_id", "expected_detection"
        ])
        writer.writeheader()
        writer.writerows(rows)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="ground_truth.csv"'},
        )
    raise HTTPException(status_code=404, detail="Ground-truth format must be csv or json.")


@app.get("/api/v1/edge-cases")
def edge_cases_list(db: Session=Depends(get_db)):
    # Evaluation labels are exposed for reporting only; scheduling logic never reads them.
    return [{"id":x.id,"case_code":x.case_code,"entity_type":x.entity_type,"entity_id":x.entity_id,
        "expected_detection":x.expected_detection} for x in db.query(models.EdgeCaseLabel).order_by(models.EdgeCaseLabel.id).all()]
