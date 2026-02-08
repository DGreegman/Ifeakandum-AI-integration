import asyncio
from contextlib import asynccontextmanager
import io
import json
import uuid
import os
from datetime import datetime
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlmodel import Session, select

from src.database import init_db, engine, get_session
from src.models import Patient, MedicalRecord, Analysis, BatchStatus, DoctorReport, WHOData
from src.services.batch_analysis import process_csv_in_chunks
from src.tasks import analyze_medical_record_task
from src.schema.patient_schema import AnalysisResult, MedicalRecords, MedicationRecommendation, DoctorReport as DoctorReportSchema
from src.services.patient_service import deepseek_client, logger
from src.middleware import log_request

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    init_db()
    yield

app = FastAPI(
    title="Medical Records Analysis API",
    description="AI-powered medical record analysis and medication recommendation system",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BaseHTTPMiddleware, dispatch=log_request)

@app.post("/api/v1/analyze-record", response_model=AnalysisResult)
async def analyze_medical_record(record: MedicalRecords, session: Session = Depends(get_session)):
    """Analyze patient medical record and provide medication recommendations"""
    try:
        # 1. Get or Create Patient
        p_info = record.patient_info
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
                medical_history=p_info.medical_history or [],
                allergies=p_info.allergies or [],
                current_medications=p_info.current_medications or []
            )
            session.add(patient)
            session.commit()
            session.refresh(patient)

        # 2. Create Medical Record
        db_record = MedicalRecord(
            patient_id=patient.patient_id,
            primary_symptoms=record.symptoms.primary_symptoms,
            secondary_symptoms=record.symptoms.secondary_symptoms or [],
            symptom_duration=record.symptoms.symptom_duration,
            severity=record.symptoms.severity,
            temperature=record.vital_signs.temperature if record.vital_signs else None,
            blood_pressure=record.vital_signs.blood_pressure if record.vital_signs else None,
            heart_rate=record.vital_signs.heart_rate if record.vital_signs else None,
            respiratory_rate=record.vital_signs.respiratory_rate if record.vital_signs else None,
            oxygen_saturation=record.vital_signs.oxygen_saturation if record.vital_signs else None,
            lab_results=record.lab_results or {},
            additional_notes=record.additional_notes
        )
        session.add(db_record)
        session.commit()
        session.refresh(db_record)

        # 3. Perform AI Analysis (Sync call for single record for simplicity, or queue task)
        # For single record, we'll wait for the AI result
        ai_analysis = await deepseek_client.analyze_medical_record(record)

        # 4. Save Analysis Result
        analysis_result = AnalysisResult(
            patient_id=record.patient_info.patient_id,
            analysis_date=datetime.now(),
            suspected_conditions=ai_analysis["suspected_conditions"],
            recommended_medications=[MedicationRecommendation(**med) for med in ai_analysis.get("recommended_medications", [])],
            additional_tests=ai_analysis["additional_tests"],
            risk_factors=ai_analysis["risk_factors"],
            treatment_notes=ai_analysis["treatment_notes"],
            confidence_level=ai_analysis["confidence_level"]
        )
        
        db_analysis = Analysis(
            record_id=db_record.id,
            suspected_conditions=analysis_result.suspected_conditions,
            recommended_medications=[med.dict() for med in analysis_result.recommended_medications],
            additional_tests=analysis_result.additional_tests,
            risk_factors=analysis_result.risk_factors,
            treatment_notes=analysis_result.treatment_notes,
            confidence_level=analysis_result.confidence_level
        )
        session.add(db_analysis)
        session.commit()
        
        return analysis_result
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analysis-result/{patient_id}", response_model=List[AnalysisResult])
async def get_analysis_result(patient_id: str, session: Session = Depends(get_session)):
    """Get all analysis results for a specific patient"""
    statement = select(Analysis).join(MedicalRecord).where(MedicalRecord.patient_id == patient_id)
    results = session.exec(statement).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="Analysis results not found")

    return [
        AnalysisResult(
            patient_id=patient_id,
            analysis_date=r.analysis_date,
            suspected_conditions=r.suspected_conditions,
            recommended_medications=[MedicationRecommendation(**med) for med in r.recommended_medications],
            additional_tests=r.additional_tests,
            risk_factors=r.risk_factors,
            treatment_notes=r.treatment_notes,
            confidence_level=r.confidence_level
        ) for r in results
    ]

# Legacy Endpoints Refactored to use Persistent DB

