import random, time, uuid, math
from datetime import date, datetime, time as dtime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import (Student, Exam, Room, Invigilator, Enrollment, Assignment,
                      UnassignedExam, ScheduleRun, ScheduleEvent, EdgeCaseLabel,
                      Course, ExamCourse, ExamRequirement, RoomCapacity, Availability, Accommodation)

DEPARTMENTS = ["Computer Science", "Mathematics", "Physics", "Chemistry", "Economics", "Biology", "Engineering", "Statistics"]
PREFIX = {"Computer Science":"CS", "Mathematics":"MATH", "Physics":"PHYS", "Chemistry":"CHEM", "Economics":"ECON", "Biology":"BIO", "Engineering":"ENG", "Statistics":"STAT"}
TOPICS = ["Data Structures", "Algorithms", "Operating Systems", "Networks", "Database Systems", "Applied Mathematics", "Systems Theory", "Machine Learning", "Statistics", "Digital Logic"]
EQUIPMENT = ["Projector", "Computers", "Calculators", "Lab benches", "Audio system"]
FIRST = ["Aarav","Maya","Liam","Sofia","Noah","Zara","Ethan","Priya","Lucas","Amara","Ravi","Chloe","Mateo","Hana","Ishaan","Nia"]
LAST = ["Patel","Chen","Garcia","Kim","Singh","Rossi","Silva","Sharma","Khan","Iyer","Rao","Das"]
BUILDINGS = ["Turing Hall","Curie Centre","Newton Block","Tagore Wing","Vikram Complex"]

def add_event(db: Session, action: str, entity_type: str, entity_id: str, summary: str, before=None, after=None):
    db.add(ScheduleEvent(id=f"EVT-{uuid.uuid4().hex[:16].upper()}", actor="scheduler-engine",
        action=action, entity_type=entity_type, entity_id=entity_id, summary=summary,
        before=before, after=after, timestamp=datetime.now(timezone.utc)))

