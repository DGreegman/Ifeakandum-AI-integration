import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { UploadCloud, Download, RefreshCw, ClipboardList, CheckCircle2, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/axios';
import type { BatchStatus, BatchResult } from '../types';

interface BatchSummary {
    batch_id: string;
    status: string;
    total_records: number;
    processed_records: number;
    errors: string[];
    created_at: string;
    completed_at: string | null;
}

export const BatchUpload = () => {
    const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);

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
            batchListQuery.refetch();
        },
        onError: (err) => {
            alert('Upload failed: ' + err);
        }
    });

    // 2. Status Polling for active batch
    const statusQuery = useQuery({
        queryKey: ['batchStatus', activeBatchId],
        queryFn: async () => {
            const res = await api.get<BatchStatus>(`/batch-analysis-status/${activeBatchId}`);
            return res.data;
        },
        enabled: !!activeBatchId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === 'completed' || status === 'failed') {
                batchListQuery.refetch();
                return false;
            }
            return 2000;
        }
    });

    // 3. Results for active batch (shown once completed)
    const resultsQuery = useQuery({
        queryKey: ['batchResults', activeBatchId],
        queryFn: async () => {
            const res = await api.get<BatchResult>(`/batch-results/${activeBatchId}`);
            return res.data;
        },
        enabled: statusQuery.data?.status === 'completed'
    });

    // 4. All past batches list
    const batchListQuery = useQuery({
        queryKey: ['batches'],
        queryFn: async () => {
            const res = await api.get<BatchSummary[]>('/batches');
            return res.data;
        }
    });

    // 5. Results for a historic batch the user clicked
    const historicResultsQuery = useQuery({
        queryKey: ['batchResults', viewingBatchId],
        queryFn: async () => {
            const res = await api.get<BatchResult>(`/batch-results/${viewingBatchId}`);
            return res.data;
        },
        enabled: !!viewingBatchId
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (file) uploadMutation.mutate(file);
    };

    const downloadCsv = async (batchId: string) => {
        try {
            const response = await api.get(`/batch-analysis-download/${batchId}?fmt=csv`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `batch_${batchId}_results.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const map: Record<string, { icon: React.ReactNode; cls: string }> = {
            completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-green-50 text-green-700 ring-green-600/20' },
            processing: { icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />, cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
            failed: { icon: <XCircle className="h-3.5 w-3.5" />, cls: 'bg-red-50 text-red-700 ring-red-600/20' },
            pending: { icon: <Clock className="h-3.5 w-3.5" />, cls: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' },
        };
        const { icon, cls } = map[status] ?? map['pending'];
        return (
            <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset', cls)}>
                {icon} {status}
            </span>
        );
    };

    const ResultsTable = ({ results }: { results: BatchResult['results'] }) => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Record</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Conditions</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Confidence</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Medications</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {results.map((result, idx) => (
                        <tr key={result.record_id ?? idx}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                #{idx + 1}
                            </td>
                            <td className="px-3 py-4 text-sm text-gray-500">
                                {(result.conditions ?? []).slice(0, 2).join(', ')}
                                {(result.conditions ?? []).length > 2 && ` +${result.conditions.length - 2} more`}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <span className={clsx(
                                    "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                    (result.confidence ?? '').toLowerCase() === 'high'
                                        ? "bg-green-50 text-green-700 ring-green-600/20"
                                        : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                )}>
                                    {result.confidence ?? 'N/A'}
                                </span>
                            </td>
                            <td className="px-3 py-4 text-sm text-gray-500">
                                {(result.medications ?? []).length > 0
                                    ? result.medications[0].medication_name
                                    : 'None'}
                                {(result.medications ?? []).length > 1 && ` +${result.medications.length - 1}`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">Batch Analysis</h2>
                {activeBatchId && (
                    <button
                        onClick={() => { setActiveBatchId(null); setFile(null); setViewingBatchId(null); }}
                        className="mt-2 md:mt-0 inline-flex items-center rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-800"
                    >
                        + New Batch
                    </button>
                )}
            </div>

            {/* Upload Section — shown when no active batch */}
            {!activeBatchId && (
                <div className="bg-white shadow sm:rounded-lg p-8 text-center border-2 border-dashed border-gray-300 hover:border-teal-500 transition-colors">
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">Upload CSV or JSON File</h3>
                    <p className="mt-1 text-sm text-gray-500">Select a CSV or JSON file to analyze multiple patient records at once.</p>
                    <div className="mt-6 flex justify-center gap-4">
                        <input
                            type="file"
                            accept=".csv, .json"
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

            {/* Active Batch Progress */}
            {activeBatchId && statusQuery.data && (
                <div className="bg-white shadow sm:rounded-lg p-6">
                    <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-base font-semibold leading-6 text-gray-900">
                                Current Batch &nbsp;<StatusBadge status={statusQuery.data.status} />
                            </h3>
                            <p className="mt-1 text-xs text-gray-400 font-mono">{activeBatchId}</p>
                        </div>
                        {statusQuery.data.status === 'completed' && (
                            <button
                                onClick={() => downloadCsv(activeBatchId)}
                                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                <Download className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
                                Download CSV
                            </button>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-6">
                        <div className="overflow-hidden h-2 mb-3 text-xs flex rounded bg-gray-200">
                            <div
                                style={{ width: `${Math.round((statusQuery.data.processed_records / statusQuery.data.total_records) * 100)}%` }}
                                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500 transition-all duration-500"
                            />
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mb-3">
                            <span>Processed: {statusQuery.data.processed_records} / {statusQuery.data.total_records}</span>
                            <span className={(statusQuery.data.errors ?? []).length > 0 ? 'text-red-600 font-medium' : ''}>
                                Errors: {(statusQuery.data.errors ?? []).length}
                            </span>
                        </div>

                        {/* Row-level error details */}
                        {(statusQuery.data.errors ?? []).length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Failed Rows</p>
                                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-red-200 bg-red-50 p-3">
                                    {(statusQuery.data.errors ?? []).map((err, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                                            <span className="mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full bg-red-200 text-red-800 w-4 h-4 font-bold text-[10px]">
                                                {i + 1}
                                            </span>
                                            <span className="break-all">{err}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results table for current batch */}
                    {statusQuery.data.status === 'completed' && resultsQuery.data && (resultsQuery.data.results ?? []).length > 0 && (
                        <div className="mt-6 border-t pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                ✅ {resultsQuery.data.successful_analyses} records analysed successfully
                            </h4>
                            <ResultsTable results={resultsQuery.data.results ?? []} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Past Batches History ────────────────────────────────── */}
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    <h3 className="text-base font-semibold text-gray-900">Batch History</h3>
                </div>

                {batchListQuery.isLoading && (
                    <div className="p-6 text-sm text-gray-400">Loading past batches…</div>
                )}

                {!batchListQuery.isLoading && (batchListQuery.data ?? []).length === 0 && (
                    <div className="p-6 text-sm text-gray-400">No batches yet — upload a CSV to get started.</div>
                )}

                {(batchListQuery.data ?? []).length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 pl-6 text-left text-xs font-semibold text-gray-500 uppercase">Batch ID</th>
                                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Records</th>
                                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {(batchListQuery.data ?? []).map((batch) => (
                                <React.Fragment key={batch.batch_id}>
                                    <tr className={clsx(viewingBatchId === batch.batch_id && 'bg-teal-50')}>
                                        <td className="py-3 pl-6 text-xs font-mono text-gray-500">{batch.batch_id.slice(0, 12)}…</td>
                                        <td className="py-3 px-3"><StatusBadge status={batch.status} /></td>
                                        <td className="py-3 px-3 text-sm text-gray-700">
                                            {batch.processed_records}/{batch.total_records}
                                            {batch.errors?.length > 0 && (
                                                <span className="ml-1 text-red-500 text-xs">({batch.errors.length} err)</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-xs text-gray-400">
                                            {new Date(batch.created_at).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 flex gap-2">
                                            {batch.status === 'completed' && (
                                                <>
                                                    <button
                                                        onClick={() => setViewingBatchId(viewingBatchId === batch.batch_id ? null : batch.batch_id)}
                                                        className="text-teal-700 hover:underline text-xs font-semibold cursor-pointer"
                                                    >
                                                        {viewingBatchId === batch.batch_id ? 'Hide' : 'View Results'}
                                                    </button>
                                                    <button
                                                        onClick={() => downloadCsv(batch.batch_id)}
                                                        className="text-gray-500 hover:underline text-xs cursor-pointer"
                                                    >
                                                        Download
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                    {/* Expandable results row */}
                                    {viewingBatchId === batch.batch_id && (
                                        <tr>
                                            <td colSpan={5} className="bg-gray-50 px-6 py-4">
                                                {historicResultsQuery.isLoading && <p className="text-sm text-gray-400">Loading results…</p>}
                                                {historicResultsQuery.data && (historicResultsQuery.data.results ?? []).length === 0 && (
                                                    <p className="text-sm text-gray-400">No successful analyses for this batch.</p>
                                                )}
                                                {historicResultsQuery.data && (historicResultsQuery.data.results ?? []).length > 0 && (
                                                    <ResultsTable results={historicResultsQuery.data.results} />
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
