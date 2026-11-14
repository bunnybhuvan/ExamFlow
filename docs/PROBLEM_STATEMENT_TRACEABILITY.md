# Problem-statement traceability and data dictionary

This document describes the schema currently implemented by ExamFlow. It deliberately distinguishes persisted relational fields from JSON-backed attributes so the documentation does not imply that flattened data is normalized.

## Entity dictionary

| Entity / table | Field | Type | Required | Key / validation | Meaning |
|---|---|---:|---|---|---|
| Student / students | id | VARCHAR(32) | Yes | PK; `STU-000001` | Stable student identifier |
| Student | name | VARCHAR(160) | Yes | Non-empty | Student display name |
| Student | email | VARCHAR(200) | Yes | Unique, indexed | Synthetic contact address |
| Student | program | VARCHAR(100) | Yes | Department/program label | Academic program |
| Student | year | INTEGER | Yes | 1–4 for generated data | Study year |
| Student | accommodations | JSON array | Yes | Default `[]`; supported tags include accessible_seating, screen_reader, extra_time_25, separate_room | Student accommodation requirements |
| Exam / exams | id | VARCHAR(40) | Yes | PK; `EXAM-YYYY-NNNNNN` | Stable exam identifier |
| Exam | course_code | VARCHAR(30) | Yes | Unique, indexed | Course code (currently stored on Exam) |
| Exam | course_name | VARCHAR(180) | Yes | Non-empty | Course title (currently stored on Exam) |
| Exam | department | VARCHAR(100) | Yes | Non-empty | Owning department |
| Exam | duration_minutes | INTEGER | Yes | 15–600 via API | Base exam duration, minutes |
| Exam | enrollment | INTEGER | Yes | Non-negative; reconciled to enrollments | Cached enrolled-student count |
| Exam | window_start / window_end | DATE | Yes | End must be >= start | Permitted scheduling window |
| Exam | required_equipment | JSON array | Yes | Default `[]` | Required room equipment |
| Exam | accommodations | JSON array | Yes | Default `[]` | Exam-wide accommodation tags |
| Exam | status | VARCHAR(20) | Yes | Lifecycle label | pending / scheduled / unassigned |
| Enrollment / enrollments | student_id | VARCHAR(32) | Yes | PK part; FK students.id, cascade delete | Enrolled student |
| Enrollment | exam_id | VARCHAR(40) | Yes | PK part; FK exams.id, cascade delete | Exam enrolled in |
| Room / rooms | id | VARCHAR(32) | Yes | PK; `ROOM-NNNNNN` | Stable room identifier |
| Room | name / building | VARCHAR | Yes | Non-empty | Room and building labels |
| Room | capacity | INTEGER | Yes | Positive | Maximum seats |
| Room | equipment | JSON array | Yes | Default `[]` | Installed equipment |
| Room | accessible | BOOLEAN | Yes | Default false | Accessibility capability |
| Room | closures | JSON array | Yes | Date-range objects with start/end/reason | Unavailable periods |
| Room | utilization | FLOAT | Yes | 0–1 expected | Active schedule utilization ratio |
| Invigilator / invigilators | id | VARCHAR(32) | Yes | PK; `INV-NNNNNN` | Stable invigilator identifier |
| Invigilator | name / email / department | VARCHAR | Yes | Email unique | Staff identity and department |
| Invigilator | qualifications | JSON array | Yes | Default `[]` | Qualified equipment/skills |
| Invigilator | available_days | JSON array | Yes | ISO dates | Availability dates |
| Invigilator | max_duties / assigned_duties / conflicts | INTEGER | Yes | Non-negative | Workload counters |
| Assignment / assignments | id | VARCHAR(160) | Yes | PK; `ASN-<exam>-<room>` | Active assignment identifier |
| Assignment | exam_id | VARCHAR(40) | Yes | FK exams.id, indexed | Assigned exam |
| Assignment | room_id | VARCHAR(32) | Yes | FK rooms.id | Assigned room |
| Assignment | student_ids | JSON array | Yes | Default `[]` | Students allocated to this room |
| Assignment | invigilator_ids | JSON array | Yes | Default `[]` | Assigned staff identifiers |
| Assignment | start / end | DATETIME | Yes | End > start | Assignment interval |
| Assignment | status | VARCHAR(20) | Yes | Default confirmed | Assignment state |
| UnassignedExam / unassigned_exams | exam_id | VARCHAR(40) | Yes | PK; FK exams.id, cascade delete | Unassigned exam |
| UnassignedExam | reason_code / reason | VARCHAR / TEXT | Yes | Stable reason code and explanation | Why no valid assignment was found |
| ScheduleRun / schedule_runs | id | VARCHAR(50) | Yes | PK; RUN prefix | Immutable schedule-run identifier |
| ScheduleRun | created_at | DATETIME | Yes | UTC | Run timestamp |
| ScheduleRun | seed / scheduled / unassigned / duration_ms | INTEGER | Yes | Non-negative counts/duration | Run inputs and outcome |
| ScheduleRun | strategy | VARCHAR(20) | Yes | balanced / compact / spread | Scheduling strategy |
| ScheduleEvent / schedule_events | id | VARCHAR(50) | Yes | PK; EVT prefix | Audit event identifier |
| ScheduleEvent | timestamp / actor / action | DATETIME / VARCHAR | Yes | UTC timestamp | Who changed what and when |
| ScheduleEvent | entity_type / entity_id / summary | VARCHAR / TEXT | Yes | Non-empty | Event subject and explanation |
| ScheduleEvent | before / after | JSON | No | Nullable snapshots | State transition details; schedule-generated events include immutable assignment/unassigned snapshots |
| EdgeCaseLabel / edge_case_labels | id | VARCHAR(80) | Yes | PK | Evaluation label identifier |
| EdgeCaseLabel | case_code / entity_type / entity_id | VARCHAR | Yes | Controlled scenario metadata | Deliberate edge-case locator |
| EdgeCaseLabel | expected_detection | TEXT | Yes | Non-empty | Expected solver/validator outcome; evaluation-only |
| User / users | id | VARCHAR(40) | Yes | PK | Account identifier |
| User | email | VARCHAR(200) | Yes | Unique, indexed | Login identity |
| User | password_hash | VARCHAR(300) | Yes | Hash only | Password verifier |
| User | role / active / created_at | VARCHAR / BOOLEAN / DATETIME | Yes | admin, scheduler, viewer | Access-control state |

