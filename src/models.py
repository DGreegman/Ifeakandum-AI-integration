from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON, Column

class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: str = Field(index=True, unique=True)
    name: str
    age: int
    gender: str
    weight: Optional[float] = None
    height: Optional[float] = None
    medical_history: List[str] = Field(default=[], sa_column=Column(JSON))
    allergies: List[str] = Field(default=[], sa_column=Column(JSON))
    current_medications: List[str] = Field(default=[], sa_column=Column(JSON))
    
    records: List["MedicalRecord"] = Relationship(back_populates="patient")

class MedicalRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: str = Field(foreign_key="patient.patient_id")
    
    # Symptoms
    primary_symptoms: List[str] = Field(default=[], sa_column=Column(JSON))
    secondary_symptoms: List[str] = Field(default=[], sa_column=Column(JSON))
    symptom_duration: Optional[str] = None
    severity: Optional[str] = None
    
    # Vitals
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    
    lab_results: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    additional_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    
    patient: Patient = Relationship(back_populates="records")
    analysis: Optional["Analysis"] = Relationship(back_populates="record")

class Analysis(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    record_id: int = Field(foreign_key="medicalrecord.id")
    batch_id: Optional[str] = Field(default=None, index=True)
    
    analysis_date: datetime = Field(default_factory=datetime.now)
    suspected_conditions: List[str] = Field(default=[], sa_column=Column(JSON))
    recommended_medications: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    additional_tests: List[str] = Field(default=[], sa_column=Column(JSON))
    risk_factors: List[str] = Field(default=[], sa_column=Column(JSON))
    treatment_notes: str
    confidence_level: str
    
    record: MedicalRecord = Relationship(back_populates="analysis")

class BatchStatus(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    batch_id: str = Field(index=True, unique=True)
    total_records: int
    processed_records: int = 0
    status: str = "processing" # processing, completed, failed
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    errors: List[str] = Field(default=[], sa_column=Column(JSON))
    summary: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

class DoctorReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: str = Field(index=True, unique=True)
    patient_id: str = Field(foreign_key="patient.patient_id")
    analysis_id: Optional[int] = Field(default=None, foreign_key="analysis.id")
    doctor_id: str
    analysis_summary: str
    medications_prescribed: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    follow_up_recommendations: List[str] = Field(default=[], sa_column=Column(JSON))
    generated_date: datetime = Field(default_factory=datetime.now)

class WHOData(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    record_id: str = Field(index=True)
    country: str
    year: int
    indicator: str
    value: float
    extra_metadata: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    uploaded_at: datetime = Field(default_factory=datetime.now)
