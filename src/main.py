import io
import json
import uuid
import os
from datetime import datetime, date
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlmodel import Session, select, func

from src.database import init_db, engine, get_session
from src.models import Patient, MedicalRecord, Analysis, BatchStatus, DoctorReport, WHOData, User
from src.services.batch_analysis import process_csv_in_chunks
from src.tasks import analyze_medical_record_task
from src.schema.patient_schema import AnalysisResult, MedicalRecords, MedicationRecommendation, DoctorReport as DoctorReportSchema
from src.schema.user_schema import UserRegister, UserLogin, UserOut, TokenResponse
from src.services.patient_service import openai_client, logger
from src.middleware import log_request
from src.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

load_dotenv()

def create_app() -> FastAPI:
    """Application factory — initialises DB on startup."""
    async def lifespan(app: FastAPI):
        init_db()
        yield

    return FastAPI(
        title="Medical Records Analysis API",
        description="AI-powered medical record analysis and medication recommendation system",
        version="2.0.0",
        lifespan=lifespan,
    )

app = create_app()

# CORS — wildcard (*) + allow_credentials=True is rejected by browsers.
# Use explicit origins; override via ALLOWED_ORIGINS env var before deploying.
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
)
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BaseHTTPMiddleware, dispatch=log_request)


# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@app.post("/api/v1/auth/register", response_model=TokenResponse, status_code=201, tags=["auth"])
async def register(body: UserRegister, session: Session = Depends(get_session)):
    """
    Register the very first user (who becomes admin automatically).
    Once any user exists, only admins can create additional accounts via POST /auth/users.
    """
    user_count = session.exec(select(func.count(User.id))).one()
    if user_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. Ask an admin to create your account via /auth/users.",
        )

    existing = session.exec(
        select(User).where((User.email == body.email) | (User.username == body.username))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already taken.")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role="admin",  # first user is always admin
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.from_orm(user))


@app.post("/api/v1/auth/users", response_model=UserOut, status_code=201, tags=["auth"])
async def create_user(
    body: UserRegister,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
):
    """Admin-only: create a new user with any role."""
    if body.role not in ("admin", "doctor", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin, doctor, or viewer.")

    existing = session.exec(
        select(User).where((User.email == body.email) | (User.username == body.username))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already taken.")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserOut.from_orm(user)


@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(body: UserLogin, session: Session = Depends(get_session)):
    """Exchange email + password for a JWT access token."""
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled. Contact an admin.")

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.from_orm(user))


@app.get("/api/v1/auth/me", response_model=UserOut, tags=["auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserOut.from_orm(current_user)


@app.get("/api/v1/auth/users", response_model=List[UserOut], tags=["auth"])
async def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
):
    """Admin-only: list all registered users."""
    users = session.exec(select(User).order_by(User.created_at.desc())).all()
    return [UserOut.from_orm(u) for u in users]


@app.patch("/api/v1/auth/users/{user_id}/deactivate", response_model=UserOut, tags=["auth"])
async def deactivate_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    """Admin-only: deactivate a user account (prevents login without deleting data)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserOut.from_orm(user)


# ─── Medical Analysis Endpoints ───────────────────────────────────────────────

@app.post("/api/v1/analyze-record", response_model=AnalysisResult)
async def analyze_medical_record(
    record: MedicalRecords,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "doctor")),
):
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

        # 3. Perform AI Analysis
        ai_analysis = await openai_client.analyze_medical_record(record)

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
async def get_analysis_result(
    patient_id: str,
    limit: int = Query(default=20, le=100, description="Max records to return (cap 100)"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Get analysis results for a patient (paginated)"""
    statement = (
        select(Analysis)
        .join(MedicalRecord)
        .where(MedicalRecord.patient_id == patient_id)
        .offset(offset)
        .limit(limit)
    )
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


@app.post("/api/v1/doctor-report", response_model=DoctorReportSchema)
async def create_doctor_report(
    report_in: DoctorReportSchema,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "doctor")),
):
    """Generate professional doctor report and persist to DB"""
    try:
        patient_stmt = select(Patient).where(Patient.patient_id == report_in.patient_id)
        patient = session.exec(patient_stmt).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

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
async def upload_who_data(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
):
    """Admin-only: upload WHO health data (CSV) and persist to DB"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        import pandas as pd
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        required_cols = ['Indicator', 'Value', 'Year']
        df.columns = df.columns.str.strip()

        if not all(col in df.columns for col in required_cols):
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
async def download_batch_results(
    batch_id: str,
    fmt: str = "json",
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
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
async def get_doctor_reports(
    patient_id: str,
    limit: int = Query(default=20, le=100, description="Max records to return (cap 100)"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Get doctor reports for a patient (paginated)"""
    statement = (
        select(DoctorReport)
        .where(DoctorReport.patient_id == patient_id)
        .offset(offset)
        .limit(limit)
    )
    reports = session.exec(statement).all()
    return reports


