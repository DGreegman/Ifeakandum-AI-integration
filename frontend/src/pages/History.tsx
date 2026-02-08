import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Activity, Calendar } from 'lucide-react';
import api from '../lib/axios';
import type { AnalysisResult } from '../types';
import { format } from 'date-fns';

export const History = () => {
    const [patientId, setPatientId] = useState('');
    const [searchId, setSearchId] = useState('');

    const { data: analyses, isLoading, error } = useQuery({
        queryKey: ['patientHistory', searchId],
        queryFn: async () => {
            // The API returns List[AnalysisResult]
            const res = await api.get<AnalysisResult[]>(`/analysis-result/${searchId}`);
            return res.data;
        },
        enabled: !!searchId,
        retry: false
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchId(patientId);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">Patient History</h2>
            </div>

            <div className="bg-white shadow sm:rounded-lg p-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-grow">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                            placeholder="Enter Patient ID to view history..."
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

            <div className="space-y-4">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading history...</div>}

                {error && (
                    <div className="text-center py-10 text-gray-500">
                        {/* Only show error if search was attempted */}
                        No history found for this patient.
                    </div>
                )}

                {analyses?.map((analysis, idx) => (
                    <div key={idx} className="bg-white shadow sm:rounded-lg overflow-hidden border-l-4 border-indigo-500 mb-4">
                        <div className="px-4 py-5 sm:px-6 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                Analysis Record
                            </h3>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(analysis.analysis_date), 'MMM d, yyyy HH:mm')}
                            </span>
                        </div>
                        <div className="px-4 py-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-medium text-gray-500">Suspected Conditions</h4>
                                <ul className="mt-2 list-disc pl-5 text-sm text-gray-900">
                                    {analysis.suspected_conditions.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-500">Risk Factors</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {analysis.risk_factors?.map((r, i) => (
                                        <span key={i} className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
