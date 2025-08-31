
import asyncio
import io
import json
import uuid
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import pandas as pd
from services.patient_service import deepseek_client, logger
from datetime import datetime
from dotenv import load_dotenv
import os
from schema.patient_schema import AnalysisResult, BatchAnalysisRequest, DoctorReport, MedicalRecords, MedicationRecommendation
from services.batch_analysis import prepare_medical_record_from_row, process_batch_analysis, validate_csv_columns
from database import analysis_results_db, batch_analysis_db, doctor_reports_db, medical_records_db
from starlette.middleware.base import BaseHTTPMiddleware
from middleware import log_request

# Load environment variables
load_dotenv()

api_key = os.getenv("API_KEY")

# Configure logging


app = FastAPI(
    title="Medical Records Analysis API",
    description="AI-powered medical record analysis and medication recommendation system",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BaseHTTPMiddleware, dispatch=log_request)


# Security
security = HTTPBearer()


# initialize DeepSeek client

# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "Medical Records Analysis API",
        "version": "1.0.0",
        "description": "AI-powered medical analysis for educational purposes",
        "disclaimer": "This system is for academic research only and not for actual medical diagnosis"
    }


@app.post("/api/v1/analyze-record", response_model=AnalysisResult)
async def analyze_medical_record(record: MedicalRecords):
    """Analyze patient medical record and provide medication recommendations"""

    try:
        medical_records_db[record.patient_info.patient_id] = record

        #  Perform analysis using DeepSeek client
        ai_analysis = await deepseek_client.analyze_medical_record(record)

        medications = [
               MedicationRecommendation(**med) for med in ai_analysis.get("recommended_medications")
          ]

        # Debug: Print the parsed analysis
        print(f"AI Analysis Result: {ai_analysis}")

        # Create analysis result object
        medications = []
        for med_data in ai_analysis.get("recommended_medications", []):
            try: 
                medication = MedicationRecommendation(**med_data)
                medications.append(medication)
            except Exception as med_error:
               logger.warning(f"Error creating medication object: {med_error}")
               fallback_med =  MedicationRecommendation(
                    medication_name=med_data.get("medication_name", "Unknown"),
                    dosage=med_data.get("dosage", "Consult doctor"),
                    frequency=med_data.get("frequency", "As prescribed"),
                    duration=med_data.get("duration", "As prescribed"),
                    instructions=med_data.get("instructions", "Follow doctor's advice"),
                    contraindications=med_data.get("contraindications", []),
                    side_effects=med_data.get("side_effects", []),
                    confidence_score=med_data.get("confidence_score", 0.0)
               )
               medications.append(fallback_med)
        analysis_result = AnalysisResult(
            patient_id=record.patient_info.patient_id,
            analysis_date=datetime.now(),
            suspected_conditions=ai_analysis["suspected_conditions"],
            recommended_medications=medications,
            additional_tests=ai_analysis["additional_tests"],
            risk_factors=ai_analysis["risk_factors"],
            treatment_notes=ai_analysis["treatment_notes"],
            confidence_level=ai_analysis["confidence_level"]
        )
        
        # Store analysis result
        analysis_results_db[record.patient_info.patient_id] = analysis_result
        
        return analysis_result
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# getting a particular patient's analysis result 

@app.get("/api/v1/analysis-result/{patient_id}", response_model=AnalysisResult)
async def get_analysis_result(patient_id: str):
    """Get analysis result for a specific patient"""
    if patient_id not in analysis_results_db:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    return analysis_results_db[patient_id]