def generate_dataset(db: Session, p):
    # Replace the active synthetic dataset, but never delete audit events or prior run records.
    # ScheduleEvent.after stores immutable snapshots of completed schedule runs.
    for model in [Assignment, UnassignedExam, Enrollment, EdgeCaseLabel,
                  ExamCourse, ExamRequirement, RoomCapacity, Availability, Accommodation,
                  Student, Exam, Room, Invigilator, Course]:
        db.query(model).delete(synchronize_session=False)
    db.flush()
    rng = random.Random(p.seed)
    start = date(2026, 12, 7)
    days = [start + timedelta(days=i) for i in range(28) if (start + timedelta(days=i)).weekday() < 5]
    rooms = []
    for i in range(p.rooms):
        capacity = [30, 50, 80, 100, 150, 200, 240][i % 7]
        rooms.append(Room(id=f"ROOM-{i+1:06d}", name=f"{BUILDINGS[i % len(BUILDINGS)]} {100+i}",
            building=BUILDINGS[i % len(BUILDINGS)], capacity=capacity,
            equipment=rng.sample(EQUIPMENT, k=rng.randint(1, 3)), accessible=(i % 5 != 0),
            closures=[], utilization=0.0))
    exams = []
    for i in range(p.exams):
        dept = DEPARTMENTS[i % len(DEPARTMENTS)]
        ws = days[rng.randrange(min(5, len(days)))]
        we = min(days[-1], ws + timedelta(days=20))
        exams.append(Exam(id=f"EXAM-2026-{i+1:06d}", course_code=f"{PREFIX[dept]}{1000+i:04d}",
            course_name=f"{rng.choice(TOPICS)}", department=dept,
            duration_minutes=rng.choice([90, 120, 120, 150, 180]), enrollment=0,
            window_start=ws, window_end=we, required_equipment=(rng.sample(EQUIPMENT, 1) if rng.random() < .22 else []),
            accommodations=[], status="pending"))
    students = []
    enrollments = []
    for i in range(p.students):
        first, last = rng.choice(FIRST), rng.choice(LAST)
        students.append(Student(id=f"STU-{i+1:06d}", name=f"{first} {last}",
            email=f"student{i+1:06d}@examflow.test", program=rng.choice(DEPARTMENTS),
            year=rng.randint(1, 4), accommodations=(["extra_time_25"] if rng.random() < .015 else
                ["accessible_seating"] if rng.random() < .02 else
                ["screen_reader"] if rng.random() < .025 else [])))
        count = min(len(exams), rng.randint(3, 6))
        for exam in rng.sample(exams, count):
            enrollments.append(Enrollment(student_id=f"STU-{i+1:06d}", exam_id=exam.id))
            exam.enrollment += 1
    invigilators = []
    for i in range(p.invigilators):
        invigilators.append(Invigilator(id=f"INV-{i+1:06d}", name=f"Dr. {rng.choice(FIRST)} {rng.choice(LAST)}",
            email=f"invigilator{i+1:06d}@examflow.test", department=rng.choice(DEPARTMENTS),
            qualifications=rng.sample(EQUIPMENT, k=rng.randint(1, 3)),
            available_days=[d.isoformat() for d in days if rng.random() > .15],
            max_duties=5, assigned_duties=0, conflicts=0))
    db.add_all(students + exams + rooms + invigilators + enrollments)
    db.flush()
    if p.include_edge_cases:
        labels = []
        if len(exams) >= 2 and len(students) >= 3:
            # Controlled shared cohort: the solver must place these exams in non-overlapping slots.
            cohort = [s for s in students[1:] if not s.accommodations][:3]
            for student in cohort:
                sid = student.id
                if not db.query(Enrollment).filter_by(student_id=sid, exam_id=exams[0].id).first():
                    db.add(Enrollment(student_id=sid, exam_id=exams[0].id))
                if not db.query(Enrollment).filter_by(student_id=sid, exam_id=exams[1].id).first():
                    db.add(Enrollment(student_id=sid, exam_id=exams[1].id))
            db.flush()
            exams[0].enrollment = db.query(Enrollment).filter_by(exam_id=exams[0].id).count()
            exams[1].enrollment = db.query(Enrollment).filter_by(exam_id=exams[1].id).count()
            labels.append(EdgeCaseLabel(id="EDGE-STUDENT-OVERLAP", case_code="STUDENT_OVERLAP",
                entity_type="exam_pair", entity_id=f"{exams[0].id},{exams[1].id}",
                expected_detection="Shared students must never receive overlapping exam assignments."))
        if exams and students:
            target = exams[-1]
            # Make one exam larger than every available room.
            for student in students[:min(len(students), max(r.capacity for r in rooms)+1)]:
                if not db.query(Enrollment).filter_by(student_id=student.id, exam_id=target.id).first():
                    db.add(Enrollment(student_id=student.id, exam_id=target.id))
            db.flush()
            db.flush()
            target.enrollment = db.query(Enrollment).filter_by(exam_id=target.id).count()
            labels.append(EdgeCaseLabel(id="EDGE-ROOM-CAPACITY", case_code="INSUFFICIENT_ROOM_CAPACITY",
                entity_type="exam", entity_id=target.id, expected_detection="No room has sufficient capacity; exam must remain unassigned."))
        if len(exams) >= 2 and rooms:
            target = exams[-2]
            closed_day = target.window_start
            for room in rooms:
                room.closures = [{"start": closed_day.isoformat(), "end": closed_day.isoformat(), "reason":"Controlled closure test"}]
            target.window_start = closed_day
            target.window_end = closed_day
            target.duration_minutes = 90
            target.required_equipment = []
            rows = db.query(Enrollment).filter_by(exam_id=target.id).order_by(Enrollment.student_id).all()
            for row in rows:
                student = db.get(Student, row.student_id)
                if student and student.accommodations:
                    db.delete(row)
            rows = db.query(Enrollment).filter_by(exam_id=target.id).order_by(Enrollment.student_id).all()
            for row in rows[80:]:
                db.delete(row)
            target.enrollment = db.query(Enrollment).filter_by(exam_id=target.id).count()
            labels.append(EdgeCaseLabel(id="EDGE-ROOM-CLOSED", case_code="EXAM_IN_CLOSED_ROOMS",
                entity_type="exam", entity_id=target.id, expected_detection="All rooms are closed during the exam's only permitted date."))
        if students and rooms and exams:
            students[0].accommodations = ["accessible_seating"]
            accommodation_exam = exams[4] if len(exams) > 4 else exams[0]
            for ex in exams:
                if ex.id != accommodation_exam.id:
                    db.query(Enrollment).filter_by(student_id=students[0].id, exam_id=ex.id).delete(synchronize_session=False)
            if not db.query(Enrollment).filter_by(student_id=students[0].id, exam_id=accommodation_exam.id).first():
                db.add(Enrollment(student_id=students[0].id, exam_id=accommodation_exam.id))
            rows = db.query(Enrollment).filter_by(exam_id=accommodation_exam.id).order_by(Enrollment.student_id).all()
            for row in rows[80:]:
                db.delete(row)
            db.flush()
            accommodation_exam.enrollment = db.query(Enrollment).filter_by(exam_id=accommodation_exam.id).count()
            for room in rooms:
                room.accessible = False
            labels.append(EdgeCaseLabel(id="EDGE-ACCOMMODATION", case_code="ACCOMMODATION_UNAVAILABLE",
                entity_type="student", entity_id=students[0].id, expected_detection="Accessible seating is unavailable; affected exam must remain unassigned."))
        if len(exams) >= 4 and invigilators:
            # Only one invigilator is available on this one-day window for two distinct exams.
            constrained_day = days[-1].isoformat()
            for ex in exams[2:4]:
                ex.window_start = date.fromisoformat(constrained_day)
                ex.window_end = date.fromisoformat(constrained_day)
                ex.duration_minutes = 90
                ex.required_equipment = []
            for inv in invigilators:
                inv.available_days = [d for d in (inv.available_days or []) if d != constrained_day]
            invigilators[0].available_days = [constrained_day]
            invigilators[0].max_duties = max(invigilators[0].max_duties, 100)
            shared = set(x.student_id for x in db.query(Enrollment).filter_by(exam_id=exams[2].id).all()) & set(x.student_id for x in db.query(Enrollment).filter_by(exam_id=exams[3].id).all())
            for sid in shared:
                db.query(Enrollment).filter_by(student_id=sid, exam_id=exams[3].id).delete(synchronize_session=False)
            # Keep both test exams below the two-invigilator threshold so the single available
            # invigilator can cover one, while the other must remain unassigned.
            for ex in exams[2:4]:
                rows = db.query(Enrollment).filter_by(exam_id=ex.id).order_by(Enrollment.student_id).all()
                for row in rows:
                    student = db.get(Student, row.student_id)
                    if student and student.accommodations:
                        db.delete(row)
                rows = db.query(Enrollment).filter_by(exam_id=ex.id).order_by(Enrollment.student_id).all()
                for row in rows[80:]:
                    db.delete(row)
                db.flush()
                ex.enrollment = db.query(Enrollment).filter_by(exam_id=ex.id).count()
            labels.append(EdgeCaseLabel(id="EDGE-INVIGILATOR-DOUBLE", case_code="INVIGILATOR_DOUBLE_BOOKING",
                entity_type="exam_pair", entity_id=f"{exams[2].id},{exams[3].id}",
                expected_detection="Only one invigilator is available for two same-day exams; the solver must leave one unassigned rather than double-book staff."))
    if p.include_edge_cases:
        db.add_all(labels)

    # Materialize normalized master/constraint records after edge-case mutations so
    # the relational representation exactly matches the generated baseline.
    course_by_code = {}
    for exam in exams:
        course = course_by_code.get(exam.course_code)
        if course is None:
            course = Course(id=exam.course_code, name=exam.course_name, department=exam.department)
            course_by_code[exam.course_code] = course
        for index, equipment in enumerate(exam.required_equipment or []):
            db.add(ExamRequirement(id=f"REQ-{exam.id}-EQ-{index+1:03d}",
                exam_id=exam.id, requirement_type="equipment", requirement_value=equipment, required=True))
        for index, tag in enumerate(exam.accommodations or []):
            db.add(ExamRequirement(id=f"REQ-{exam.id}-AC-{index+1:03d}",
                exam_id=exam.id, requirement_type="accommodation", requirement_value=str(tag), required=True))
    db.add_all(course_by_code.values())
    db.flush()
    for exam in exams:
        db.add(ExamCourse(exam_id=exam.id, course_id=exam.course_code))

    for room in rooms:
        db.add(RoomCapacity(id=f"CAP-{room.id}-20260101", room_id=room.id,
            capacity=room.capacity, effective_from=date(2026, 1, 1), effective_to=None))

    for invigilator in invigilators:
        for available_day in invigilator.available_days or []:
            db.add(Availability(id=f"AVL-{invigilator.id}-{available_day}",
                invigilator_id=invigilator.id, available_date=date.fromisoformat(available_day),
                is_available=True))

    for student in students:
        for index, tag in enumerate(student.accommodations or []):
            db.add(Accommodation(id=f"ACC-STU-{student.id}-{index+1:03d}",
                student_id=student.id, exam_id=None, accommodation_type=str(tag),
                details="", effective_from=date(2026, 1, 1), effective_to=None))
    for exam in exams:
        for index, tag in enumerate(exam.accommodations or []):
            db.add(Accommodation(id=f"ACC-EXAM-{exam.id}-{index+1:03d}",
                student_id=None, exam_id=exam.id, accommodation_type=str(tag),
                details="", effective_from=date(2026, 1, 1), effective_to=None))

    db.commit()
    add_event(db, "dataset.generated", "dataset", "current",
        f"Generated {len(students)} students, {len(exams)} exams, {len(rooms)} rooms and {len(invigilators)} invigilators (seed {p.seed}).",
        after={"seed":p.seed,"students":len(students),"exams":len(exams),"rooms":len(rooms),"invigilators":len(invigilators),"edge_cases":bool(p.include_edge_cases)})
    db.commit()
    return {"students":len(students),"exams":len(exams),"rooms":len(rooms),"invigilators":len(invigilators),
            "enrollments":db.query(Enrollment).count(),"edge_cases":bool(p.include_edge_cases),"seed":p.seed}

