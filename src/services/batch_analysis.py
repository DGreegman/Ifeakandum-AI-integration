# Add this to your main.py - In-memory storage for batch processing
import asyncio
from datetime import datetime
from typing import Any, Dict, List
import logging
from services.patient_service import deepseek_client
import numpy as np
from database import analysis_results_db, batch_analysis_db
import pandas as pd
from schema.patient_schema import CSVAnalysisResult, MedicalRecords, PatientInfo, Symptoms, VitalSigns

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enhanced CSV processing functions
def validate_csv_columns(df: pd.DataFrame) -> tuple[bool, List[str]]:
    """Validate if CSV has required medical columns"""
    required_columns = ['age', 'gender']
    optional_columns = ['symptoms', 'medical_history', 'weight', 'height', 'temperature', 'blood_pressure']
    
    missing_required = [col for col in required_columns if col not in df.columns]
    available_optional = [col for col in optional_columns if col in df.columns]
    
    if missing_required:
        return False, missing_required
    
    return True, available_optional


def prepare_medical_record_from_row(row: pd.Series, row_index: int) -> MedicalRecords:
    """Convert CSV row to MedicalRecords object"""
    try:
        # Handle symptoms - could be comma-separated string
        primary_symptoms = []
        if 'symptoms' in row and pd.notna(row['symptoms']):
            primary_symptoms = [s.strip() for s in str(row['symptoms']).split(',')]
        
        # Handle medical history
        medical_history = []
        if 'medical_history' in row and pd.notna(row['medical_history']):
            medical_history = [h.strip() for h in str(row['medical_history']).split(',')]
        
        # Handle allergies
        allergies = []
        if 'allergies' in row and pd.notna(row['allergies']):
            allergies = [a.strip() for a in str(row['allergies']).split(',')]
        
        # Handle current medications
        current_medications = []
        if 'current_medications' in row and pd.notna(row['current_medications']):
            current_medications = [m.strip() for m in str(row['current_medications']).split(',')]
        
        patient_id = row.get('patient_id', f"patient_{row_index}")

        patient_info = PatientInfo(
            patient_id=str(patient_id),
            name=str(row.get('name', f"Patient_{patient_id}")),
            age=int(row['age']),
            gender=str(row['gender']),
            weight=float(row['weight']) if 'weight' in row and pd.notna(row['weight']) else None,
            height=float(row['height']) if 'height' in row and pd.notna(row['height']) else None,
            medical_history=medical_history,
            allergies=allergies,
            current_medications=current_medications
        )
        
        symptoms = Symptoms(
            primary_symptoms=primary_symptoms if primary_symptoms else ["General consultation"],
            secondary_symptoms=[],
            symptom_duration=str(row.get('symptom_duration', 'Not specified')),
            severity=str(row.get('severity', 'moderate'))
        )
        
        vital_signs = None
        if any(col in row for col in ['temperature', 'blood_pressure', 'heart_rate']):
            vital_signs = VitalSigns(
                temperature=float(row['temperature']) if 'temperature' in row and pd.notna(row['temperature']) else None,
                blood_pressure=str(row['blood_pressure']) if 'blood_pressure' in row and pd.notna(row['blood_pressure']) else None,
                heart_rate=int(row['heart_rate']) if 'heart_rate' in row and pd.notna(row['heart_rate']) else None,
                respiratory_rate=int(row['respiratory_rate']) if 'respiratory_rate' in row and pd.notna(row['respiratory_rate']) else None,
                oxygen_saturation=float(row['oxygen_saturation']) if 'oxygen_saturation' in row and pd.notna(row['oxygen_saturation']) else None
            )
        
        return MedicalRecords(
            patient_info=patient_info,
            symptoms=symptoms,
            vital_signs=vital_signs,
            lab_results=None,
            additional_notes=str(row.get('additional_notes', ''))
        )
    
    except Exception as e:
        logger.error(f"Error preparing medical record for patient {row.get('patient_id', 'unknown')}: {str(e)}")
        raise

