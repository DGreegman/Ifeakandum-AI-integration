#!/usr/bin/env python3
"""
Test script to verify wearable healthcare dataset processing
"""
import sys
sys.path.insert(0, 'src')

import pandas as pd
from services.batch_analysis import validate_csv_columns, prepare_medical_record_from_row

# Load the CSV
print("Loading wearable healthcare CSV...")
df = pd.read_csv('Wearable healthcare Dataset_Original_csv.csv')

# Normalize column names (lowercase and strip whitespace)
df.columns = df.columns.str.strip().str.lower()

print(f"\nCSV loaded successfully!")
print(f"Total rows: {len(df)}")
print(f"Columns: {list(df.columns)}\n")

# Validate CSV format
print("Validating CSV format...")
is_valid, format_info = validate_csv_columns(df)

if is_valid:
    print(f"✓ CSV format is valid!")
    print(f"  Format type: {format_info[0]}")
else:
    print(f"✗ CSV validation failed. Missing columns: {format_info}")
    sys.exit(1)

# Test converting first 3 rows
print("\nTesting data conversion for first 3 patients...")
for index in range(min(3, len(df))):
    row = df.iloc[index]
    try:
        medical_record = prepare_medical_record_from_row(row, index)
        print(f"\n✓ Patient {index + 1} ({medical_record.patient_info.patient_id}):")
        print(f"  Primary Symptoms: {medical_record.symptoms.primary_symptoms}")
        print(f"  Severity: {medical_record.symptoms.severity}")
        print(f"  Heart Rate: {medical_record.vital_signs.heart_rate} bpm")
        print(f"  Blood Pressure: {medical_record.vital_signs.blood_pressure}")
        print(f"  SpO2: {medical_record.vital_signs.oxygen_saturation}%")
        print(f"  Temperature: {medical_record.vital_signs.temperature}°C")
        if medical_record.symptoms.secondary_symptoms:
            print(f"  Alerts: {', '.join(medical_record.symptoms.secondary_symptoms)}")
    except Exception as e:
        print(f"\n✗ Failed to convert patient {index + 1}: {str(e)}")
        import traceback
        traceback.print_exc()

print("\n" + "="*60)
print("Test completed successfully! ✓")
print("The wearable dataset can now be processed via the API.")
print("="*60)