def _overlap(a_start, a_end, b_start, b_end, buffer=0):
    pad = timedelta(minutes=buffer)
    return a_start < b_end + pad and b_start < a_end + pad

def _parse_time(value: str) -> dtime:
    try: return datetime.strptime(value, "%H:%M").time()
    except ValueError: raise ValueError("Times must use HH:MM format")

def generate_schedule(db: Session, p):
    started = time.perf_counter()
    db.query(Assignment).delete(synchronize_session=False)
    db.query(UnassignedExam).delete(synchronize_session=False)
    for inv in db.query(Invigilator).all():
        inv.assigned_duties, inv.conflicts = 0, 0
    exams = db.query(Exam).all()
    rooms = db.query(Room).all()
    invigilators = db.query(Invigilator).all()
    students = db.query(Student).all()
    if not exams:
        raise ValueError("Generate a dataset before generating a schedule.")
    enrollment_map = {}
    for row in db.query(Enrollment).all():
        enrollment_map.setdefault(row.exam_id, []).append(row.student_id)
    student_by_id = {s.id:s for s in students}
    inv_by_id = {v.id:v for v in invigilators}

    # Resolve normalized records once per run. Legacy fields are fallback only for
    # manually-created records that predate normalized data.
    course_by_id = {row.id: row for row in db.query(Course).all()}
    exam_course = {row.exam_id: row.course_id for row in db.query(ExamCourse).all()}
    requirements_by_exam = {}
    for row in db.query(ExamRequirement).all():
        requirements_by_exam.setdefault(row.exam_id, []).append(row)
    accommodations_by_student, accommodations_by_exam = {}, {}
    for row in db.query(Accommodation).all():
        if row.student_id:
            accommodations_by_student.setdefault(row.student_id, []).append(row)
        if row.exam_id:
            accommodations_by_exam.setdefault(row.exam_id, []).append(row)
    availability_by_person = {}
    for row in db.query(Availability).all():
        availability_by_person.setdefault(row.invigilator_id, {})[row.available_date.isoformat()] = row.is_available
    capacities_by_room = {}
    for row in db.query(RoomCapacity).order_by(RoomCapacity.effective_from.desc()).all():
        capacities_by_room.setdefault(row.room_id, []).append(row)

    for ex in exams:
        course_id = exam_course.get(ex.id)
        if course_id in course_by_id:
            ex.course_code = course_id
            ex.course_name = course_by_id[course_id].name
            ex.department = course_by_id[course_id].department
        normalized_requirements = requirements_by_exam.get(ex.id, [])
        if normalized_requirements:
            ex.required_equipment = [r.requirement_value for r in normalized_requirements
                                     if r.requirement_type == "equipment" and r.required]
            ex.accommodations = [r.requirement_value for r in normalized_requirements
                                 if r.requirement_type == "accommodation" and r.required]
        if ex.id in accommodations_by_exam:
            ex.accommodations = sorted(set(ex.accommodations or []) | {
                row.accommodation_type for row in accommodations_by_exam[ex.id]
                if row.effective_from <= p.end_date and (row.effective_to is None or row.effective_to >= p.start_date)
            })
    for student in students:
        if student.id in accommodations_by_student:
            student.accommodations = sorted({
                row.accommodation_type for row in accommodations_by_student[student.id]
                if row.effective_from <= p.end_date and (row.effective_to is None or row.effective_to >= p.start_date)
            })

    def capacity_at(room, on_date):
        records = capacities_by_room.get(room.id, [])
        for record in records:
            if record.effective_from <= on_date and (record.effective_to is None or record.effective_to >= on_date):
                return record.capacity
        return room.capacity

    def invigilator_available(person, on_date):
        records = availability_by_person.get(person.id)
        if records is not None:
            return bool(records.get(on_date.isoformat(), False))
        return on_date.isoformat() in (person.available_days or [])
    room_assignments, inv_assignments, student_assignments = {}, {}, {}
    day_load, student_day_load = {}, {}
    day_start, day_end = _parse_time(p.daily_start), _parse_time(p.daily_end)
    offsets = [0, 210, 360]
    slots = []
    d = p.start_date
    while d <= p.end_date:
        if d.weekday() < 5:
            for off in offsets:
                start_dt = datetime.combine(d, day_start) + timedelta(minutes=off)
                end_dt = start_dt + timedelta(minutes=1)
                if start_dt.time() < day_end:
                    slots.append(start_dt)
        d += timedelta(days=1)
    # Constraint-first: highest enrollment, equipment and accessibility needs first.
    def difficulty(ex):
        ids = enrollment_map.get(ex.id, [])
        needs_access = any(any(k in (student_by_id[sid].accommodations or []) for k in ["accessible_seating","wheelchair"]) for sid in ids if sid in student_by_id)
        return (needs_access, len(ex.required_equipment), ex.enrollment, ex.duration_minutes)
    exams.sort(key=difficulty, reverse=True)
    assigned, unassigned = [], []
    for ex in exams:
        eligible_students = enrollment_map.get(ex.id, [])
        exam_accommodation_tags = {str(tag).strip().lower().replace(" ", "_").replace("-", "_").replace("%", "")
            for tag in (ex.accommodations or [])}
        accommodation_tags = set(exam_accommodation_tags)
        for sid in eligible_students:
            if sid in student_by_id:
                accommodation_tags.update(str(tag).strip().lower().replace(" ", "_").replace("%", "")
                    for tag in (student_by_id[sid].accommodations or []))
        separate_ids = [sid for sid in eligible_students if
            "separate_room" in exam_accommodation_tags or
            bool({str(tag).strip().lower().replace(" ", "_").replace("-", "_")
                  for tag in (student_by_id[sid].accommodations or [])} & {"separate_room", "individual_room"})]
        if separate_ids:
            regular_ids = [sid for sid in eligible_students if sid not in set(separate_ids)]
            duration = math.ceil(ex.duration_minutes * 1.25) if accommodation_tags & {"extra_time_25", "extra_time", "25_extra_time"} else ex.duration_minutes
            equipment = set(ex.required_equipment or [])
            if "screen_reader" in accommodation_tags:
                equipment.add("Computers")
            exam_slots = [slot for slot in slots if ex.window_start <= slot.date() <= ex.window_end]
            exam_slots.sort(key=lambda slot: (day_load.get(slot.date().isoformat(), 0), slot))
            selected_plan = None
            for start_dt in exam_slots:
                end_dt = start_dt + timedelta(minutes=duration)
                if end_dt.time() > day_end:
                    continue
                day_key = start_dt.date().isoformat()
                if any(any(_overlap(start_dt,end_dt,x,y,p.break_buffer_minutes) for x,y in student_assignments.get(sid,[])) for sid in eligible_students):
                    continue
                free_rooms = [room for room in sorted(rooms,key=lambda room:(room.capacity,room.id))
                    if equipment.issubset(set(room.equipment or []))
                    and not any(cl.get("start","") <= day_key <= cl.get("end","") for cl in (room.closures or []))
                    and not any(_overlap(start_dt,end_dt,x,y) for x,y in room_assignments.get(room.id,[]))]
                groups = []
                used_rooms = set()
                valid = True
                for sid in sorted(separate_ids):
                    tags = exam_accommodation_tags | {str(tag).strip().lower().replace(" ", "_").replace("-", "_") for tag in (student_by_id[sid].accommodations or [])}
                    accessible = bool(tags & {"accessible_seating","wheelchair","accessible"})
                    choices = [room for room in free_rooms if room.id not in used_rooms and (not accessible or room.accessible)]
                    if not choices:
                        valid = False
                        break
                    room = choices[0]
                    groups.append((room,[sid]))
                    used_rooms.add(room.id)
                if valid and regular_ids:
                    accessible = bool(exam_accommodation_tags & {"accessible_seating","wheelchair","accessible"}) or any(
                        {str(tag).strip().lower().replace(" ", "_").replace("-", "_") for tag in (student_by_id[sid].accommodations or [])}
                        & {"accessible_seating","wheelchair","accessible"} for sid in regular_ids)
                    choices = [room for room in free_rooms if room.id not in used_rooms
                        and room.capacity >= len(regular_ids) and (not accessible or room.accessible)]
                    if choices:
                        groups.append((choices[0],regular_ids))
                        used_rooms.add(choices[0].id)
                    else:
                        valid = False
                if not valid or not groups:
                    continue
                used_staff = set()
                staffed = []
                for room, cohort in groups:
                    needed = 2 if len(cohort) >= 150 else 1
                    staff = [person for person in invigilators if person.id not in used_staff
                        and invigilator_available(person, start_dt.date())
                        and person.assigned_duties < person.max_duties
                        and not any(_overlap(start_dt,end_dt,x,y) for x,y in inv_assignments.get(person.id,[]))]
                    staff.sort(key=lambda person:(person.assigned_duties,person.id))
                    if len(staff) < needed:
                        valid = False
                        break
                    selected_staff = staff[:needed]
                    used_staff.update(person.id for person in selected_staff)
                    staffed.append((room,cohort,selected_staff))
                if valid:
                    selected_plan = (start_dt,end_dt,staffed)
                    break
            if not selected_plan:
                unassigned.append((ex,"ACCOMMODATION_CONFLICT",
                    "Separate-room accommodation could not be satisfied with the available dedicated rooms, accessible facilities and invigilators."))
                ex.status="unassigned"
                continue
            start_dt,end_dt,staffed = selected_plan
            for room,cohort,staff in staffed:
                db.add(Assignment(id=f"ASN-{ex.id}-{room.id}",exam_id=ex.id,room_id=room.id,
                    student_ids=cohort,invigilator_ids=[person.id for person in staff],
                    start=start_dt,end=end_dt,status="confirmed"))
                room_assignments.setdefault(room.id,[]).append((start_dt,end_dt))
                for sid in cohort:
                    student_assignments.setdefault(sid,[]).append((start_dt,end_dt))
                    student_day_load[(sid,start_dt.date().isoformat())]=student_day_load.get((sid,start_dt.date().isoformat()),0)+1
                for person in staff:
                    inv_assignments.setdefault(person.id,[]).append((start_dt,end_dt))
                    person.assigned_duties += 1
            day_key=start_dt.date().isoformat()
            day_load[day_key]=day_load.get(day_key,0)+1
            ex.status="scheduled"
            assigned.append(ex)
            continue
        needs_access = bool(accommodation_tags & {"accessible_seating","wheelchair","accessible"})
        needs_extra_time = bool(accommodation_tags & {"extra_time_25","extra_time","25_extra_time"})
        needs_screen_reader = "screen_reader" in accommodation_tags
        effective_duration = math.ceil(ex.duration_minutes * 1.25) if needs_extra_time else ex.duration_minutes
        required_equipment = set(ex.required_equipment or [])
        if needs_screen_reader:
            required_equipment.add("Computers")
        candidate_dates = [s for s in slots if ex.window_start <= s.date() <= ex.window_end]
        if p.strategy == "balanced":
            candidate_dates.sort(key=lambda slot:(day_load.get(slot.date().isoformat(),0),slot))
        elif p.strategy == "spread":
            candidate_dates.sort(key=lambda slot:(sum(student_day_load.get((sid,slot.date().isoformat()),0) for sid in eligible_students),
                day_load.get(slot.date().isoformat(),0),slot))
        else:  # compact: fill the earliest feasible days first
            candidate_dates.sort()
        if not candidate_dates:
            unassigned.append((ex,"NO_VALID_TIME_SLOT","No weekday time slot falls inside the exam scheduling window."))
            ex.status="unassigned"; continue
        if not any(capacity_at(r, slot.date()) >= ex.enrollment for r in rooms for slot in candidate_dates):
            unassigned.append((ex,"NO_ROOM_CAPACITY","No available room can seat all enrolled students."))
            ex.status="unassigned"; continue
        if needs_access and not any(r.accessible and capacity_at(r, slot.date()) >= ex.enrollment for r in rooms for slot in candidate_dates):
            unassigned.append((ex,"ACCOMMODATION_CONFLICT","No room satisfies the accessibility accommodation and capacity requirements."))
            ex.status="unassigned"; continue
        if required_equipment and not any(required_equipment.issubset(set(r.equipment or [])) and capacity_at(r, slot.date()) >= ex.enrollment for r in rooms for slot in candidate_dates):
            code = "ACCOMMODATION_CONFLICT" if needs_screen_reader else "EQUIPMENT_UNAVAILABLE"
            reason = "No sufficiently large room provides the computer equipment required by a screen-reader accommodation." if needs_screen_reader else "No sufficiently large room provides all required equipment."
            unassigned.append((ex,code,reason))
            ex.status="unassigned"; continue
        placed = None
        saw_closed = False; saw_room = False; saw_inv = False; saw_student = False
        for start_dt in candidate_dates:
            end_dt = start_dt + timedelta(minutes=effective_duration)
            if end_dt.time() > day_end: continue
            day_key = start_dt.date().isoformat()
            candidate_rooms = sorted([r for r in rooms if capacity_at(r, start_dt.date()) >= ex.enrollment
                and (not needs_access or r.accessible)
                and required_equipment.issubset(set(r.equipment or []))],
                key=lambda r:(r.capacity, r.id))
            for room in candidate_rooms:
                closures = room.closures or []
                if any(c.get("start","") <= day_key <= c.get("end","") for c in closures):
                    saw_closed=True; continue
                if any(_overlap(start_dt,end_dt,a,b) for a,b in room_assignments.get(room.id,[])):
                    saw_room=True; continue
                cohort_conflict=False
                for sid in eligible_students:
                    for a,b in student_assignments.get(sid,[]):
                        if _overlap(start_dt,end_dt,a,b,p.break_buffer_minutes):
                            cohort_conflict=True; break
                    if cohort_conflict: break
                if cohort_conflict:
                    saw_student=True; continue
                needed = 2 if ex.enrollment >= 150 else 1
                available = [v for v in invigilators if invigilator_available(v, start_dt.date())
                    and v.assigned_duties < v.max_duties
                    and not any(_overlap(start_dt,end_dt,a,b) for a,b in inv_assignments.get(v.id,[]))]
                available.sort(key=lambda v:(v.assigned_duties,v.id))
                if len(available) < needed:
                    saw_inv=True; continue
                selected=available[:needed]
                placed=(room,start_dt,end_dt,selected)
                break
            if placed: break
        if not placed:
            if saw_student: reason=("STUDENT_CONFLICT","Every feasible room and time slot conflicts with an enrolled student's other exam or required break buffer.")
            elif saw_closed: reason=("ROOM_CLOSED","Rooms with sufficient capacity are closed during the available exam window.")
            elif saw_inv: reason=("NO_INVIGILATOR","No available invigilator can cover the exam without a duty or time conflict.")
            elif saw_room: reason=("NO_VALID_TIME_SLOT","All suitable rooms are occupied in the available time slots.")
            else: reason=("NO_VALID_TIME_SLOT","No slot satisfies room, equipment, availability and duration constraints.")
            unassigned.append((ex,*reason)); ex.status="unassigned"; continue
        room,start_dt,end_dt,selected=placed
        assignment_id=f"ASN-{ex.id}-{room.id}"
        assignment=Assignment(id=assignment_id,exam_id=ex.id,room_id=room.id,
            student_ids=eligible_students,invigilator_ids=[v.id for v in selected],
            start=start_dt,end=end_dt,status="confirmed")
        db.add(assignment); assigned.append(assignment)
        room_assignments.setdefault(room.id,[]).append((start_dt,end_dt))
        day_key=start_dt.date().isoformat()
        day_load[day_key]=day_load.get(day_key,0)+1
        for sid in eligible_students:
            student_assignments.setdefault(sid,[]).append((start_dt,end_dt))
            student_day_load[(sid,day_key)]=student_day_load.get((sid,day_key),0)+1
        for v in selected:
            inv_assignments.setdefault(v.id,[]).append((start_dt,end_dt)); v.assigned_duties+=1
        ex.status="scheduled"
    for ex,code,reason in unassigned:
        db.add(UnassignedExam(exam_id=ex.id,reason_code=code,reason=reason))
    total_slots=max(1,len(slots))
    for room in rooms:
        room.utilization=len(room_assignments.get(room.id,[]))/total_slots
    duration_ms=round((time.perf_counter()-started)*1000)
    run_id=f"RUN-{uuid.uuid4().hex[:12].upper()}"
    run=ScheduleRun(id=run_id,seed=p.seed,scheduled=len(assigned),unassigned=len(unassigned),
        duration_ms=duration_ms,strategy=p.strategy)
    db.add(run); db.commit()
    # Keep a compact, append-only snapshot so later schedule generations cannot erase
    # the assignments and explanations produced by this run.
    assignment_snapshot = [
        {"assignment_id": row["id"], "exam_id": row["exam_id"], "room_id": row["room_id"],
         "invigilator_ids": row["invigilator_ids"], "student_ids": row["student_ids"],
         "start": row["start"], "end": row["end"], "status": row["status"]}
        for row in assignment_rows(db)
    ]
    unassigned_snapshot = [
        {"exam_id": row["exam_id"], "reason_code": row["reason_code"], "reason": row["reason"]}
        for row in unassigned_rows(db)
    ]
    add_event(db,"schedule.generated","schedule",run_id,
        f"Schedule generated: {len(assigned)} assigned, {len(unassigned)} unassigned in {duration_ms} ms.",
        after={"run_id":run_id,"scheduled":len(assigned),"unassigned":len(unassigned),
               "strategy":p.strategy,"assignments":assignment_snapshot,
               "unassigned_items":unassigned_snapshot})
    db.commit()
    items=[]
    for ex,code,reason in unassigned:
        items.append({"exam_id":ex.id,"course_code":ex.course_code,"course_name":ex.course_name,"reason_code":code,"reason":reason})
    return {"run_id":run_id,"scheduled":len(assigned),"unassigned":len(unassigned),"duration_ms":duration_ms,"unassigned_items":items}

