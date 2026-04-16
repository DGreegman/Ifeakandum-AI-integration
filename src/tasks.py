import asyncio
from typing import Dict, Any, List
from datetime import datetime
from celery import shared_task
from sqlmodel import Session, select
from sqlalchemy import update as sa_update
from src.database import engine
from src.models import MedicalRecord, Analysis, BatchStatus
from src.services.patient_service import openai_client
import logging

logger = logging.getLogger(__name__)

# Run the async analysis in the sync Celery worker
def run_async(coro):
    loop = asyncio.get_event_loop()
    if loop.is_running():
        return asyncio.run_coroutine_threadsafe(coro, loop).result()
    else:
        return loop.run_until_complete(coro)

@shared_task(bind=True, max_retries=3)
def analyze_medical_record_task(self, record_id: int, batch_id: str = None):
    """
    Celery task to analyze a single medical record.
    """
    with Session(engine) as session:
        record = session.get(MedicalRecord, record_id)
        if not record:
            logger.error(f"Record {record_id} not found")
            return

        try:
            # Build a plain dict — no Pydantic schema reconstruction needed
            record_data = {
                "patient_id": record.patient.patient_id,
                "age": record.patient.age,
                "gender": record.patient.gender,
                "weight": record.patient.weight,
                "height": record.patient.height,
                "medical_history": record.patient.medical_history,
                "allergies": record.patient.allergies,
                "current_medications": record.patient.current_medications,
                "primary_symptoms": record.primary_symptoms,
                "secondary_symptoms": record.secondary_symptoms,
                "symptom_duration": record.symptom_duration,
                "severity": record.severity,
                "vital_signs": {
                    "temperature": record.temperature,
                    "blood_pressure": record.blood_pressure,
                    "heart_rate": record.heart_rate,
                    "respiratory_rate": record.respiratory_rate,
                    "oxygen_saturation": record.oxygen_saturation,
                },
                "lab_results": record.lab_results,
                "additional_notes": record.additional_notes,
            }

            # Run the async AI call in a fresh event loop (Celery workers are sync)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            ai_analysis = loop.run_until_complete(
                openai_client.analyze_medical_record_from_dict(record_data)
            )
            loop.close()

            # Save Analysis to DB
            analysis = Analysis(
                record_id=record.id,
                batch_id=batch_id,
                suspected_conditions=ai_analysis.get("suspected_conditions", []),
                recommended_medications=ai_analysis.get("recommended_medications", []),
                additional_tests=ai_analysis.get("additional_tests", []),
                risk_factors=ai_analysis.get("risk_factors", []),
                treatment_notes=ai_analysis.get("treatment_notes", "No notes provided"),
                confidence_level=ai_analysis.get("confidence_level", "medium")
            )
            session.add(analysis)
            session.commit()
            
            # Update Batch Progress atomically to prevent race conditions between
            # concurrent workers (avoids read-modify-write on processed_records)
            if batch_id:
                with Session(engine) as update_session:
                    update_session.exec(
                        sa_update(BatchStatus)
                        .where(BatchStatus.batch_id == batch_id)
                        .values(processed_records=BatchStatus.processed_records + 1)
                    )
                    update_session.commit()

                    # Re-fetch to check completion threshold
                    batch = update_session.exec(
                        select(BatchStatus).where(BatchStatus.batch_id == batch_id)
                    ).first()
                    if batch and batch.processed_records >= batch.total_records:
                        batch.status = "completed"
                        batch.completed_at = datetime.now()
                        update_session.add(batch)
                        update_session.commit()
                    logger.info(f"Batch {batch_id} progress: {batch.processed_records}/{batch.total_records}")
            
            return {"status": "success", "record_id": record_id}

        except Exception as exc:
            import traceback
            error_msg = f"Record {record_id}: {str(exc)}"
            
            # Check if we should retry
            if self.request.retries < self.max_retries:
                logger.warning(f"Task {record_id} failed, retrying ({self.request.retries}/{self.max_retries}). Error: {exc}")
                # Exponential backoff or simple delay
                raise self.retry(exc=exc, countdown=20) # Wait 20s between retries to avoid 429
            
            # If all retries exhausted
            logger.error(f"Task {record_id} failed after {self.max_retries} retries.")
            if batch_id:
                with Session(engine) as update_session:
                    # Atomically increment counter and record error
                    update_session.exec(
                        sa_update(BatchStatus)
                        .where(BatchStatus.batch_id == batch_id)
                        .values(processed_records=BatchStatus.processed_records + 1)
                    )
                    update_session.commit()

                    batch = update_session.exec(
                        select(BatchStatus).where(BatchStatus.batch_id == batch_id)
                    ).first()
                    if batch:
                        current_errors = list(batch.errors)
                        current_errors.append(error_msg)
                        batch.errors = current_errors
                        if batch.processed_records >= batch.total_records:
                            batch.status = "completed"
                            batch.completed_at = datetime.now()
                        update_session.add(batch)
                        update_session.commit()
            
            return {"status": "failed", "record_id": record_id, "error": str(exc)}