@app.post("/api/v1/doctor-report")
async def generate_doctor_report(patient_id: str, doctor_id: str):
    """Generate a doctor report for a specific patient"""
    if patient_id not in analysis_results_db:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    analysis = analysis_results_db[patient_id]

    # Generate Report Using AI 
    report_prompt = f"""
        Generate a professional medical report summary for:
        Patient ID: {patient_id}
        Suspected Conditions: {', '.join(analysis.suspected_conditions)}
        Recommended Medications: {len(analysis.recommended_medications)} medications
        Confidence Level: {analysis.confidence_level}
        
        Provide a concise professional summary for the attending physician.
     """

    try: 
        async with httpx.AsyncClient() as client: 
            response = await client.post(
                f"{deepseek_client.base_url}/chat/completions", 
                    headers=deepseek_client.headers,
                    json={
                        "model": deepseek_client.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Generate professional medical report summaries for educational purposes only."
                            },
                            {
                                "role": "user",
                                "content": report_prompt
                            }
                        ],
                        "temperature": 0.1,
                        "max_tokens": 2000
                    },
                    timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            summary = result["choices"][0]["message"]["content"]
    except Exception: 
        summary = f"Analysis completed for patient {patient_id} with {analysis.confidence_level} confidence level."
    
    report = DoctorReport(
        report_id=f"RPT_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        patient_id=patient_id,
        doctor_id=doctor_id,
        analysis_summary=summary,
        medication_prescribed=analysis.recommended_medications,
        follow_up_recommendations=analysis.additional_tests,
        generated_date=datetime.now()
    )

    doctor_reports_db[report.report_id] = report
    return report


@app.post("/api/v1/upload-who-data")
async def upload_who_data(file: UploadFile = File(...)):
    """Upload WHO data for analysis"""
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Only CSV and Excel files are allowed.")

    try:
        content = await file.read()
        # Process the uploaded WHO data
        # For example, you might save it to a database or perform analysis
               
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.json'):
            data = json.loads(content.decode())
            df = pd.DataFrame(data)
        
        # Process WHO data 
        processed_data = {
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns),
            "upload_time": datetime.now().isoformat()
        }

        return {
            "message": "WHO data uploaded successfully",
            "data_info": processed_data
        }
    except Exception as e:
        logger.error(f"Error uploading WHO data: {str(e)}")
        raise HTTPException(status_code=500, detail="Error uploading WHO data")


@app.post("/api/v1/upload-analyze-csv")
async def upload_and_analyze_csv(file: UploadFile = File(...)):
    """Upload CSV file and analyze medical data with batch processing"""
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported for medical analysis")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Clean column names (lowercase and strip whitespace)
        df.columns = df.columns.str.strip().str.lower()
        
        print(df)
        # Validate CSV structure
        is_valid, missing_or_available = validate_csv_columns(df)
        if not is_valid:
            raise HTTPException(
                status_code=400, 
                detail=f"CSV missing required columns: {missing_or_available}"
            )
        
        # Create batch analysis record
        batch_id = str(uuid.uuid4())
        batch_record = BatchAnalysisRequest(
            batch_id=batch_id,
            total_records=len(df),
            status="processing",
            created_at=datetime.now()
        )
        batch_analysis_db[batch_id] = batch_record
        
        # Convert DataFrame rows to MedicalRecords
        medical_records = []
        conversion_errors = []
        
        for index, row in df.iterrows():
            try:
                record = prepare_medical_record_from_row(row, index)
                medical_records.append(record)
            except Exception as e:
                conversion_errors.append(f"Row {index}: {str(e)}")
                logger.warning(f"Failed to convert row {index}: {str(e)}")
        
        if not medical_records:
            batch_record.status = "failed"
            batch_record.errors = conversion_errors
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "No valid medical records could be created from the CSV. Please check the errors for details.",
                    "errors": conversion_errors,
                },
            )
        
        # Start batch analysis in background
        asyncio.create_task(process_batch_analysis(batch_id, medical_records))
        
        return {
            "message": "CSV uploaded successfully. Analysis started.",
            "batch_id": batch_id,
            "total_records": len(df),
            "valid_records": len(medical_records),
            "conversion_errors": len(conversion_errors),
            "status": "processing",
            "check_status_url": f"/api/v1/batch-analysis-status/{batch_id}"
        }
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")