def _room_capacity_for_date(db: Session, room_id: str, on_date: date, fallback: int) -> int:
    record = (db.query(RoomCapacity)
        .filter(RoomCapacity.room_id == room_id, RoomCapacity.effective_from <= on_date)
        .filter((RoomCapacity.effective_to.is_(None)) | (RoomCapacity.effective_to >= on_date))
        .order_by(RoomCapacity.effective_from.desc()).first())
    return record.capacity if record else fallback


def assignment_rows(db: Session):
    exams={x.id:x for x in db.query(Exam).all()}
    rooms={x.id:x for x in db.query(Room).all()}
    out=[]
    for a in db.query(Assignment).order_by(Assignment.start).all():
        e=exams[a.exam_id]; r=rooms[a.room_id]
        out.append({"id":a.id,"exam_id":e.id,"course_code":e.course_code,"course_name":e.course_name,
            "room_id":r.id,"room_name":r.name,"invigilator_ids":a.invigilator_ids,
            "student_ids":a.student_ids or [],"start":a.start.isoformat(),"end":a.end.isoformat(),
            "enrolled":len(a.student_ids or []) or e.enrollment,"capacity":_room_capacity_for_date(db, r.id, a.start.date(), r.capacity),"status":a.status})
    return out

def unassigned_rows(db: Session):
    exams={x.id:x for x in db.query(Exam).all()}
    return [{"exam_id":u.exam_id,"course_code":exams[u.exam_id].course_code,"course_name":exams[u.exam_id].course_name,
        "reason_code":u.reason_code,"reason":u.reason} for u in db.query(UnassignedExam).all() if u.exam_id in exams]

