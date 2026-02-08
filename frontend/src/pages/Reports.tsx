import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Calendar, User } from 'lucide-react';
import api from '../lib/axios';
import type { DoctorReport } from '../types';
import { format } from 'date-fns';

export const Reports = () => {
    const [patientId, setPatientId] = useState('');
    const [searchId, setSearchId] = useState('');

    const { data: reports, isLoading, error } = useQuery({
        queryKey: ['doctorReports', searchId],
        queryFn: async () => {
            const res = await api.get<DoctorReport[]>(`/doctor-reports/${searchId}`);
            return res.data;
        },
        enabled: !!searchId
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchId(patientId);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">Medical Reports</h2>
            </div>

            {/* Search */}
            <div className="bg-white shadow sm:rounded-lg p-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-grow">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                            placeholder="Enter Patient ID to view reports..."
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-md bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-800"
                    >
                        Search
                    </button>
                </form>
            </div>

            {/* Results */}
            <div className="space-y-4">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading reports...</div>}

                {error && (
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {/* Error Icon */}
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">No reports found or error occurred</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>Could not find reports for Patient ID: {searchId}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {reports && reports.length === 0 && (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow">No reports file for this patient.</div>
                )}

                {reports?.map((report) => (
                    <div key={report.report_id} className="bg-white shadow sm:rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    Report #{report.report_id.slice(0, 8)}
                                </h3>
                                <p className="mt-1 max-w-2xl text-sm text-gray-500 flex items-center gap-4">
                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> Patient: {report.patient_id.slice(0, 8)}...</span>
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(report.generated_date), 'MMM d, yyyy HH:mm')}</span>
                                </p>
                            </div>
                            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                Finalized
                            </span>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            <div className="prose prose-sm max-w-none text-gray-700">
                                <h4 className="font-medium text-gray-900 text-sm">Analysis Summary</h4>
                                <p>{report.analysis_summary}</p>
                            </div>

                            <div className="mt-6 border-t border-gray-100 pt-4">
                                <h4 className="font-medium text-gray-900 text-sm mb-3">Prescribed Medications</h4>
                                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {report.medications_prescribed.map((med, idx) => (
                                        <li key={idx} className="bg-gray-50 rounded p-3 text-sm">
                                            <div className="font-semibold text-teal-700">{med.medication_name}</div>
                                            <div className="text-gray-500">{med.dosage} • {med.frequency}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