## Relationships and cardinality

- Student 1:N Enrollment; Exam 1:N Enrollment. Together they form Student M:N Exam through the composite-key Enrollment bridge.
- Exam 1:N Assignment (one exam may occupy multiple rooms for separate-room accommodation).
- Room 1:N Assignment.
- Exam 0:1 UnassignedExam in the active schedule snapshot.
- ScheduleRun 1:N audit snapshot events conceptually through the run identifier stored in ScheduleEvent.after. The current schema does not enforce this as a foreign key.
- EdgeCaseLabel is evaluation-only and intentionally has no foreign key to a single domain table because a label may refer to an exam pair or a student.
- User has no domain-table foreign keys in the current release.

## Runtime normalization status\n\nThe scheduling engine now resolves course names/departments through the Course and ExamCourse relationship, required equipment and exam-level requirements through ExamRequirement, effective-dated room capacities through RoomCapacity, invigilator availability by date through Availability, and student/exam accommodation requirements through Accommodation. Legacy fields are used only as compatibility fallbacks when normalized records do not exist.\n\n## Known normalization limitations

Legacy columns remain for backward compatibility and are populated as mirrors by the generator. Normalized tables are now read by the scheduler when present. Effective-dated room capacity and date-specific staff availability are enforced by the runtime scheduling path.

## Deterministic data generation and validation

- Default scale: 5,000 students, 300 exams, 100 rooms and 200 invigilators.
- IDs are deterministic for a fixed scale and generation order.
- Generator seed is supplied as an integer; the challenge baseline seed is 20261022 (API default remains configurable).
- `tests/test_api.py::test_fixed_seed_reproduces_dataset_and_schedule` regenerates twice using the same seed and compares exported API records.
- `tests/test_api.py::test_labelled_edge_cases_are_separate_and_never_break_hard_constraints` verifies the five required labelled scenarios without allowing an invalid assignment.
- `GET /api/v1/exports/ground-truth/csv` and `GET /api/v1/exports/ground-truth/json` export evaluation labels separately from schedule/input exports.
- `GET /api/v1/reports/validation` reports hard-constraint violations; `GET /api/v1/reports/metrics` derives conflict counts from those checks.

## Required edge-case catalogue

| Case code | Scenario | Expected result |
|---|---|---|
| STUDENT_OVERLAP | Two exams share enrolled students | Solver must not overlap the student's exams |
| INSUFFICIENT_ROOM_CAPACITY | Exam enrollment exceeds every room | Exam remains unassigned with a capacity reason |
| INVIGILATOR_DOUBLE_BOOKING | Two same-day exams compete for one available invigilator | One exam remains unassigned; staff is never double-booked |
| ACCOMMODATION_UNAVAILABLE | Required accessible room is unavailable | Exam remains unassigned with accommodation reason |
| EXAM_IN_CLOSED_ROOMS | All rooms are closed in the exam's only window | Exam remains unassigned with room-closed reason |

## Operational traceability

Dataset regeneration replaces the active synthetic master/transaction rows, but it must not delete prior ScheduleRun or ScheduleEvent records. Each completed schedule run stores a compact snapshot of assignment IDs, room/staff/student allocation, time interval, unassigned reason codes and explanations in its audit event. The active assignments endpoint continues to represent only the latest schedule.


## Normalized relational entities (added in the domain-model extension)

The backend now creates these normalized tables alongside legacy compatibility columns:

- `courses`: course master records keyed by course code.
- `exam_courses`: explicit exam-to-course relationship with foreign keys to exams and courses.
- `exam_requirements`: one row per required equipment or accommodation requirement.
- `room_capacities`: effective-dated capacity records with positive-capacity and date-range checks.
- `availabilities`: one row per invigilator/date with uniqueness and a foreign key.
- `accommodations`: student- or exam-scoped accommodation records with subject and effective-date checks.

The legacy JSON/scalar fields remain in place for backward compatibility with the existing scheduling engine and API. Generated datasets now populate both representations from the same deterministic source records. This is an additive schema change; no existing tables or production rows are dropped. The scheduling engine reads normalized Course/ExamCourse, ExamRequirement, RoomCapacity, Availability and Accommodation records when present. Legacy scalar/JSON columns are compatibility fallbacks for manually-created or pre-normalization records. Runtime tests deliberately make normalized availability and capacity disagree with the legacy mirrors and assert that normalized records control the scheduling result.


## Reproducibility and complete data package

- `GET /api/v1/exports/reproducibility` returns deterministic per-table row counts and SHA-256 hashes for all generated domain tables. It excludes volatile run/audit timestamps.
- `GET /api/v1/exports/bundle` returns a ZIP with CSV, JSON and SQL exports for each domain, schedule and ground-truth table, a manifest with the fixed seed, generator command, source provenance, row counts and checksums, and a README.
- `GET /api/v1/exports/sql` remains the portable database schema/data snapshot. The bundle README links the user to this separate SQL export because database SQL is dialect-specific.
