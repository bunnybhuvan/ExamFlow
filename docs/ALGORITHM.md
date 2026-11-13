# Scheduling engine and constraint model

## Design principle
The scheduler is a deterministic, constraint-first heuristic. It does not ask an LLM to make assignments. Given the same database state and request, it applies the same ordering and candidate checks.

## Hard constraints
An assignment is accepted only when all applicable checks pass:
1. **Room capacity:** room capacity is at least the exam's enrolled student count.
2. **Room availability:** the room has no overlapping assignment and is not closed on the exam date.
3. **Equipment:** the room contains every item required by the exam. Screen-reader accommodations additionally require a computer-equipped room.
4. **Student conflicts:** no enrolled student has an overlapping exam; the configured break buffer is also respected.
5. **Invigilator availability:** the selected invigilator is available on that date, has remaining duty capacity, and has no overlapping assignment.
6. **Accessibility:** students requiring accessible seating are only placed in accessible rooms.
7. **Extra time:** an extra-time-25 accommodation extends the scheduled duration by 25%.
8. **Separate-room accommodation:** each student with a separate-room requirement is allocated a dedicated room; the remaining cohort is allocated to a main room. Each room receives its own available invigilation team. Every room assignment records its exact student IDs, and validation checks that every enrolled student is allocated exactly once.

The independent validation endpoint re-checks accepted assignments for capacity, room overlaps, student overlaps, invigilator overlaps, closures, equipment, accessibility and staff availability.

## Deterministic scheduling flow
1. Build enrollment lookup maps from the enrollments table.
2. Sort exams by constraint difficulty: accessibility, equipment, enrollment and duration.
3. Build weekday candidate slots inside each exam's scheduling window.
4. Apply the selected strategy:
   - **compact:** prefer earliest feasible dates.
   - **balanced:** prefer dates with fewer scheduled exams.
   - **spread:** prefer dates with fewer already-scheduled exams for the same student cohort, then lower day load.
5. For each candidate slot, inspect suitable rooms in best-fit capacity order.
6. Reject a candidate if the room is closed or occupied, a student has a conflict/buffer violation, or enough invigilators are unavailable.
7. Persist one assignment or an explicit unassigned reason code.
8. Store a schedule run and append an audit event.

## Unassigned reason codes
- NO_ROOM_CAPACITY
- ROOM_CLOSED
- EQUIPMENT_UNAVAILABLE
- STUDENT_CONFLICT
- NO_INVIGILATOR
- ACCOMMODATION_CONFLICT
- UNSUPPORTED_ACCOMMODATION
- NO_VALID_TIME_SLOT

Reason selection is deterministic and based on the failed candidate checks.

## Complexity
Let E be exams, S candidate time slots per exam, R rooms, I invigilators, and C the enrolled cohort size. A conservative upper bound for candidate evaluation is approximately O(E × S × R × (I + C)); practical execution usually exits early when a suitable room and invigilator are found. Enrollment and entity lookups are pre-indexed in memory for a schedule run.

## Edge-case labels
When include_edge_cases=true, the generator creates labelled scenarios for shared student cohorts, insufficient capacity, closed rooms, unavailable accessibility, and invigilator scarcity. Labels are stored in edge_case_labels. The scheduling function never queries that table; it only reads operational input tables. This prevents ground-truth leakage.
