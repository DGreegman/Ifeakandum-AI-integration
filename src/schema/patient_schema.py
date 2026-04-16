from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import re


class PatientInfo(BaseModel):
    patient_id: str 
    name: str
    age: int
    gender: str
    weight: Optional[float] = Field(None, description="Weight in kg")
    height: Optional[float] = Field(None, description="Height in cm")
    medical_history: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []

class Symptoms(BaseModel):
    primary_symptoms: List[str] = Field(..., description="List of symptoms reported by the patient")
    secondary_symptoms: Optional[List[str]] = Field(None, description="List of secondary symptoms reported by the patient")
    symptom_duration: Optional[str] = Field(None, description="Duration of the symptoms")
    severity : Optional[str] = Field(None, description="Severity of the symptoms (e.g., mild, moderate, severe)")
    
class VitalSigns(BaseModel):
    temperature: Optional[float] = Field(None, description="Body temperature in Celsius")
    blood_pressure: Optional[str] = Field(None, description="Blood pressure in mmHg (e.g., '120/80')")
    heart_rate: Optional[int] = Field(None, description="Heart rate in beats per minute")
    respiratory_rate: Optional[int] = Field(None, description="Respiratory rate in breaths per minute")
    oxygen_saturation: Optional[float] = Field(None, description="Oxygen saturation percentage")

class MedicalRecords(BaseModel): 
    patient_info: PatientInfo
    symptoms: Symptoms
    vital_signs: Optional[VitalSigns] = None
    lab_results: Optional[Dict[str, Any]] = Field(None, description="List of lab results or tests performed")
    additional_notes: Optional[str] = Field(None, description="Any additional notes or observations")

class MedicationRecommendation(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration: Optional[str] = Field(None, description="Duration of the medication course")
    instructions: Optional[str] = Field(None, description="Additional instructions for the patient")
    contraindications: Optional[List[str]] = Field(None, description="List of contraindications for the medication")
    side_effects: Optional[List[str]] = Field(None, description="List of potential side effects of the medication")
    confidence_score: Optional[float] = Field(None, description="Confidence score of the recommendation (0-1)")

class AnalysisResult(BaseModel):
    patient_id: str
    analysis_date: datetime
    suspected_conditions: List[str] = Field(..., description="List of suspected medical conditions based on the analysis")
    recommended_medications: List[MedicationRecommendation] = Field(..., description="List of recommended medications with details")
    additional_tests: List[str] = Field(None, description="List of additional tests or investigations recommended")
    risk_factors: Optional[List[str]] = Field(None, description="List of risk factors identified during the analysis")
    treatment_notes: str
    confidence_level: str

class DoctorReport(BaseModel):
    report_id: str
    patient_id: str
    doctor_id: str
    analysis_summary: str
    medication_prescribed: List[MedicationRecommendation]
    follow_up_recommendations: List[str]
    generated_date: datetime


# BatchAnalysisRequest and CSVAnalysisResult were removed — they duplicated the
# BatchStatus SQLModel in models.py and were never imported anywhere.
# Use BatchStatus directly for all batch-status responses.