# Using the Wearable Healthcare Dataset

## Overview

The batch analysis system now supports **two CSV formats**:
1. **Traditional medical records** (age, gender, symptoms, etc.)
2. **Wearable healthcare device data** (heart rate, SpO2, blood pressure, etc.)

The system automatically detects which format you're using and processes it accordingly.

## Wearable Dataset Format

Your CSV file `Wearable healthcare Dataset_Original_csv.csv` contains:

**Required Columns:**
- `Patient Number` - Patient identifier
- `Heart Rate (bpm)` - Heart rate measurement
- `SpO2 Level (%)` - Oxygen saturation percentage
- `Systolic Blood Pressure (mmHg)` - Systolic blood pressure
- `Diastolic Blood Pressure (mmHg)` - Diastolic blood pressure  
- `Body Temperature (°C)` - Body temperature in Celsius

**Optional Columns (used for enhanced analysis):**
- `Predicted Disease` - Pre-classified condition
- `Heart Rate Alert`, `SpO2 Level Alert`, `Blood Pressure Alert`, `Temperature Alert` - Abnormality flags
- `Fall Detection` - Fall detection status
- `Data Accuracy (%)` - Measurement accuracy percentage

## How the Data is Mapped

| Wearable Column | Medical Record Field | Notes |
|----------------|---------------------|-------|
| Patient Number | patient_id | Direct mapping |
| Heart Rate (bpm) | vital_signs.heart_rate | Converted to integer |
| SpO2 Level (%) | vital_signs.oxygen_saturation | Converted to float |
| Systolic/Diastolic BP | vital_signs.blood_pressure | Combined as "120/80" format |
| Body Temperature (°C) | vital_signs.temperature | Converted to float |
| Predicted Disease | symptoms.primary_symptoms | Used as main symptom |
| Alert columns | symptoms.severity | Determines severity level |
| Fall Detection | additional_notes | Included in notes |
| Data Accuracy (%) | additional_notes | Included in notes |

**Default Values** (for missing demographic data):
- Age: 45 (default middle-aged adult)
- Gender: "Unknown"
- Name: "Patient_{patient_number}"

## How to Use

### 1. Start the API Server

```bash
cd /home/diftrak/Projects/Ifeakandum-AI-integration
python3 src/main.py
```

The server will start on `http://localhost:8000`

### 2. Upload Your Wearable CSV

**Using curl:**
```bash
curl -X POST "http://localhost:8000/api/v1/upload-analyze-csv" \
  -F "file=@Wearable healthcare Dataset_Original_csv.csv"
```

**Using Python:**
```python
import httpx

with open("Wearable healthcare Dataset_Original_csv.csv", "rb") as f:
    files = {"file": ("wearable_data.csv", f, "text/csv")}
    response = httpx.post(
        "http://localhost:8000/api/v1/upload-analyze-csv",
        files=files
    )
    print(response.json())
```

### 3. Check the Response

You'll receive a response like:
```json
{
  "message": "CSV uploaded successfully. Analysis started.",
  "batch_id": "abc123-def456-...",
  "total_records": 100,
  "valid_records": 100,
  "conversion_errors": 0,
  "status": "processing",
  "check_status_url": "/api/v1/batch-analysis-status/abc123-def456-..."
}
```

### 4. Monitor Progress

The batch analysis runs in the background. You can check the status using the `batch_id`.

## Example: What Gets Sent to AI

For a patient with:
- Heart Rate: 105 bpm (ABNORMAL)
- SpO2: 97% (NORMAL)
- Blood Pressure: 177/104 mmHg (ABNORMAL)
- Temperature: 37.6°C (ABNORMAL)
- Predicted Disease: Heart Disease

The AI receives:
```
Patient: 45yr Unknown
Symptoms:
  Primary: Heart Disease
  Secondary: Abnormal heart rate, Abnormal blood pressure, Abnormal temperature
  Severity: severe
Vital Signs:
  BP: 177/104
  HR: 105 bpm
  Temp: 37.6°C
  SpO2: 97%
```

## Verification

The implementation includes:
- ✅ Auto-detection of CSV format (traditional vs wearable)
- ✅ Column name normalization (lowercase, trimmed)
- ✅ Proper data type conversions
- ✅ Alert-based severity calculation
- ✅ Backward compatibility with traditional CSV format
- ✅ Error handling for missing/invalid data

## Testing Checklist

Before running with the full dataset, verify:
1. [ ] API server starts without errors
2. [ ] CSV upload endpoint is accessible
3. [ ] First few records process successfully
4. [ ] AI analysis returns reasonable recommendations
5. [ ] Batch processing completes without crashes

## Notes

- The system processes records in chunks of 5 to respect API rate limits
- Each record gets analyzed by DeepSeek AI individually
- Results are stored in-memory (will be lost on server restart)
- For production use, implement persistent database storage (see IMPROVEMENTS.md)
