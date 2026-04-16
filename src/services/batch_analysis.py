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

def prepare_record_from_row(row: pd.Series, index: int, batch_id: str = "") -> MedicalRecords:
    """Helper to convert row to Schema object (logic borrowed from before)"""
    # Make patient_id unique per batch to avoid unique-constraint collisions
    # when the same CSV is uploaded more than once
    batch_suffix = batch_id[:8] if batch_id else str(uuid.uuid4())[:8]
    # Note: Using the improved version from earlier steps
    # For now, a simplified version to focus on the Celery/DB flow
    
    # Check if wearable
    if 'patient number' in row:
        patient_id = f"WR-{str(row['patient number'])}-{batch_suffix}"
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
        # Traditional — make patient_id unique per batch
        raw_id = str(row.get('patient_id', f"PID_{index}"))
        patient_id = f"{raw_id}-{batch_suffix}"
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

async def process_csv_in_chunks(file_content: bytes, batch_id: str, filename: str = ".csv"):
    """
    Process file sequentially, save to DB, and analyze inline using OpenAI
    This avoids brittle Celery queue issues and manages API limits safely.
    """
    import io
    import json
    import asyncio
    from datetime import datetime
    from sqlalchemy import update as sa_update
    from src.models import Analysis
    from src.services.patient_service import openai_client
    
    is_json = filename.endswith('.json')
    
    if is_json:
        try:
            records = json.loads(file_content.decode('utf-8'))
            if not isinstance(records, list):
                records = [records]
            total_records = len(records)
            df = None
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
            return
    else:
        df = pd.read_csv(io.BytesIO(file_content))
        df.columns = df.columns.str.strip().str.lower()
        total_records = len(df)
        records = None
    
    with Session(engine) as session:
        # Create Batch Entry
        batch = BatchStatus(batch_id=batch_id, total_records=total_records)
        session.add(batch)
        session.commit()
        
    for i in range(total_records):
        try:
            if is_json:
                row_data = records[i]
                p_data = row_data.get('patient_info', {})
                s_data = row_data.get('symptoms', {})
                v_data = row_data.get('vital_signs', {})
                
                batch_suffix = batch_id[:8]
                raw_id = p_data.get('patient_id', f"PID_{i}")
                patient_id = f"{raw_id}-{batch_suffix}"
                
                schema_record = MedicalRecords(
                    patient_info=PatientInfo(
                        patient_id=patient_id,
                        name=p_data.get('name', f"Patient {patient_id}"),
                        age=p_data.get('age', 0),
                        gender=p_data.get('gender', 'Unknown'),
                        weight=p_data.get('weight'),
                        height=p_data.get('height'),
                        medical_history=p_data.get('medical_history', []),
                        allergies=p_data.get('allergies', []),
                        current_medications=p_data.get('current_medications', [])
                    ),
                    symptoms=Symptoms(
                        primary_symptoms=s_data.get('primary_symptoms', []),
                        secondary_symptoms=s_data.get('secondary_symptoms', []),
                        symptom_duration=s_data.get('symptom_duration'),
                        severity=s_data.get('severity', 'moderate')
                    ),
                    vital_signs=VitalSigns(
                        temperature=v_data.get('temperature'),
                        blood_pressure=v_data.get('blood_pressure'),
                        heart_rate=v_data.get('heart_rate'),
                        respiratory_rate=v_data.get('respiratory_rate'),
                        oxygen_saturation=v_data.get('oxygen_saturation')
                    ),
                    lab_results=row_data.get('lab_results', {}),
                    additional_notes=row_data.get('additional_notes', '')
                )
            else:
                row = df.iloc[i]
                schema_record = prepare_record_from_row(row, i, batch_id)
            
            # Setup DB record
            with Session(engine) as session:
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
                    session.commit()
                    session.refresh(patient)
                
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
                    lab_results=schema_record.lab_results or {},
                    additional_notes=schema_record.additional_notes
                )
                session.add(db_record)
                session.commit()
                session.refresh(db_record)
                record_id = db_record.id

                # Build data for AI
                record_data = {
                    "patient_id": patient.patient_id,
                    "age": patient.age,
                    "gender": patient.gender,
                    "weight": patient.weight,
                    "height": patient.height,
                    "medical_history": patient.medical_history,
                    "allergies": patient.allergies,
                    "current_medications": patient.current_medications,
                    "primary_symptoms": db_record.primary_symptoms,
                    "secondary_symptoms": db_record.secondary_symptoms,
                    "symptom_duration": db_record.symptom_duration,
                    "severity": db_record.severity,
                    "vital_signs": {
                        "temperature": db_record.temperature,
                        "blood_pressure": db_record.blood_pressure,
                        "heart_rate": db_record.heart_rate,
                        "respiratory_rate": db_record.respiratory_rate,
                        "oxygen_saturation": db_record.oxygen_saturation,
                    },
                    "lab_results": db_record.lab_results,
                    "additional_notes": db_record.additional_notes,
                }
            
            # Analyze Record Inline (handles rate limits safely)
            ai_analysis = await openai_client.analyze_medical_record_from_dict(record_data)
            
            # Save Analysis and Update Processing Progress
            with Session(engine) as session:
                analysis = Analysis(
                    record_id=record_id,
                    batch_id=batch_id,
                    suspected_conditions=ai_analysis.get("suspected_conditions", []),
                    recommended_medications=ai_analysis.get("recommended_medications", []),
                    additional_tests=ai_analysis.get("additional_tests", []),
                    risk_factors=ai_analysis.get("risk_factors", []),
                    treatment_notes=ai_analysis.get("treatment_notes", "No notes provided"),
                    confidence_level=ai_analysis.get("confidence_level", "medium")
                )
                session.add(analysis)
                
                # Atomically update processed records
                session.exec(
                    sa_update(BatchStatus)
                    .where(BatchStatus.batch_id == batch_id)
                    .values(processed_records=BatchStatus.processed_records + 1)
                )
                session.commit()

                # Re-fetch Check completion
                batch = session.exec(select(BatchStatus).where(BatchStatus.batch_id == batch_id)).first()
                if batch and batch.processed_records >= batch.total_records:
                    batch.status = "completed"
                    batch.completed_at = datetime.now()
                    session.add(batch)
                    session.commit()
                
                logger.info(f"Batch {batch_id} progress: {batch.processed_records}/{batch.total_records}")

            # Safe throttle to respect OpenAI limits
            await asyncio.sleep(1)

        except Exception as e:
            import traceback
            logger.error(f"Error processing row {i}: {e}\n{traceback.format_exc()}")
            with Session(engine) as err_session:
                from sqlalchemy import update as sa_update
                from datetime import datetime as dt
                err_session.exec(
                    sa_update(BatchStatus)
                    .where(BatchStatus.batch_id == batch_id)
                    .values(processed_records=BatchStatus.processed_records + 1)
                )
                err_session.commit()
                batch_fresh = err_session.exec(select(BatchStatus).where(BatchStatus.batch_id == batch_id)).first()
                if batch_fresh:
                    errs = list(batch_fresh.errors)
                    errs.append(f"Row {i}: {str(e)}")
                    batch_fresh.errors = errs
                    if batch_fresh.processed_records >= batch_fresh.total_records:
                        batch_fresh.status = "completed"
                        batch_fresh.completed_at = dt.now()
                    err_session.add(batch_fresh)
                    err_session.commit()