def metrics_report(db: Session):
    exams=db.query(Exam).all(); assignments=assignment_rows(db); unassigned=unassigned_rows(db)
    rooms=db.query(Room).all(); invs=db.query(Invigilator).all()
    coverage={}
    seen_exam_days=set()
    for a in assignments:
        day=a["start"][:10]
        if (a["exam_id"],day) not in seen_exam_days:
            coverage.setdefault(day,{"date":day,"scheduled":0,"unassigned":0}); coverage[day]["scheduled"]+=1
            seen_exam_days.add((a["exam_id"],day))
    for u in unassigned:
        e=next((x for x in exams if x.id==u["exam_id"]),None)
        if e:
            day=e.window_start.isoformat(); coverage.setdefault(day,{"date":day,"scheduled":0,"unassigned":0}); coverage[day]["unassigned"]+=1
    validation = validation_report(db)
    conflict_checks = {
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
    conflict_details = [
        {"check": check["name"], "violations": check["violations"]}
        for check in validation["checks"]
        if check["name"] in conflict_checks and check["violations"] > 0
    ]
    conflicts = sum(item["violations"] for item in conflict_details)
    return {"total_exams":len(exams),"scheduled":len({row["exam_id"] for row in assignments}),"unassigned":len(unassigned),
        "conflicts":conflicts,"conflict_details":conflict_details,
        "constraint_violations":sum(check["violations"] for check in validation["checks"]),
        "room_utilization":sum(r.utilization for r in rooms)/max(1,len(rooms)),
        "coverage_by_day":sorted(coverage.values(),key=lambda x:x["date"]),
        "room_usage":[{"room":r.name,"utilization":r.utilization} for r in rooms],
        "invigilator_workload":[{"name":v.name,"duties":v.assigned_duties,"max":v.max_duties} for v in invs]}

def validation_report(db: Session):
    assignments=assignment_rows(db); exams={x.id:x for x in db.query(Exam).all()}
    rooms={x.id:x for x in db.query(Room).all()}; invs={x.id:x for x in db.query(Invigilator).all()}
    enrol={exam_id:set() for exam_id in exams}
    for row in db.query(Enrollment).all(): enrol.setdefault(row.exam_id,set()).add(row.student_id)
    students={x.id:x for x in db.query(Student).all()}
    student_schedule={}; room_schedule={}; inv_schedule={}
    checks=[]
    def add(name,category,violations,description,severity="high",details=None):
        checks.append({"id":name.lower().replace(" ","-"),"name":name,"category":category,
            "status":"fail" if violations else "pass","violations":violations,"severity":severity,
            "description":description,"details":details or []})
    cap=[]; closed=[]; equip=[]; room_conf=[]; student_conf=[]; inv_conf=[]; accom=[]; inv_avail=[]; allocation=[]; separate_room=[]
    assigned_by_exam={}
    for a in assignments:
        e=exams[a["exam_id"]]; r=rooms[a["room_id"]]
        start=datetime.fromisoformat(a["start"]); end=datetime.fromisoformat(a["end"]); day=start.date().isoformat()
        allocated_ids = set(a.get("student_ids") or enrol.get(e.id,set()))
        if len(allocated_ids)>_room_capacity_for_date(db, r.id, start.date(), r.capacity): cap.append({"entity_type":"exam","entity_id":e.id,"message":"Assigned room capacity is below its allocated student count."})
        assigned_by_exam.setdefault(e.id,[]).extend(sorted(allocated_ids))
        exam_tags = {str(tag).strip().lower().replace(" ", "_").replace("-", "_") for tag in (e.accommodations or [])}
        separate_required = bool(exam_tags & {"separate_room", "individual_room"}) or any(bool({"separate_room", "individual_room"} & {str(tag).strip().lower().replace(" ", "_").replace("-", "_") for tag in (students[sid].accommodations or [])}) for sid in allocated_ids if sid in students)
        if separate_required and len(allocated_ids) != 1:
            separate_room.append({"entity_type":"exam","entity_id":e.id,"message":"A student requiring a separate room shares a room with another student."})
        enrolled_accommodations = {str(tag).strip().lower().replace(" ", "_").replace("-", "_").replace("%", "")
            for sid in allocated_ids if sid in students for tag in (students[sid].accommodations or [])}
        enrolled_accommodations.update(str(tag).strip().lower().replace(" ", "_").replace("%", "") for tag in (e.accommodations or []))
        if not r.accessible and enrolled_accommodations & {"accessible_seating","wheelchair","accessible"}:
            accom.append({"entity_type":"exam","entity_id":e.id,"message":"An enrolled student requires accessible seating but the assigned room is not accessible."})
        if "screen_reader" in enrolled_accommodations and "Computers" not in (r.equipment or []):
            accom.append({"entity_type":"exam","entity_id":e.id,"message":"An enrolled student requires screen-reader support but the assigned room lacks computer equipment."})
        if any(c.get("start","")<=day<=c.get("end","") for c in (r.closures or [])): closed.append({"entity_type":"room","entity_id":r.id,"message":"Assignment occurs during a room closure."})
        if not set(e.required_equipment or []).issubset(set(r.equipment or [])): equip.append({"entity_type":"exam","entity_id":e.id,"message":"Required equipment is missing."})
        for sid in allocated_ids:
            for prev in student_schedule.get(sid,[]):
                if _overlap(start,end,prev[0],prev[1]): student_conf.append({"entity_type":"student","entity_id":sid,"message":"Student has overlapping exams."})
            student_schedule.setdefault(sid,[]).append((start,end))
        for prev in room_schedule.get(r.id,[]):
            if _overlap(start,end,prev[0],prev[1]): room_conf.append({"entity_type":"room","entity_id":r.id,"message":"Room has overlapping assignments."})
        room_schedule.setdefault(r.id,[]).append((start,end))
        for vid in a["invigilator_ids"]:
            if vid in invs and day not in (invs[vid].available_days or []):
                inv_avail.append({"entity_type":"invigilator","entity_id":vid,"message":"Invigilator is assigned on a day they are not available."})
            for prev in inv_schedule.get(vid,[]):
                if _overlap(start,end,prev[0],prev[1]): inv_conf.append({"entity_type":"invigilator","entity_id":vid,"message":"Invigilator is double-booked."})
            inv_schedule.setdefault(vid,[]).append((start,end))
    for exam_id, expected_students in enrol.items():
        if exam_id not in assigned_by_exam:
            continue
        actual = assigned_by_exam.get(exam_id, [])
        if sorted(actual) != sorted(expected_students):
            allocation.append({"entity_type":"exam","entity_id":exam_id,"message":f"Expected {len(expected_students)} allocated student places; found {len(actual)}."})
    add("Every enrolled student allocated once","hard",len(allocation),"Every enrolled student must be allocated to exactly one room for the exam.","critical",allocation)
    add("Separate-room accommodations isolated","hard",len(separate_room),"Students requiring a separate room must be the only student in that room.","critical",separate_room)
    add("Room capacity respected","hard",len(cap),"Every assigned room must seat all enrolled students.","critical",cap)
    add("No room double booking","hard",len(room_conf),"A room cannot host overlapping exams.","critical",room_conf)
    add("No student exam overlap","hard",len(student_conf),"A student cannot be assigned to overlapping exams.","critical",student_conf)
    add("No invigilator double booking","hard",len(inv_conf),"An invigilator cannot supervise overlapping exams.","critical",inv_conf)
    add("Room closures honoured","hard",len(closed),"Rooms must not be used during declared closures.","high",closed)
    add("Required equipment available","hard",len(equip),"Assigned rooms must contain all required equipment.","high",equip)
    add("Accessibility accommodations respected","hard",len(accom),"Students with accessibility accommodations must be assigned to accessible rooms.","high",accom)
    add("Invigilator availability respected","hard",len(inv_avail),"Invigilators must only be assigned on available days.","high",inv_avail)
    report={"generated_at":datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),"passed":sum(c["status"]=="pass" for c in checks),
        "failed":sum(c["status"]=="fail" for c in checks),"warnings":0,"checks":checks}
    return report