@app.post("/api/v1/upload-analyze-csv")
async def upload_and_analyze_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _: User = Depends(require_role("admin", "doctor")),
):
    """Upload CSV or JSON file and analyze medical data with background processing"""
    if not file.filename.endswith(('.csv', '.json')):
        raise HTTPException(status_code=400, detail="Only CSV or JSON files are supported")

    content = await file.read()
    batch_id = str(uuid.uuid4())

    background_tasks.add_task(process_csv_in_chunks, content, batch_id, file.filename)

    return {
        "message": "File uploaded. Processing started in background.",
        "batch_id": batch_id,
        "status": "processing",
        "check_status_url": f"/api/v1/batch-analysis-status/{batch_id}"
    }


@app.get("/api/v1/batch-analysis-status/{batch_id}")
async def get_batch_status(
    batch_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    statement = select(BatchStatus).where(BatchStatus.batch_id == batch_id)
    batch = session.exec(statement).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    analysis_stmt = select(Analysis).where(Analysis.batch_id == batch_id)
    processed_count = len(session.exec(analysis_stmt).all())
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
async def get_batch_results(
    batch_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    statement = select(Analysis).where(Analysis.batch_id == batch_id)
    results = session.exec(statement).all()

    batch_stmt = select(BatchStatus).where(BatchStatus.batch_id == batch_id)
    batch = session.exec(batch_stmt).first()

    def _urgency_level(analysis: Analysis) -> str:
        record = session.get(MedicalRecord, analysis.record_id)
        if not record:
            return "Unknown"

        severity = (record.severity or "").lower().strip()

        if severity == "critical":
            return "Critical"
        if severity == "severe":
            return "Severe"
        if severity == "moderate":
            return "Moderate"

        spo2 = record.oxygen_saturation
        hr = record.heart_rate
        if spo2 is not None and spo2 < 90:
            return "Critical"
        if (spo2 is not None and spo2 < 94) or (hr is not None and (hr > 120 or hr < 50)):
            return "Severe"
        if (spo2 is not None and spo2 < 96) or (hr is not None and hr > 100):
            return "Moderate"
        if severity == "mild":
            return "Low"

        return "Unknown"

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
                "confidence": r.confidence_level,
                "urgency_level": _urgency_level(r),
            } for r in results
        ]
    }


@app.get("/api/v1/batches")
async def list_batches(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Return all batch runs, newest first"""
    statement = select(BatchStatus).order_by(BatchStatus.id.desc()).limit(20)
    batches = session.exec(statement).all()
    return [
        {
            "batch_id": b.batch_id,
            "status": b.status,
            "total_records": b.total_records,
            "processed_records": b.processed_records,
            "errors": b.errors or [],
            "created_at": b.created_at,
            "completed_at": b.completed_at,
        }
        for b in batches
    ]


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

@app.get("/api/v1/stats")
async def get_stats(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Return real-time dashboard statistics from the database."""
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_patients = session.exec(select(func.count(Patient.id))).one()
    analyses_today = session.exec(
        select(func.count(Analysis.id)).where(Analysis.analysis_date >= today_start)
    ).one()
    reports_generated = session.exec(select(func.count(DoctorReport.id))).one()

    return {
        "total_patients": total_patients,
        "analyses_today": analyses_today,
        "reports_generated": reports_generated,
    }


@app.get("/api/v1/recent-activity")
async def get_recent_activity(
    limit: int = Query(default=5, le=20),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Return the most recent analyses with patient name for the dashboard activity feed."""
    statement = (
        select(Analysis, MedicalRecord, Patient)
        .join(MedicalRecord, Analysis.record_id == MedicalRecord.id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .order_by(Analysis.analysis_date.desc())
        .limit(limit)
    )
    rows = session.exec(statement).all()

    return [
        {
            "analysis_id": analysis.id,
            "patient_id": patient.patient_id,
            "patient_name": patient.name,
            "analysis_date": analysis.analysis_date.isoformat(),
            "confidence_level": analysis.confidence_level,
            "top_condition": analysis.suspected_conditions[0] if analysis.suspected_conditions else "—",
        }
        for analysis, record, patient in rows
    ]


# ─── Patient Search ───────────────────────────────────────────────────────────

@app.get("/api/v1/patients/search")
async def search_patients(
    q: str = Query(..., min_length=1, description="Name or patient_id prefix to search"),
    limit: int = Query(default=10, le=50),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Search patients by name (partial) or exact patient_id for the autocomplete flow."""
    statement = (
        select(Patient)
        .where(
            (Patient.name.ilike(f"%{q}%")) |  # type: ignore[operator]
            (Patient.patient_id == q)
        )
        .limit(limit)
    )
    patients = session.exec(statement).all()

    return [
        {
            "patient_id": p.patient_id,
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "weight": p.weight,
            "height": p.height,
            "medical_history": p.medical_history,
            "allergies": p.allergies,
            "current_medications": p.current_medications,
        }
        for p in patients
    ]
