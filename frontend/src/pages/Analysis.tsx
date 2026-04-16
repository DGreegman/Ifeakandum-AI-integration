import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash, Activity, AlertCircle, CheckCircle, Search, UserCheck, X, Plus, FlaskConical, Printer } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/axios';
import type { AnalysisResult, MedicalRecord, PatientSearchResult } from '../types';

// ─── Lab Results widget ────────────────────────────────────────────────────────

interface LabRow { key: string; value: string; }

const LabResultsWidget = ({
    rows,
    onChange,
}: {
    rows: LabRow[];
    onChange: (rows: LabRow[]) => void;
}) => {
    const addRow = () => onChange([...rows, { key: '', value: '' }]);
    const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
    const updateRow = (i: number, field: 'key' | 'value', val: string) => {
        const next = [...rows];
        next[i] = { ...next[i], [field]: val };
        onChange(next);
    };

    return (
        <div>
            {rows.length > 0 && (
                <div className="mb-2 space-y-2">
                    {rows.map((row, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Test name (e.g. Glucose)"
                                className="flex-1 rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={row.key}
                                onChange={e => updateRow(i, 'key', e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Result (e.g. 13.2 mmol/L)"
                                className="flex-1 rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={row.value}
                                onChange={e => updateRow(i, 'value', e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeRow(i)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
                <Plus className="h-4 w-4" />
                Add Lab Result
            </button>
        </div>
    );
};

// ─── Patient Search autocomplete ───────────────────────────────────────────────

const PatientSearch = ({
    onSelect,
}: {
    onSelect: (patient: PatientSearchResult) => void;
}) => {
    const [query, setQuery] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setDebouncedQ(query), 300);
        return () => clearTimeout(timerRef.current);
    }, [query]);

    const { data: results } = useQuery<PatientSearchResult[]>({
        queryKey: ['patientSearch', debouncedQ],
        queryFn: async () => (await api.get<PatientSearchResult[]>(`/patients/search?q=${encodeURIComponent(debouncedQ)}`)).data,
        enabled: debouncedQ.length >= 2,
    });

    const handleSelect = (p: PatientSearchResult) => {
        onSelect(p);
        setQuery('');
        setDebouncedQ('');
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search by patient name or ID to pre-fill..."
                    className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>
            {results && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto">
                    {results.map(p => (
                        <button
                            key={p.patient_id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                            onClick={() => handleSelect(p)}
                        >
                            <UserCheck className="h-5 w-5 text-teal-500 shrink-0" />
                            <div>
                                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.age} y/o · {p.gender} · ID: {p.patient_id}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
            {debouncedQ.length >= 2 && results && results.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 px-4 py-3 text-sm text-gray-500">
                    No patients found — a new patient will be created.
                </div>
            )}
        </div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const Analysis = () => {
    const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');
    const [labRows, setLabRows] = useState<LabRow[]>([]);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const defaultPatient = () => ({
        patient_id: crypto.randomUUID(),
        name: '',
        age: 0,
        gender: 'Male',
        weight: undefined as number | undefined,
        height: undefined as number | undefined,
        medical_history: [] as string[],
        allergies: [] as string[],
        current_medications: [] as string[],
    });

    const [formData, setFormData] = useState<Partial<MedicalRecord>>({
        patient_info: defaultPatient(),
        symptoms: {
            primary_symptoms: [],
            secondary_symptoms: [],
            symptom_duration: '',
            severity: 'Moderate',
        },
        vital_signs: {
            temperature: 37.0,
            blood_pressure: '',
            heart_rate: 0,
            respiratory_rate: undefined,
            oxygen_saturation: undefined,
        },
        lab_results: {},
        additional_notes: '',
    });

    const mutation = useMutation({
        mutationFn: async (data: MedicalRecord) => {
            const response = await api.post<AnalysisResult>('/analyze-record', data);
            return response.data;
        },
        onMutate: () => setStep('processing'),
        onSuccess: () => setStep('result'),
        onError: (error) => {
            console.error(error);
            setStep('input');
            alert('Analysis failed. Please check the logs.');
        },
    });

    const validate = (): Record<string, string> => {
        const errs: Record<string, string> = {};
        const p = formData.patient_info;
        const s = formData.symptoms;
        const v = formData.vital_signs;
        if (!p?.name?.trim()) errs.name = 'Full name is required.';
        if (!p?.age || p.age < 1 || p.age > 120) errs.age = 'Age must be between 1 and 120.';
        if (!s?.primary_symptoms?.length) errs.primary_symptoms = 'At least one primary symptom is required.';
        if (v?.temperature !== undefined && (v.temperature < 34 || v.temperature > 43))
            errs.temperature = 'Temperature must be between 34 and 43 °C.';
        if (v?.heart_rate !== undefined && v.heart_rate !== 0 && (v.heart_rate < 20 || v.heart_rate > 300))
            errs.heart_rate = 'Heart rate must be between 20 and 300 bpm.';
        if (v?.respiratory_rate !== undefined && (v.respiratory_rate < 4 || v.respiratory_rate > 60))
            errs.respiratory_rate = 'Respiratory rate must be between 4 and 60 bpm.';
        if (v?.oxygen_saturation !== undefined && (v.oxygen_saturation < 50 || v.oxygen_saturation > 100))
            errs.oxygen_saturation = 'Oxygen saturation must be between 50 and 100%.';
        return errs;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            // Scroll to first error
            const firstKey = Object.keys(errs)[0];
            document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setFieldErrors({});
        // Merge labRows into lab_results object
        const lab_results: Record<string, string> = {};
        labRows.forEach(({ key, value }) => {
            if (key.trim()) lab_results[key.trim()] = value.trim();
        });
        mutation.mutate({ ...formData, lab_results } as MedicalRecord);
    };

    const handlePatientSelect = (p: PatientSearchResult) => {
        setFormData(prev => ({
            ...prev,
            patient_info: {
                patient_id: p.patient_id,
                name: p.name,
                age: p.age,
                gender: p.gender,
                weight: p.weight,
                height: p.height,
                medical_history: p.medical_history ?? [],
                allergies: p.allergies ?? [],
                current_medications: p.current_medications ?? [],
            },
        }));
    };

    const handleClearPatient = () => {
        setFormData(prev => ({ ...prev, patient_info: defaultPatient() }));
    };

    const addListItem = (field: keyof MedicalRecord, listName: string, value: string) => {
        if (!value) return;
        setFormData(prev => {
            const section = prev[field] as any;
            return { ...prev, [field]: { ...section, [listName]: [...(section?.[listName] || []), value] } };
        });
    };

    const removeListItem = (field: keyof MedicalRecord, listName: string, index: number) => {
        setFormData(prev => {
            const section = prev[field] as any;
            return { ...prev, [field]: { ...section, [listName]: (section?.[listName] || []).filter((_: any, i: number) => i !== index) } };
        });
    };

    // ── Processing screen ──────────────────────────────────────────────────────

    if (step === 'processing') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="relative">
                    <div className="h-24 w-24 rounded-full border-t-4 border-b-4 border-teal-600 animate-spin" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <Activity className="h-8 w-8 text-teal-600 animate-pulse" />
                    </div>
                </div>
                <h2 className="mt-8 text-xl font-semibold text-gray-900">Analyzing Patient Data...</h2>
                <p className="mt-2 text-gray-500">Consulting AI Knowledge Base</p>
            </div>
        );
    }

    // ── Result screen ──────────────────────────────────────────────────────────

    if (step === 'result' && mutation.data) {
        const result = mutation.data;
        return (
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8 print:hidden">
                    <button
                        onClick={() => {
                            setStep('input');
                            setLabRows([]);
                            setFormData(prev => ({ ...prev, patient_info: defaultPatient() }));
                        }}
                        className="text-sm text-teal-700 hover:text-teal-800 font-bold underline decoration-2 underline-offset-2"
                    >
                        Start New Analysis
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <Printer className="h-4 w-4" />
                        Print / Export
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-red-500">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
                                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                                Suspected Conditions
                            </h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {result.suspected_conditions.map((condition, idx) => (
                                    <li key={idx} className="text-gray-700 font-medium">{condition}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
                                <Activity className="h-5 w-5 text-blue-500 mr-2" />
                                Assessment Overview
                            </h3>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500">Confidence Level</span>
                                <span className={clsx(
                                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase',
                                    result.confidence_level === 'high' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                )}>
                                    {result.confidence_level}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block mb-2">Risk Factors</span>
                                <div className="flex flex-wrap gap-2">
                                    {result.risk_factors?.map((risk, idx) => (
                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                                            {risk}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {result.additional_tests && result.additional_tests.length > 0 && (
                    <div className="mt-6 bg-white overflow-hidden shadow rounded-lg border-l-4 border-yellow-500">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-3 flex items-center">
                                <Activity className="h-5 w-5 text-yellow-500 mr-2" />
                                Additional Tests Recommended
                            </h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {result.additional_tests.map((test, idx) => (
                                    <li key={idx} className="text-gray-700 text-sm">{test}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="mt-6 bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                            Recommended Medications
                        </h3>
                        <div className="space-y-6">
                            {result.recommended_medications.map((med, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="text-base font-semibold text-gray-900">{med.medication_name}</span>
                                            <span className="ml-3 text-sm text-gray-500">{med.dosage}</span>
                                        </div>
                                        {med.confidence_score !== undefined && (
                                            <span className={clsx(
                                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                                med.confidence_score >= 0.8 ? 'bg-green-100 text-green-800' :
                                                med.confidence_score >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            )}>
                                                {Math.round(med.confidence_score * 100)}% confidence
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
                                        <div>
                                            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Frequency</span>
                                            <span className="text-gray-800">{med.frequency}</span>
                                        </div>
                                        {med.duration && (
                                            <div>
                                                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Duration</span>
                                                <span className="text-gray-800">{med.duration}</span>
                                            </div>
                                        )}
                                        {med.instructions && (
                                            <div>
                                                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Instructions</span>
                                                <span className="text-gray-800">{med.instructions}</span>
                                            </div>
                                        )}
                                    </div>
                                    {((med.contraindications && med.contraindications.length > 0) || (med.side_effects && med.side_effects.length > 0)) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3 mt-3">
                                            {med.contraindications && med.contraindications.length > 0 && (
                                                <div>
                                                    <span className="block text-xs font-medium text-red-600 uppercase tracking-wider mb-1">⚠ Contraindications</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {med.contraindications.map((c, i) => (
                                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-700">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {med.side_effects && med.side_effects.length > 0 && (
                                                <div>
                                                    <span className="block text-xs font-medium text-orange-600 uppercase tracking-wider mb-1">Side Effects</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {med.side_effects.map((se, i) => (
                                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700">{se}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Treatment Notes</h3>
                        <p className="text-gray-700 whitespace-pre-line">{result.treatment_notes}</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Input form ─────────────────────────────────────────────────────────────

    const isExistingPatient = !!(formData.patient_info?.name);

    return (
        <div className="max-w-3xl mx-auto">
            <div className="md:flex md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">New Patient Analysis</h2>
            </div>

            {/* Patient Search */}
            <div className="bg-blue-50 border border-blue-200 shadow sm:rounded-lg p-6 mb-6">
                <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Returning Patient?
                </h3>
                <p className="text-xs text-blue-600 mb-3">Search for an existing patient to pre-fill their details, or proceed below to create a new record.</p>
                <PatientSearch onSelect={handlePatientSelect} />
                {isExistingPatient && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-100 px-4 py-2">
                        <span className="text-sm font-medium text-blue-900">
                            ✓ Pre-filled: <strong>{formData.patient_info?.name}</strong>
                        </span>
                        <button type="button" onClick={handleClearPatient} className="text-xs text-blue-600 hover:text-blue-800 underline">
                            Clear / New Patient
                        </button>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Patient Info */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Patient Information</h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                        <div className="sm:col-span-3" id="field-name">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Full Name <span className="text-red-600">*</span></label>
                            <input
                                type="text"
                                required
                                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ${fieldErrors.name ? 'ring-red-500 focus:ring-red-500' : 'ring-gray-300 focus:ring-teal-600'} placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                                value={formData.patient_info?.name}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, name: e.target.value } })}
                            />
                            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
                        </div>
                        <div className="sm:col-span-1" id="field-age">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Age <span className="text-red-600">*</span></label>
                            <input
                                type="number"
                                required
                                min={1} max={120}
                                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ${fieldErrors.age ? 'ring-red-500 focus:ring-red-500' : 'ring-gray-300 focus:ring-teal-600'} focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                                value={formData.patient_info?.age || ''}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, age: parseInt(e.target.value) } })}
                            />
                            {fieldErrors.age && <p className="mt-1 text-xs text-red-600">{fieldErrors.age}</p>}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Gender <span className="text-red-600">*</span></label>
                            <select
                                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.gender}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, gender: e.target.value } })}
                            >
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Weight (kg)</label>
                            <input
                                type="number" step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.weight || ''}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, weight: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Height (cm)</label>
                            <input
                                type="number" step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.height || ''}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, height: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                    </div>

                    {/* Medical History */}
                    {(['medical_history', 'allergies', 'current_medications'] as const).map(listName => {
                        const colors: Record<string, string> = {
                            medical_history: 'bg-blue-100 text-blue-800',
                            allergies: 'bg-red-100 text-red-800',
                            current_medications: 'bg-purple-100 text-purple-800',
                        };
                        const btnColors: Record<string, string> = {
                            medical_history: 'text-blue-600 hover:text-blue-800',
                            allergies: 'text-red-600 hover:text-red-800',
                            current_medications: 'text-purple-600 hover:text-purple-800',
                        };
                        const labels: Record<string, string> = {
                            medical_history: 'Medical History',
                            allergies: 'Allergies',
                            current_medications: 'Current Medications',
                        };
                        return (
                            <div key={listName} className="mt-4">
                                <label className="block text-sm font-medium leading-6 text-gray-900">{labels[listName]} (Press Enter to add)</label>
                                <input
                                    type="text"
                                    className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addListItem('patient_info', listName, e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(formData.patient_info?.[listName] as string[] | undefined)?.map((item, idx) => (
                                        <span key={idx} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[listName]}`}>
                                            {item}
                                            <button type="button" onClick={() => removeListItem('patient_info', listName, idx)} className={`ml-1 ${btnColors[listName]}`}>
                                                <Trash className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Symptoms */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Clinical Symptoms</h3>

                    {(['primary_symptoms', 'secondary_symptoms'] as const).map(listName => (
                        <div key={listName} className="mb-4" id={listName === 'primary_symptoms' ? 'field-primary_symptoms' : undefined}>
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                                {listName === 'primary_symptoms' ? <>Primary Symptoms <span className="text-red-600">*</span></> : 'Secondary Symptoms'} (Press Enter to add)
                            </label>
                            <input
                                type="text"
                                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ${listName === 'primary_symptoms' && fieldErrors.primary_symptoms ? 'ring-red-500' : 'ring-gray-300'} focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6`}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('symptoms', listName, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            {listName === 'primary_symptoms' && fieldErrors.primary_symptoms && (
                                <p className="mt-1 text-xs text-red-600">{fieldErrors.primary_symptoms}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(formData.symptoms?.[listName] as string[] | undefined)?.map((sym, idx) => (
                                    <span key={idx} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${listName === 'primary_symptoms' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {sym}
                                        <button type="button" onClick={() => removeListItem('symptoms', listName, idx)} className="ml-1 text-gray-500 hover:text-gray-700">
                                            <Trash className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">Duration</label>
                            <input
                                type="text"
                                placeholder="e.g. 3 days"
                                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.symptoms?.symptom_duration}
                                onChange={e => setFormData({ ...formData, symptoms: { ...formData.symptoms!, symptom_duration: e.target.value } })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">Severity</label>
                            <select
                                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.symptoms?.severity}
                                onChange={e => setFormData({ ...formData, symptoms: { ...formData.symptoms!, severity: e.target.value } })}
                            >
                                <option>Mild</option>
                                <option>Moderate</option>
                                <option>Severe</option>
                                <option>Critical</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Vitals */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Vital Signs</h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                        {[
                            { label: 'Temperature (°C)', key: 'temperature', type: 'number', step: '0.1', min: '34', max: '43' },
                            { label: 'Blood Pressure', key: 'blood_pressure', type: 'text', placeholder: '120/80' },
                            { label: 'Heart Rate (bpm)', key: 'heart_rate', type: 'number', min: '20', max: '300' },
                            { label: 'Respiratory Rate (bpm)', key: 'respiratory_rate', type: 'number' },
                            { label: 'Oxygen Saturation (%)', key: 'oxygen_saturation', type: 'number', step: '0.1', min: '50', max: '100' },
                        ].map(({ label, key, type, ...rest }) => (
                            <div key={key} className="sm:col-span-1">
                                <label className="block text-sm font-medium leading-6 text-gray-900">{label}</label>
                                <input
                                    type={type}
                                    className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                    value={(formData.vital_signs as any)?.[key] || ''}
                                    onChange={e => setFormData({
                                        ...formData,
                                        vital_signs: {
                                            ...formData.vital_signs!,
                                            [key]: type === 'number' ? (parseFloat(e.target.value) || undefined) : e.target.value,
                                        },
                                    })}
                                    {...rest}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lab Results */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-1 flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-teal-600" />
                        Lab Results
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">Add any available test results to improve AI accuracy.</p>
                    <LabResultsWidget rows={labRows} onChange={setLabRows} />
                </div>

                {/* Additional Notes */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Additional Information</h3>
                    <label className="block text-sm font-medium leading-6 text-gray-900">Additional Notes</label>
                    <textarea
                        rows={4}
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                        placeholder="Any additional observations, notes, or relevant information..."
                        value={formData.additional_notes || ''}
                        onChange={e => setFormData({ ...formData, additional_notes: e.target.value })}
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="rounded-md bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50"
                    >
                        Generate Analysis
                    </button>
                </div>
            </form>
        </div>
    );
};
