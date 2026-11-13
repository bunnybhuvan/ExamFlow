from datetime import date, datetime, timezone
from sqlalchemy import String, Integer, Date, DateTime, Boolean, Float, ForeignKey, JSON, Text, UniqueConstraint, CheckConstraint
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
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
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


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Course(Base):
    """Normalized course master record; one course may have one or more exam offerings."""
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)


class ExamCourse(Base):
    """Explicit exam-to-course relationship, retained separately from legacy exam labels."""
    __tablename__ = "exam_courses"
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, unique=True)


class ExamRequirement(Base):
    __tablename__ = "exam_requirements"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    requirement_type: Mapped[str] = mapped_column(String(40), nullable=False)
    requirement_value: Mapped[str] = mapped_column(String(120), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    __table_args__ = (UniqueConstraint("exam_id", "requirement_type", "requirement_value",
                                       name="uq_exam_requirement_value"),)


class RoomCapacity(Base):
    __tablename__ = "room_capacities"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    __table_args__ = (CheckConstraint("capacity > 0", name="ck_room_capacity_positive"),
                      CheckConstraint("effective_to IS NULL OR effective_to >= effective_from",
                                      name="ck_room_capacity_dates"))


class Availability(Base):
    __tablename__ = "availabilities"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    invigilator_id: Mapped[str] = mapped_column(ForeignKey("invigilators.id", ondelete="CASCADE"), nullable=False, index=True)
    available_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    __table_args__ = (UniqueConstraint("invigilator_id", "available_date", name="uq_invigilator_availability_date"),)


class Accommodation(Base):
    __tablename__ = "accommodations"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    student_id: Mapped[str | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    exam_id: Mapped[str | None] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=True, index=True)
    accommodation_type: Mapped[str] = mapped_column(String(60), nullable=False)
    details: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    __table_args__ = (CheckConstraint("student_id IS NOT NULL OR exam_id IS NOT NULL",
                                      name="ck_accommodation_has_subject"),
                      CheckConstraint("effective_to IS NULL OR effective_to >= effective_from",
                                      name="ck_accommodation_dates"))