@app.post("/api/v1/doctor-report", response_model=DoctorReportSchema)
async def create_doctor_report(report_in: DoctorReportSchema, session: Session = Depends(get_session)):
    """Generate professional doctor report and persist to DB"""
    try:
        # Check if patient exists
        patient_stmt = select(Patient).where(Patient.patient_id == report_in.patient_id)
        patient = session.exec(patient_stmt).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Save to DB
        db_report = DoctorReport(
            report_id=report_in.report_id or str(uuid.uuid4()),
            patient_id=report_in.patient_id,
            doctor_id=report_in.doctor_id,
            analysis_summary=report_in.analysis_summary,
            medications_prescribed=[med.dict() for med in report_in.medication_prescribed],
            follow_up_recommendations=report_in.follow_up_recommendations,
            generated_date=report_in.generated_date or datetime.now()
        )
        session.add(db_report)
        session.commit()
        session.refresh(db_report)

        return DoctorReportSchema(
            report_id=db_report.report_id,
            patient_id=db_report.patient_id,
            doctor_id=db_report.doctor_id,
            analysis_summary=db_report.analysis_summary,
            medication_prescribed=[MedicationRecommendation(**med) for med in db_report.medications_prescribed],
            follow_up_recommendations=db_report.follow_up_recommendations,
            generated_date=db_report.generated_date
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Doctor report error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/upload-who-data")
async def upload_who_data(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Upload WHO health data (CSV) and persist to DB"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        import pandas as pd
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Expect specific WHO columns (demo implementation)
        required_cols = ['Indicator', 'Value', 'Year']
        df.columns = df.columns.str.strip()
        
        if not all(col in df.columns for col in required_cols):
            # If not WHO format, just store with some defaults
            logger.warning("Uploaded CSV does not match WHO indicator format. Using fallback parsing.")
        
        records_added = 0
        for _, row in df.iterrows():
            who_record = WHOData(
                record_id=str(uuid.uuid4()),
                country=str(row.get('Country', 'Global')),
                year=int(row.get('Year', datetime.now().year)),
                indicator=str(row.get('Indicator', 'Unknown')),
                value=float(row.get('Value', 0.0)),
                extra_metadata=row.to_dict()
            )
            session.add(who_record)
            records_added += 1
            
        session.commit()
        
        return {
            "status": "success",
            "message": f"Successfully processed {records_added} WHO data records",
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"WHO data upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/batch-analysis-download/{batch_id}")
async def download_batch_results(batch_id: str, fmt: str = "json", session: Session = Depends(get_session)):
    """Download batch analysis results as JSON or CSV"""
    statement = select(Analysis).where(Analysis.batch_id == batch_id)
    results = session.exec(statement).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="Batch results not found")
    
    data = [
        {
            "record_id": r.record_id,
            "analysis_date": r.analysis_date.isoformat(),
            "conditions": ", ".join(r.suspected_conditions),
            "medications": json.dumps(r.recommended_medications),
            "confidence": r.confidence_level,
            "treatment_notes": r.treatment_notes
        } for r in results
    ]
    
    if fmt == "csv":
        import pandas as pd
        df = pd.DataFrame(data)
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_results.csv"}
        )
    
    return data

@app.get("/api/v1/doctor-reports/{patient_id}")
async def get_doctor_reports(patient_id: str, session: Session = Depends(get_session)):
    """Get all doctor reports for a specific patient"""
    statement = select(DoctorReport).where(DoctorReport.patient_id == patient_id)
    reports = session.exec(statement).all()
    return reports

@app.post("/api/v1/upload-analyze-csv")
async def upload_and_analyze_csv(file: UploadFile = File(...)):
    """Upload CSV file and analyze medical data with Celery background processing"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    batch_id = str(uuid.uuid4())
    
    # Offload to background task (this processes the CSV in chunks and queues Celery tasks)
    asyncio.create_task(process_csv_in_chunks(content, batch_id))
    
    return {
        "message": "CSV uploaded. Processing started in background.",
        "batch_id": batch_id,
        "status": "processing",
        "check_status_url": f"/api/v1/batch-analysis-status/{batch_id}"
    }

@app.get("/api/v1/batch-analysis-status/{batch_id}")
async def get_batch_status(batch_id: str, session: Session = Depends(get_session)):
    statement = select(BatchStatus).where(BatchStatus.batch_id == batch_id)
    batch = session.exec(statement).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Optional: Update processed_records dynamically for the response
    analysis_stmt = select(Analysis).where(Analysis.batch_id == batch_id)
    processed_count = len(session.exec(analysis_stmt).all())
    
    # If there are errors, they should also count as "processed"
    total_processed = processed_count + len(batch.errors)
    
    return {
        "batch_id": batch.batch_id,
        "total_records": batch.total_records,
        "processed_records": total_processed,
        "status": batch.status,
        "errors": batch.errors,
        "created_at": batch.created_at,
        "completed_at": batch.completed_at
    }

@app.get("/api/v1/batch-results/{batch_id}")
async def get_batch_results(batch_id: str, session: Session = Depends(get_session)):
    statement = select(Analysis).where(Analysis.batch_id == batch_id)
    results = session.exec(statement).all()
    
    batch_stmt = select(BatchStatus).where(BatchStatus.batch_id == batch_id)
    batch = session.exec(batch_stmt).first()
    
    return {
        "batch_id": batch_id,
        "total_records": batch.total_records if batch else len(results),
        "successful_analyses": len(results),
        "failed_analyses": (batch.total_records - len(results)) if batch else 0,
        "results": [
            {
                "record_id": r.record_id,
                "conditions": r.suspected_conditions,
                "medications": r.recommended_medications,
                "confidence": r.confidence_level
            } for r in results
        ]
    }
