import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { UploadCloud, Download, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/axios';
import type { BatchStatus, BatchResult } from '../types';

export const BatchUpload = () => {
    const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    // 1. Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async (fileToUpload: File) => {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            const response = await api.post<{ batch_id: string }>('/upload-analyze-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: (data) => {
            setActiveBatchId(data.batch_id);
        },
        onError: (err) => {
            alert('Upload failed: ' + err);
        }
    });

    // 2. Status Polling
    const statusQuery = useQuery({
        queryKey: ['batchStatus', activeBatchId],
        queryFn: async () => {
            const res = await api.get<BatchStatus>(`/batch-analysis-status/${activeBatchId}`);
            return res.data;
        },
        enabled: !!activeBatchId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return (status === 'completed' || status === 'failed') ? false : 2000;
        }
    });

    // 3. Results Query
    const resultsQuery = useQuery({
        queryKey: ['batchResults', activeBatchId],
        queryFn: async () => {
            const res = await api.get<BatchResult>(`/batch-results/${activeBatchId}`);
            return res.data;
        },
        enabled: statusQuery.data?.status === 'completed'
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (file) uploadMutation.mutate(file);
    };

    const downloadCsv = async () => {
        if (!activeBatchId) return;
        try {
            const response = await api.get(`/batch-analysis-download/${activeBatchId}?fmt=csv`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `batch_${activeBatchId}_results.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">Batch Analysis</h2>
            </div>

            {/* Upload Section */}
            {!activeBatchId && (
                <div className="bg-white shadow sm:rounded-lg p-8 text-center border-2 border-dashed border-gray-300 hover:border-teal-500 transition-colors">
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">Upload CSV File</h3>
                    <p className="mt-1 text-sm text-gray-500">Drag and drop or select a file to analyze bulk records.</p>
                    <div className="mt-6 flex justify-center gap-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-teal-50 file:text-teal-700
                  hover:file:bg-teal-100
                "
                        />
                    </div>
                    {file && (
                        <button
                            onClick={handleUpload}
                            disabled={uploadMutation.isPending}
                            className="mt-4 rounded-md bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                        >
                            {uploadMutation.isPending ? 'Uploading...' : 'Start Processing'}
                        </button>
                    )}
                </div>
            )}

            {/* Progress Section */}
            {activeBatchId && statusQuery.data && (
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-base font-semibold leading-6 text-gray-900">
                                Batch Status: <span className="uppercase">{statusQuery.data.status}</span>
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">ID: {activeBatchId}</p>
                        </div>
                        {statusQuery.data.status === 'processing' && (
                            <div className="flex items-center text-teal-600">
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                Processing...
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                                <div
                                    style={{ width: `${(statusQuery.data.processed_records / statusQuery.data.total_records) * 100}%` }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500 transition-all duration-500"
                                ></div>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Processed: {statusQuery.data.processed_records} / {statusQuery.data.total_records}</span>
                                <span>Errors: {statusQuery.data.errors.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {statusQuery.data?.status === 'completed' && resultsQuery.data && (
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                    <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 flex justify-between items-center">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">Analysis Results</h3>
                        <div className="flex space-x-3">
                            <button
                                onClick={downloadCsv}
                                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                <Download className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                                Download CSV
                            </button>
                            <button
                                onClick={() => { setActiveBatchId(null); setFile(null); }}
                                className="inline-flex items-center rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-800"
                            >
                                New Batch
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Record ID</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Conditions</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Confidence</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Medications</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {resultsQuery.data.results.map((result) => (
                                    <tr key={result.record_id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{result.record_id.slice(0, 8)}...</td>
                                        <td className="px-3 py-4 text-sm text-gray-500">
                                            {result.conditions.slice(0, 2).join(', ')}
                                            {result.conditions.length > 2 && ` +${result.conditions.length - 2} more`}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <span className={clsx(
                                                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                                result.confidence.toLowerCase() === 'high' ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                            )}>
                                                {result.confidence}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 text-sm text-gray-500">
                                            {result.medications.length > 0 ? result.medications[0].medication_name : 'None'}
                                            {result.medications.length > 1 && ` +${result.medications.length - 1}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
