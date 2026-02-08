import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Trash, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/axios';
import type { AnalysisResult, MedicalRecord } from '../types';

export const Analysis = () => {
    const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');

    // Form State
    const [formData, setFormData] = useState<Partial<MedicalRecord>>({
        patient_info: {
            patient_id: crypto.randomUUID(), // Auto-generate ID for now
            name: '',
            age: 0,
            gender: 'Male',
            weight: undefined,
            height: undefined,
            medical_history: [],
            allergies: [],
            current_medications: []
        },
        symptoms: {
            primary_symptoms: [],
            secondary_symptoms: [],
            symptom_duration: '',
            severity: 'Moderate'
        },
        vital_signs: {
            temperature: 37.0,
            blood_pressure: '',
            heart_rate: 0,
            respiratory_rate: undefined,
            oxygen_saturation: undefined
        },
        lab_results: {},
        additional_notes: ''
    });

    const mutation = useMutation({
        mutationFn: async (data: MedicalRecord) => {
            const response = await api.post<AnalysisResult>('/analyze-record', data);
            return response.data;
        },
        onMutate: () => setStep('processing'),
        onSuccess: () => {
            setStep('result');
        },
        onError: (error) => {
            console.error(error);
            setStep('input');
            alert('Analysis failed. Please check the logs.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Validate?
        mutation.mutate(formData as MedicalRecord);
    };

    const addListItem = (field: keyof MedicalRecord, listName: string, value: string) => {
        if (!value) return;
        setFormData(prev => {
            const section = prev[field] as any; // Cast to any to access dynamic props safely for partial update
            const list = section?.[listName] || [];
            return {
                ...prev,
                [field]: {
                    ...section,
                    [listName]: [...list, value]
                }
            };
        });
    };

    const removeListItem = (field: keyof MedicalRecord, listName: string, index: number) => {
        setFormData(prev => {
            const section = prev[field] as any;
            const list = section?.[listName] || [];
            return {
                ...prev,
                [field]: {
                    ...section,
                    [listName]: list.filter((_: any, i: number) => i !== index)
                }
            };
        });
    };

    if (step === 'processing') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="relative">
                    <div className="h-24 w-24 rounded-full border-t-4 border-b-4 border-teal-600 animate-spin"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <Activity className="h-8 w-8 text-teal-600 animate-pulse" />
                    </div>
                </div>
                <h2 className="mt-8 text-xl font-semibold text-gray-900">Analyzing Patient Data...</h2>
                <p className="mt-2 text-gray-500">Consulting AI Knowledge Base</p>
            </div>
        );
    }

    if (step === 'result' && mutation.data) {
        const result = mutation.data;
        return (
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
                    <button
                        onClick={() => {
                            setStep('input');
                            setFormData(prev => ({ ...prev, patient_info: { ...prev.patient_info!, patient_id: crypto.randomUUID() } }));
                        }}
                        className="text-sm text-teal-700 hover:text-teal-800 font-bold underline decoration-2 underline-offset-2"
                    >
                        Start New Analysis
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Suspected Conditions */}
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

                    {/* Confidence & Risk */}
                    <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
                                <Activity className="h-5 w-5 text-blue-500 mr-2" />
                                Assessment Overview
                            </h3>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500">Confidence Level</span>
                                <span className={clsx(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase",
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

                {/* Recommended Medications */}
                <div className="mt-8 bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                            Recommended Medications
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead>
                                    <tr>
                                        <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosage</th>
                                        <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                                        <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {result.recommended_medications.map((med, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 whitespace-nowrap text-sm font-medium text-gray-900">{med.medication_name}</td>
                                            <td className="py-2 whitespace-nowrap text-sm text-gray-500">{med.dosage}</td>
                                            <td className="py-2 whitespace-nowrap text-sm text-gray-500">{med.frequency}</td>
                                            <td className="py-2 text-sm text-gray-500">{med.instructions}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Treatment Notes */}
                <div className="mt-8 bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Treatment Notes</h3>
                        <p className="text-gray-700 whitespace-pre-line">{result.treatment_notes}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="md:flex md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">New Patient Analysis</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Patient Info Section */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Patient Information</h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Full Name <span className="text-red-600">*</span></label>
                            <input
                                type="text"
                                required
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.name}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, name: e.target.value } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Age <span className="text-red-600">*</span></label>
                            <input
                                type="number"
                                required
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.age}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, age: parseInt(e.target.value) } })}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Gender <span className="text-red-600">*</span></label>
                            <select
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
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
                                type="number"
                                step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.weight || ''}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, weight: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Height (cm)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.patient_info?.height || ''}
                                onChange={e => setFormData({ ...formData, patient_info: { ...formData.patient_info!, height: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                    </div>

                    {/* Medical History */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium leading-6 text-gray-900">Medical History (Press Enter to add)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('patient_info', 'medical_history', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.patient_info?.medical_history?.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                    {item}
                                    <button type="button" onClick={() => removeListItem('patient_info', 'medical_history', idx)} className="ml-1 text-blue-600 hover:text-blue-800">
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Allergies */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium leading-6 text-gray-900">Allergies (Press Enter to add)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('patient_info', 'allergies', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.patient_info?.allergies?.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                    {item}
                                    <button type="button" onClick={() => removeListItem('patient_info', 'allergies', idx)} className="ml-1 text-red-600 hover:text-red-800">
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Current Medications */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium leading-6 text-gray-900">Current Medications (Press Enter to add)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('patient_info', 'current_medications', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.patient_info?.current_medications?.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                                    {item}
                                    <button type="button" onClick={() => removeListItem('patient_info', 'current_medications', idx)} className="ml-1 text-purple-600 hover:text-purple-800">
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Symptoms Section */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Clinical Symptoms</h3>

                    <div className="mb-4">
                        <label className="block text-sm font-medium leading-6 text-gray-900">Primary Symptoms (Press Enter to add) <span className="text-red-600">*</span></label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('symptoms', 'primary_symptoms', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.symptoms?.primary_symptoms.map((sym, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                                    {sym}
                                    <button type="button" onClick={() => removeListItem('symptoms', 'primary_symptoms', idx)} className="ml-1 text-teal-600 hover:text-teal-800">
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium leading-6 text-gray-900">Secondary Symptoms (Press Enter to add)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addListItem('symptoms', 'secondary_symptoms', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.symptoms?.secondary_symptoms?.map((sym, idx) => (
                                <span key={idx} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                    {sym}
                                    <button type="button" onClick={() => removeListItem('symptoms', 'secondary_symptoms', idx)} className="ml-1 text-gray-600 hover:text-gray-800">
                                        <Trash className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Duration</label>
                            <input
                                type="text"
                                placeholder="e.g. 3 days"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.symptoms?.symptom_duration}
                                onChange={e => setFormData({ ...formData, symptoms: { ...formData.symptoms!, symptom_duration: e.target.value } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Severity</label>
                            <select
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
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

                {/* Vitals Section */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Vital Signs</h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Temperature (°C)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.vital_signs?.temperature || ''}
                                onChange={e => setFormData({ ...formData, vital_signs: { ...formData.vital_signs!, temperature: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Blood Pressure</label>
                            <input
                                type="text"
                                placeholder="120/80"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.vital_signs?.blood_pressure || ''}
                                onChange={e => setFormData({ ...formData, vital_signs: { ...formData.vital_signs!, blood_pressure: e.target.value } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Heart Rate (bpm)</label>
                            <input
                                type="number"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.vital_signs?.heart_rate || ''}
                                onChange={e => setFormData({ ...formData, vital_signs: { ...formData.vital_signs!, heart_rate: parseInt(e.target.value) || undefined } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Respiratory Rate (bpm)</label>
                            <input
                                type="number"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.vital_signs?.respiratory_rate || ''}
                                onChange={e => setFormData({ ...formData, vital_signs: { ...formData.vital_signs!, respiratory_rate: parseInt(e.target.value) || undefined } })}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium leading-6 text-gray-900">Oxygen Saturation (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                                value={formData.vital_signs?.oxygen_saturation || ''}
                                onChange={e => setFormData({ ...formData, vital_signs: { ...formData.vital_signs!, oxygen_saturation: parseFloat(e.target.value) || undefined } })}
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Notes Section */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Additional Information</h3>
                    <div>
                        <label className="block text-sm font-medium leading-6 text-gray-900">Additional Notes</label>
                        <textarea
                            rows={4}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                            placeholder="Any additional observations, notes, or relevant information..."
                            value={formData.additional_notes || ''}
                            onChange={e => setFormData({ ...formData, additional_notes: e.target.value })}
                        />
                    </div>
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
