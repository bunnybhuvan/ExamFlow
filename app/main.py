from contextlib import asynccontextmanager
from datetime import datetime
import csv, io, json, os
from datetime import timezone
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from .database import Base, engine, get_db
from . import models
from .schemas import DatasetRequest, ScheduleRequest, ExamInput
from .services.scheduler import (generate_dataset, generate_schedule, assignment_rows,
    unassigned_rows, metrics_report, validation_report, add_event)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="ExamFlow API", description="Deterministic examination scheduling and validation service.", version="1.0.0", lifespan=lifespan)
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

@app.get("/api/v1/exports/{file_format}")
def exports(file_format: str, db: Session=Depends(get_db)):
    if file_format=="json":
        data={"metrics":metrics_report(db),"exams":[{**{k:getattr(e,k) for k in ["id","course_code","course_name","department","duration_minutes","enrollment","status"]},"window_start":e.window_start.isoformat(),"window_end":e.window_end.isoformat(),"required_equipment":e.required_equipment,"accommodations":e.accommodations} for e in db.query(models.Exam).all()],
            "assignments":assignment_rows(db),"unassigned":unassigned_rows(db),"validation":validation_report(db)}
        return Response(content=json.dumps(data,default=str,indent=2),media_type="application/json",
            headers={"Content-Disposition":'attachment; filename="examflow-schedule.json"'})
    if file_format=="sql":
        bind = db.get_bind()
        if bind.dialect.name != "sqlite":
            raise HTTPException(
                status_code=501,
                detail="SQL dump export is currently supported for SQLite databases only.",
            )
        raw_connection = bind.raw_connection()
        try:
            # SQLite's dump emits schema and data in table-name order. Disable FK
            # enforcement for the import transaction, then restore it at the end.
            sqlite_connection = raw_connection.driver_connection
            dump = "\\n".join(sqlite_connection.iterdump())
            sql_script = (
                "-- ExamFlow database export; generated from the active database.\\n"
                "PRAGMA foreign_keys=OFF;\\n"
                + dump
                + "\\nPRAGMA foreign_keys=ON;\\n"
            )
        finally:
            raw_connection.close()
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

@app.get("/api/v1/edge-cases")
def edge_cases_list(db: Session=Depends(get_db)):
    # Evaluation labels are exposed for reporting only; scheduling logic never reads them.
    return [{"id":x.id,"case_code":x.case_code,"entity_type":x.entity_type,"entity_id":x.entity_id,
        "expected_detection":x.expected_detection} for x in db.query(models.EdgeCaseLabel).order_by(models.EdgeCaseLabel.id).all()]
