import random, time, uuid, math
from datetime import date, datetime, time as dtime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import (Student, Exam, Room, Invigilator, Enrollment, Assignment,
                      UnassignedExam, ScheduleRun, ScheduleEvent, EdgeCaseLabel)

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
        before=before, after=after, timestamp=datetime.utcnow()))

def generate_dataset(db: Session, p):
    # Clear dependent data first; this is a deliberate full dataset replacement.
    for model in [Assignment, UnassignedExam, Enrollment, ScheduleRun, ScheduleEvent, EdgeCaseLabel,
                  Student, Exam, Room, Invigilator]:
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
                ex.enrollment = db.query(Enrollment).filter_by(exam_id=ex.id).count()
            labels.append(EdgeCaseLabel(id="EDGE-INVIGILATOR-DOUBLE", case_code="INVIGILATOR_DOUBLE_BOOKING",
                entity_type="exam_pair", entity_id=f"{exams[2].id},{exams[3].id}",
                expected_detection="Only one invigilator is available for two same-day exams; the solver must leave one unassigned rather than double-book staff."))
    db.commit()
    add_event(db, "dataset.generated", "dataset", "current",
        f"Generated {len(students)} students, {len(exams)} exams, {len(rooms)} rooms and {len(invigilators)} invigilators (seed {p.seed}).",
        after={"seed":p.seed,"students":len(students),"exams":len(exams),"rooms":len(rooms),"invigilators":len(invigilators),"edge_cases":bool(p.include_edge_cases)})
    db.commit()
    return {"students":len(students),"exams":len(exams),"rooms":len(rooms),"invigilators":len(invigilators),
            "enrollments":len(enrollments),"edge_cases":bool(p.include_edge_cases),"seed":p.seed}

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
        accommodation_tags = {str(tag).strip().lower().replace(" ", "_").replace("%", "")
            for tag in (ex.accommodations or [])}
        for sid in eligible_students:
            if sid in student_by_id:
                accommodation_tags.update(str(tag).strip().lower().replace(" ", "_").replace("%", "")
                    for tag in (student_by_id[sid].accommodations or []))
        if "separate_room" in accommodation_tags:
            unassigned.append((ex,"UNSUPPORTED_ACCOMMODATION","Separate-room accommodation requires multi-room exam splitting, which this version does not support."))
            ex.status="unassigned"; continue
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
        if not any(r.capacity >= ex.enrollment for r in rooms):
            unassigned.append((ex,"NO_ROOM_CAPACITY","No available room can seat all enrolled students."))
            ex.status="unassigned"; continue
        if needs_access and not any(r.accessible and r.capacity >= ex.enrollment for r in rooms):
            unassigned.append((ex,"ACCOMMODATION_CONFLICT","No room satisfies the accessibility accommodation and capacity requirements."))
            ex.status="unassigned"; continue
        if required_equipment and not any(required_equipment.issubset(set(r.equipment or [])) and r.capacity >= ex.enrollment for r in rooms):
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
            candidate_rooms = sorted([r for r in rooms if r.capacity >= ex.enrollment
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
                available = [v for v in invigilators if day_key in (v.available_days or [])
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
            invigilator_ids=[v.id for v in selected],start=start_dt,end=end_dt,status="confirmed")
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
    add_event(db,"schedule.generated","schedule",run_id,
        f"Schedule generated: {len(assigned)} assigned, {len(unassigned)} unassigned in {duration_ms} ms.",
        after={"run_id":run_id,"scheduled":len(assigned),"unassigned":len(unassigned),"strategy":p.strategy})
    db.commit()
    items=[]
    for ex,code,reason in unassigned:
        items.append({"exam_id":ex.id,"course_code":ex.course_code,"course_name":ex.course_name,"reason_code":code,"reason":reason})
    return {"run_id":run_id,"scheduled":len(assigned),"unassigned":len(unassigned),"duration_ms":duration_ms,"unassigned_items":items}

def assignment_rows(db: Session):
    exams={x.id:x for x in db.query(Exam).all()}
    rooms={x.id:x for x in db.query(Room).all()}
    out=[]
    for a in db.query(Assignment).order_by(Assignment.start).all():
        e=exams[a.exam_id]; r=rooms[a.room_id]
        out.append({"id":a.id,"exam_id":e.id,"course_code":e.course_code,"course_name":e.course_name,
            "room_id":r.id,"room_name":r.name,"invigilator_ids":a.invigilator_ids,
            "start":a.start.isoformat(),"end":a.end.isoformat(),"enrolled":e.enrollment,"capacity":r.capacity,"status":a.status})
    return out

def unassigned_rows(db: Session):
    exams={x.id:x for x in db.query(Exam).all()}
    return [{"exam_id":u.exam_id,"course_code":exams[u.exam_id].course_code,"course_name":exams[u.exam_id].course_name,
        "reason_code":u.reason_code,"reason":u.reason} for u in db.query(UnassignedExam).all() if u.exam_id in exams]

def metrics_report(db: Session):
    exams=db.query(Exam).all(); assignments=assignment_rows(db); unassigned=unassigned_rows(db)
    rooms=db.query(Room).all(); invs=db.query(Invigilator).all()
    coverage={}
    for a in assignments:
        day=a["start"][:10]; coverage.setdefault(day,{"date":day,"scheduled":0,"unassigned":0}); coverage[day]["scheduled"]+=1
    for u in unassigned:
        e=next((x for x in exams if x.id==u["exam_id"]),None)
        if e:
            day=e.window_start.isoformat(); coverage.setdefault(day,{"date":day,"scheduled":0,"unassigned":0}); coverage[day]["unassigned"]+=1
    return {"total_exams":len(exams),"scheduled":len(assignments),"unassigned":len(unassigned),
        "conflicts":0,"room_utilization":sum(r.utilization for r in rooms)/max(1,len(rooms)),
        "coverage_by_day":sorted(coverage.values(),key=lambda x:x["date"]),
        "room_usage":[{"room":r.name,"utilization":r.utilization} for r in rooms],
        "invigilator_workload":[{"name":v.name,"duties":v.assigned_duties,"max":v.max_duties} for v in invs]}

def validation_report(db: Session):
    assignments=assignment_rows(db); exams={x.id:x for x in db.query(Exam).all()}
    rooms={x.id:x for x in db.query(Room).all()}; invs={x.id:x for x in db.query(Invigilator).all()}
    enrol={e.id:set() for e in exams}
    for row in db.query(Enrollment).all(): enrol.setdefault(row.exam_id,set()).add(row.student_id)
    students={x.id:x for x in db.query(Student).all()}
    student_schedule={}; room_schedule={}; inv_schedule={}
    checks=[]
    def add(name,category,violations,description,severity="high",details=None):
        checks.append({"id":name.lower().replace(" ","-"),"name":name,"category":category,
            "status":"fail" if violations else "pass","violations":violations,"severity":severity,
            "description":description,"details":details or []})
    cap=[]; closed=[]; equip=[]; room_conf=[]; student_conf=[]; inv_conf=[]; accom=[]; inv_avail=[]
    for a in assignments:
        e=exams[a["exam_id"]]; r=rooms[a["room_id"]]
        start=datetime.fromisoformat(a["start"]); end=datetime.fromisoformat(a["end"]); day=start.date().isoformat()
        if r.capacity<e.enrollment: cap.append({"entity_type":"exam","entity_id":e.id,"message":"Room capacity is below exam enrollment."})
        enrolled_accommodations = {str(tag).strip().lower().replace(" ", "_").replace("%", "")
            for sid in enrol.get(e.id,set()) if sid in students for tag in (students[sid].accommodations or [])}
        enrolled_accommodations.update(str(tag).strip().lower().replace(" ", "_").replace("%", "") for tag in (e.accommodations or []))
        if not r.accessible and enrolled_accommodations & {"accessible_seating","wheelchair","accessible"}:
            accom.append({"entity_type":"exam","entity_id":e.id,"message":"An enrolled student requires accessible seating but the assigned room is not accessible."})
        if "screen_reader" in enrolled_accommodations and "Computers" not in (r.equipment or []):
            accom.append({"entity_type":"exam","entity_id":e.id,"message":"An enrolled student requires screen-reader support but the assigned room lacks computer equipment."})
        if any(c.get("start","")<=day<=c.get("end","") for c in (r.closures or [])): closed.append({"entity_type":"room","entity_id":r.id,"message":"Assignment occurs during a room closure."})
        if not set(e.required_equipment or []).issubset(set(r.equipment or [])): equip.append({"entity_type":"exam","entity_id":e.id,"message":"Required equipment is missing."})
        for sid in enrol.get(e.id,set()):
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
    add("Room capacity respected","hard",len(cap),"Every assigned room must seat all enrolled students.","critical",cap)
    add("No room double booking","hard",len(room_conf),"A room cannot host overlapping exams.","critical",room_conf)
    add("No student exam overlap","hard",len(student_conf),"A student cannot be assigned to overlapping exams.","critical",student_conf)
    add("No invigilator double booking","hard",len(inv_conf),"An invigilator cannot supervise overlapping exams.","critical",inv_conf)
    add("Room closures honoured","hard",len(closed),"Rooms must not be used during declared closures.","high",closed)
    add("Required equipment available","hard",len(equip),"Assigned rooms must contain all required equipment.","high",equip)
    add("Accessibility accommodations respected","hard",len(accom),"Students with accessibility accommodations must be assigned to accessible rooms.","high",accom)
    add("Invigilator availability respected","hard",len(inv_avail),"Invigilators must only be assigned on available days.","high",inv_avail)
    report={"generated_at":datetime.utcnow().isoformat()+"Z","passed":sum(c["status"]=="pass" for c in checks),
        "failed":sum(c["status"]=="fail" for c in checks),"warnings":0,"checks":checks}
    return report
