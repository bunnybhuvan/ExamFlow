from datetime import date, datetime
from sqlalchemy import String, Integer, Date, DateTime, Boolean, Float, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Enrollment(Base):
    __tablename__ = "enrollments"
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)

class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    program: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    accommodations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    course_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    course_name: Mapped[str] = mapped_column(String(180), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    enrollment: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    required_equipment: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    accommodations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    building: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    equipment: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    accessible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closures: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    utilization: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

class Invigilator(Base):
    __tablename__ = "invigilators"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    qualifications: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    available_days: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    max_duties: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    assigned_duties: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conflicts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), unique=True, nullable=False)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    invigilator_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)

class UnassignedExam(Base):
    __tablename__ = "unassigned_exams"
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    reason_code: Mapped[str] = mapped_column(String(60), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

class ScheduleRun(Base):
    __tablename__ = "schedule_runs"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled: Mapped[int] = mapped_column(Integer, nullable=False)
    unassigned: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    strategy: Mapped[str] = mapped_column(String(20), nullable=False)

class ScheduleEvent(Base):
    __tablename__ = "schedule_events"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(160), default="scheduler-engine", nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)

class EdgeCaseLabel(Base):
    """Evaluation-only labels. Scheduler code must never query this table."""
    __tablename__ = "edge_case_labels"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    case_code: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(160), nullable=False)
    expected_detection: Mapped[str] = mapped_column(Text, nullable=False)