async def analyze_batch_records(records: List[MedicalRecords], batch_id: str) -> List[Dict[str, Any]]:
    """Analyze multiple medical records in batch"""
    results = []
    
    # Process in smaller chunks to avoid overwhelming the API
    chunk_size = 5  # Adjust based on API rate limits
    
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        chunk_results = await asyncio.gather(
            *[analyze_single_record_safe(record) for record in chunk],
            return_exceptions=True
        )
        
        for j, result in enumerate(chunk_results):
            if isinstance(result, Exception):
                logger.error(f"Error analyzing record {chunk[j].patient_info.patient_id}: {str(result)}")
                results.append({
                    "patient_id": chunk[j].patient_info.patient_id,
                    "status": "failed",
                    "error": str(result),
                    "analysis": None
                })
            else:
                results.append({
                    "patient_id": chunk[j].patient_info.patient_id,
                    "status": "success",
                    "error": None,
                    "analysis": result
                })
        
        # Update batch progress
        if batch_id in batch_analysis_db:
            batch_analysis_db[batch_id].processed_records = i + len(chunk)
        
        # Small delay to respect API rate limits
        await asyncio.sleep(0.5)
    
    return results

async def analyze_single_record_safe(record: MedicalRecords) -> Dict[str, Any]:
    """Safely analyze a single medical record"""
    try:
        analysis = await deepseek_client.analyze_medical_record(record)
        return analysis
    except Exception as e:
        logger.error(f"Failed to analyze record for patient {record.patient_info.patient_id}: {str(e)}")
        raise

def generate_batch_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate summary statistics from batch analysis results"""
    successful_results = [r for r in results if r["status"] == "success" and r["analysis"]]
    
    if not successful_results:
        return {
            "total_conditions_found": 0,
            "most_common_conditions": [],
            "most_prescribed_medications": [],
            "average_confidence": 0,
            "age_group_analysis": {},
            "gender_distribution": {}
        }
    
    # Extract all conditions
    all_conditions = []
    all_medications = []
    confidence_scores = []
    
    for result in successful_results:
        analysis = result["analysis"]
        all_conditions.extend(analysis.get("suspected_conditions", []))
        
        for med in analysis.get("recommended_medications", []):
            all_medications.append(med.get("medication_name", "Unknown"))
            if med.get("confidence_score"):
                confidence_scores.append(float(med["confidence_score"]))
    
    # Calculate statistics
    from collections import Counter
    condition_counts = Counter(all_conditions)
    medication_counts = Counter(all_medications)
    
    return {
        "total_conditions_found": len(all_conditions),
        "most_common_conditions": condition_counts.most_common(10),
        "most_prescribed_medications": medication_counts.most_common(10),
        "average_confidence": np.mean(confidence_scores) if confidence_scores else 0,
        "total_successful_analyses": len(successful_results),
        "total_failed_analyses": len(results) - len(successful_results)
    }


async def process_batch_analysis(batch_id: str, medical_records: List[MedicalRecords]):
    """Background task to process batch analysis"""
    try:
        start_time = datetime.now()
        
        # Perform batch analysis
        results = await analyze_batch_records(medical_records, batch_id)
        
        # Generate summary
        summary = generate_batch_summary(results)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # Update batch record
        batch_record = batch_analysis_db[batch_id]
        batch_record.status = "completed"
        batch_record.results = results
        batch_record.completed_at = end_time
        
        # Create detailed analysis result
        analysis_result = CSVAnalysisResult(
            batch_id=batch_id,
            total_records=len(medical_records),
            successful_analyses=summary["total_successful_analyses"],
            failed_analyses=summary["total_failed_analyses"],
            analysis_summary=summary,
            detailed_results=results,
            processing_time=processing_time,
            recommendations=[
                "Review failed analyses for data quality issues",
                "Consider additional tests for patients with low confidence scores",
                f"Most common condition: {summary['most_common_conditions'][0][0] if summary['most_common_conditions'] else 'None'}",
                "Ensure proper medical supervision for all recommendations"
            ]
        )
        
        # Store detailed results
        analysis_results_db[f"batch_{batch_id}"] = analysis_result
        
    except Exception as e:
        logger.error(f"Batch analysis failed for {batch_id}: {str(e)}")
        batch_record = batch_analysis_db[batch_id]
        batch_record.status = "failed"
        batch_record.errors.append(str(e))