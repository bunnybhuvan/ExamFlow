from datetime import date
from pydantic import BaseModel, ConfigDict, Field, model_validator

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class ExamInput(BaseModel):
    course_code: str = Field(min_length=2, max_length=30)
    course_name: str = Field(min_length=2, max_length=180)
    department: str = Field(min_length=2, max_length=100)
    duration_minutes: int = Field(ge=15, le=600)
    enrollment: int = Field(ge=0)
    window_start: date
    window_end: date
    required_equipment: list[str] = []
    accommodations: list[str] = []
    status: str = "pending"
    @model_validator(mode="after")
    def valid_window(self):
        if self.window_end < self.window_start:
            raise ValueError("window_end must be on or after window_start")
        return self

class DatasetRequest(BaseModel):
    seed: int = 20261111
    students: int = Field(default=5000, ge=1, le=100000)
    exams: int = Field(default=300, ge=1, le=10000)
    rooms: int = Field(default=100, ge=1, le=5000)
    invigilators: int = Field(default=200, ge=1, le=10000)
    include_edge_cases: bool = False

class ScheduleRequest(BaseModel):
    start_date: date
    end_date: date
    daily_start: str = "09:00"
    daily_end: str = "18:00"
    break_buffer_minutes: int = Field(default=30, ge=0, le=240)
    seed: int = 20261111
    strategy: str = "balanced"
    @model_validator(mode="after")
    def valid_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.daily_end <= self.daily_start:
            raise ValueError("daily_end must be after daily_start")
        if self.strategy not in {"balanced", "compact", "spread"}:
            raise ValueError("strategy must be balanced, compact or spread")
        return self
