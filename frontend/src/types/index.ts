export interface PatientInfo {
    patient_id: string;
    name: string;
    age: number;
    gender: string;
    weight?: number;
    height?: number;
    medical_history?: string[];
    allergies?: string[];
    current_medications?: string[];
}

export interface Symptoms {
    primary_symptoms: string[];
    secondary_symptoms?: string[];
    symptom_duration?: string;
    severity?: string;
}

export interface VitalSigns {
    temperature?: number;
    blood_pressure?: string;
    heart_rate?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
}

export interface MedicalRecord {
    patient_info: PatientInfo;
    symptoms: Symptoms;
    vital_signs?: VitalSigns;
    lab_results?: Record<string, any>;
    additional_notes?: string;
}

export interface MedicationRecommendation {
    medication_name: string;
    dosage: string;
    frequency: string;
    duration?: string;
    instructions?: string;
    contraindications?: string[];
    side_effects?: string[];
    confidence_score?: number;
}

export interface AnalysisResult {
    patient_id: string;
    analysis_date: string; // ISO date string
    suspected_conditions: string[];
    recommended_medications: MedicationRecommendation[];
    additional_tests: string[];
    risk_factors?: string[];
    treatment_notes: string;
    confidence_level: string;
}

export interface BatchStatus {
    batch_id: string;
    total_records: number;
    processed_records: number;
    status: string;
    errors: string[];
    created_at: string;
    completed_at?: string;
}

export interface BatchResult {
    batch_id: string;
    total_records: number;
    successful_analyses: number;
    failed_analyses: number;
    results: {
        record_id: string;
        conditions: string[];
        medications: MedicationRecommendation[];
        confidence: string;
    }[];
}

export interface DoctorReport {
    report_id: string;
    patient_id: string;
    doctor_id: string;
    analysis_summary: string;
    medications_prescribed: MedicationRecommendation[];
    follow_up_recommendations: string[];
    generated_date: string;
}
