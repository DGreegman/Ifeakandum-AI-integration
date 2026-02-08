import pandas as pd
import uuid
import logging
from typing import List, Tuple
from sqlmodel import Session, select
from src.database import engine
from src.models import Patient, MedicalRecord, BatchStatus
from src.tasks import analyze_medical_record_task
from src.schema.patient_schema import PatientInfo, Symptoms, VitalSigns, MedicalRecords

logger = logging.getLogger(__name__)

def validate_csv_columns(df: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Validate if CSV has required medical columns or wearable device format"""
    # Simplified validation for demo/project purposes
    required_cols = ['age', 'gender']
    wearable_cols = ['patient number', 'heart rate (bpm)']
    
    if all(col in df.columns for col in required_cols):
        return True, ["traditional"]
    if all(col in df.columns for col in wearable_cols):
        return True, ["wearable"]
    
    return False, ["Missing basic columns (age/gender or wearable data)"]

def prepare_record_from_row(row: pd.Series, index: int) -> MedicalRecords:
    """Helper to convert row to Schema object (logic borrowed from before)"""
    # Note: Using the improved version from earlier steps
    # For now, a simplified version to focus on the Celery/DB flow
    
    # Check if wearable
    if 'patient number' in row:
        patient_id = str(row['patient number'])
        heart_rate = int(row['heart rate (bpm)']) if pd.notna(row['heart rate (bpm)']) else None
        
        return MedicalRecords(
            patient_info=PatientInfo(
                patient_id=patient_id,
                name=f"Patient {patient_id}",
                age=45, gender="Unknown",
                medical_history=[str(row.get('predicted disease', 'Unknown'))]
            ),
            symptoms=Symptoms(primary_symptoms=["Wearable Monitoring"], severity="mild"),
            vital_signs=VitalSigns(
                heart_rate=heart_rate,
                temperature=float(row.get('body temperature (°c)', 37.0)),
                blood_pressure=f"{row.get('systolic blood pressure (mmhg)', 120)}/{row.get('diastolic blood pressure (mmhg)', 80)}",
                oxygen_saturation=float(row.get('spo2 level (%)', 98))
            ),
            additional_notes=f"Processed from wearable data. Accuracy: {row.get('data accuracy (%)', 'N/A')}"
        )
    else:
        # Traditional
        patient_id = str(row.get('patient_id', f"PID_{index}"))
        return MedicalRecords(
            patient_info=PatientInfo(
                patient_id=patient_id,
                name=str(row.get('name', f"Patient {patient_id}")),
                age=int(row['age']),
                gender=str(row['gender']),
                medical_history=str(row.get('medical_history', '')).split(',') if 'medical_history' in row else []
            ),
            symptoms=Symptoms(
                primary_symptoms=str(row.get('symptoms', 'Consultation')).split(','),
                severity=str(row.get('severity', 'moderate'))
            ),
            vital_signs=VitalSigns(
                temperature=float(row['temperature']) if 'temperature' in row and pd.notna(row['temperature']) else None,
                heart_rate=int(row['heart_rate']) if 'heart_rate' in row and pd.notna(row['heart_rate']) else None
            ),
            additional_notes=str(row.get('additional_notes', ''))
        )

async def process_csv_in_chunks(file_content: bytes, batch_id: str):
    """
    Process CSV in chunks, save to DB, and queue Celery tasks.
    This is memory efficient for 60,000+ rows.
    """
    import io
    from datetime import datetime
    
    df = pd.read_csv(io.BytesIO(file_content))
    df.columns = df.columns.str.strip().str.lower()
    
    total_records = len(df)
    
    with Session(engine) as session:
        # Create Batch Entry
        batch = BatchStatus(batch_id=batch_id, total_records=total_records)
        session.add(batch)
        session.commit()
        
        # Process in chunks of 100 for DB efficiency
        chunk_size = 100
        for start in range(0, total_records, chunk_size):
            end = min(start + chunk_size, total_records)
            chunk = df.iloc[start:end]
            
            for i, row in chunk.iterrows():
                try:
                    schema_record = prepare_record_from_row(row, i)
                    
                    # 1. Get or Create Patient
                    p_info = schema_record.patient_info
                    statement = select(Patient).where(Patient.patient_id == p_info.patient_id)
                    patient = session.exec(statement).first()
                    
                    if not patient:
                        patient = Patient(
                            patient_id=p_info.patient_id,
                            name=p_info.name,
                            age=p_info.age,
                            gender=p_info.gender,
                            weight=p_info.weight,
                            height=p_info.height,
                            medical_history=p_info.medical_history,
                            allergies=p_info.allergies,
                            current_medications=p_info.current_medications
                        )
                        session.add(patient)
                        session.flush() # Get ID
                    
                    # 2. Create Medical Record
                    db_record = MedicalRecord(
                        patient_id=patient.patient_id,
                        primary_symptoms=schema_record.symptoms.primary_symptoms,
                        secondary_symptoms=schema_record.symptoms.secondary_symptoms or [],
                        symptom_duration=schema_record.symptoms.symptom_duration,
                        severity=schema_record.symptoms.severity,
                        temperature=schema_record.vital_signs.temperature if schema_record.vital_signs else None,
                        blood_pressure=schema_record.vital_signs.blood_pressure if schema_record.vital_signs else None,
                        heart_rate=schema_record.vital_signs.heart_rate if schema_record.vital_signs else None,
                        respiratory_rate=schema_record.vital_signs.respiratory_rate if schema_record.vital_signs else None,
                        oxygen_saturation=schema_record.vital_signs.oxygen_saturation if schema_record.vital_signs else None,
                        additional_notes=schema_record.additional_notes
                    )
                    session.add(db_record)
                    session.flush()
                    
                    # 3. Queue Celery Task
                    analyze_medical_record_task.delay(db_record.id, batch_id)
                    
                except Exception as e:
                    logger.error(f"Error processing row {i}: {e}")
                    # Update batch error log
                    batch.errors.append(f"Row {i}: {str(e)}")
                    batch.processed_records += 1 # Still count as a row "dealt with"
            
            session.commit() # Commit every chunk
            logger.info(f"Queued chunk {start}-{end} for batch {batch_id}")