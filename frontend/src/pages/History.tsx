import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Activity, Calendar, ChevronDown, ChevronUp, FlaskConical, BookOpen, Printer } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/axios';
import type { AnalysisResult } from '../types';
import { format } from 'date-fns';

// ─── Expandable medication card ───────────────────────────────────────────────

const MedCard = ({ med }: { med: AnalysisResult['recommended_medications'][number] }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 text-sm">{med.medication_name}</span>
                    <span className="text-gray-500 text-sm">{med.dosage}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {med.confidence_score !== undefined && (
                        <span className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            med.confidence_score >= 0.8 ? 'bg-green-100 text-green-800' :
                            med.confidence_score >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        )}>
                            {Math.round(med.confidence_score * 100)}%
                        </span>
                    )}
                    {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
            </button>
            {open && (
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm border-t border-gray-200 bg-white">
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
                    {med.contraindications && med.contraindications.length > 0 && (
                        <div className="sm:col-span-3">
                            <span className="block text-xs font-medium text-red-600 uppercase tracking-wider mb-1">⚠ Contraindications</span>
                            <div className="flex flex-wrap gap-1">
                                {med.contraindications.map((c, i) => (
                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-700">{c}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {med.side_effects && med.side_effects.length > 0 && (
                        <div className="sm:col-span-3">
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
    );
};

const confidenceBadge = (level: string) => {
    const map: Record<string, string> = {
        high:   'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        low:    'bg-red-100 text-red-800',
    };
    return map[level?.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
};

// ─── Print helper ────────────────────────────────────────────────────────────

const printRecord = (analysis: AnalysisResult, patientId: string) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const date = format(new Date(analysis.analysis_date), 'MMM d, yyyy HH:mm');

    const medsHtml = analysis.recommended_medications
        .map(med => `
            <div class="med-card">
                <div class="med-header">
                    <span class="med-name">${med.medication_name}</span>
                    <span class="med-dosage">${med.dosage}</span>
                    ${med.confidence_score !== undefined ? `<span class="badge confidence">${Math.round(med.confidence_score * 100)}% confidence</span>` : ''}
                </div>
                <div class="med-grid">
                    <div><span class="label">Frequency</span><span>${med.frequency}</span></div>
                    ${med.duration ? `<div><span class="label">Duration</span><span>${med.duration}</span></div>` : ''}
                    ${med.instructions ? `<div><span class="label">Instructions</span><span>${med.instructions}</span></div>` : ''}
                </div>
                ${med.contraindications && med.contraindications.length > 0 ? `
                    <div class="tags-row"><span class="label red">⚠ Contraindications</span>
                    ${med.contraindications.map(c => `<span class="tag red">${c}</span>`).join('')}</div>` : ''}
                ${med.side_effects && med.side_effects.length > 0 ? `
                    <div class="tags-row"><span class="label orange">Side Effects</span>
                    ${med.side_effects.map(s => `<span class="tag orange">${s}</span>`).join('')}</div>` : ''}
            </div>`).join('');

    const testsHtml = analysis.additional_tests && analysis.additional_tests.length > 0
        ? `<ul>${analysis.additional_tests.map(t => `<li>${t}</li>`).join('')}</ul>` : '';

    const riskHtml = analysis.risk_factors && analysis.risk_factors.length > 0
        ? analysis.risk_factors.map(r => `<span class="tag red">${r}</span>`).join('')
        : '<em>None identified</em>';

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Analysis Report – ${patientId} – ${date}</title>
        <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;padding:32px 40px;max-width:820px;margin:0 auto}
            h1{font-size:20px;font-weight:700;margin-bottom:4px;color:#0f766e}
            .meta{font-size:12px;color:#555;margin-bottom:20px;display:flex;gap:16px;align-items:center}
            .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
            .badge.confidence{background:#dcfce7;color:#166534}
            .section{margin-bottom:20px}
            .section h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
            .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
            ul{padding-left:18px;line-height:1.8}
            .tags-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
            .tag{display:inline-flex;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
            .tag.red{background:#fef2f2;color:#b91c1c}
            .tag.orange{background:#fff7ed;color:#c2410c}
            .label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:2px}
            .label.red{color:#dc2626}
            .label.orange{color:#ea580c}
            .med-card{border:1px solid #e5e7eb;border-radius:6px;margin-bottom:10px;overflow:hidden}
            .med-header{background:#f9fafb;padding:10px 12px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #e5e7eb}
            .med-name{font-weight:600;font-size:13px}
            .med-dosage{color:#555;font-size:12px}
            .med-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px 12px}
            .notes{background:#f9fafb;border-radius:6px;padding:12px;white-space:pre-line;line-height:1.7;font-size:12px}
            @media print{body{padding:20px}}
        </style>
    </head><body>
        <h1>Patient Analysis Report</h1>
        <div class="meta">
            <span>Patient ID: <strong>${patientId}</strong></span>
            <span>Date: <strong>${date}</strong></span>
            <span class="badge" style="background:${analysis.confidence_level === 'high' ? '#dcfce7' : '#fef9c3'};color:${analysis.confidence_level === 'high' ? '#166534' : '#854d0e'}">${analysis.confidence_level.toUpperCase()} Confidence</span>
        </div>
        <div class="grid2">
            <div class="section">
                <h2>Suspected Conditions</h2>
                <ul>${analysis.suspected_conditions.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
            <div class="section">
                <h2>Risk Factors</h2>
                <div class="tags-row">${riskHtml}</div>
            </div>
        </div>
        ${analysis.additional_tests && analysis.additional_tests.length > 0 ? `<div class="section"><h2>Additional Tests Recommended</h2>${testsHtml}</div>` : ''}
        ${analysis.recommended_medications && analysis.recommended_medications.length > 0 ? `<div class="section"><h2>Recommended Medications</h2>${medsHtml}</div>` : ''}
        ${analysis.treatment_notes ? `<div class="section"><h2>Treatment Notes</h2><div class="notes">${analysis.treatment_notes}</div></div>` : ''}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
};

const printAll = (analyses: AnalysisResult[], patientId: string) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const allHtml = analyses.map((analysis, idx) => {
        const date = format(new Date(analysis.analysis_date), 'MMM d, yyyy HH:mm');
        const riskHtml = analysis.risk_factors && analysis.risk_factors.length > 0
            ? analysis.risk_factors.map(r => `<span class="tag red">${r}</span>`).join('')
            : '<em>None identified</em>';
        const medsHtml = analysis.recommended_medications
            .map(med => `
                <div class="med-card">
                    <div class="med-header">
                        <span class="med-name">${med.medication_name}</span>
                        <span class="med-dosage">${med.dosage}</span>
                    </div>
                    <div class="med-grid">
                        <div><span class="label">Frequency</span><span>${med.frequency}</span></div>
                        ${med.duration ? `<div><span class="label">Duration</span><span>${med.duration}</span></div>` : ''}
                        ${med.instructions ? `<div><span class="label">Instructions</span><span>${med.instructions}</span></div>` : ''}
                    </div>
                </div>`).join('');
        return `
            ${idx > 0 ? '<div class="page-break"></div>' : ''}
            <div class="record">
                <h2>Record #${idx + 1} &mdash; ${date}
                    <span class="badge" style="float:right;background:${analysis.confidence_level === 'high' ? '#dcfce7' : '#fef9c3'};color:${analysis.confidence_level === 'high' ? '#166534' : '#854d0e'}">${analysis.confidence_level.toUpperCase()} Confidence</span>
                </h2>
                <div class="grid2">
                    <div class="section"><h3>Suspected Conditions</h3><ul>${analysis.suspected_conditions.map(c => `<li>${c}</li>`).join('')}</ul></div>
                    <div class="section"><h3>Risk Factors</h3><div class="tags-row">${riskHtml}</div></div>
                </div>
                ${analysis.additional_tests && analysis.additional_tests.length > 0 ? `<div class="section"><h3>Additional Tests</h3><ul>${analysis.additional_tests.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
                ${medsHtml ? `<div class="section"><h3>Medications</h3>${medsHtml}</div>` : ''}
                ${analysis.treatment_notes ? `<div class="section"><h3>Treatment Notes</h3><div class="notes">${analysis.treatment_notes}</div></div>` : ''}
            </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Full History – ${patientId}</title>
        <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;padding:32px 40px;max-width:820px;margin:0 auto}
            h1{font-size:20px;font-weight:700;margin-bottom:4px;color:#0f766e}
            h2{font-size:15px;font-weight:700;margin-bottom:12px;color:#111;display:flex;align-items:center;gap:8px}
            h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
            .meta{font-size:12px;color:#555;margin-bottom:24px}
            .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
            .record{margin-bottom:32px}
            .section{margin-bottom:14px}
            .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
            ul{padding-left:18px;line-height:1.8}
            .tags-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
            .tag{display:inline-flex;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
            .tag.red{background:#fef2f2;color:#b91c1c}
            .label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:2px}
            .med-card{border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;overflow:hidden}
            .med-header{background:#f9fafb;padding:8px 12px;display:flex;gap:10px;border-bottom:1px solid #e5e7eb}
            .med-name{font-weight:600}
            .med-dosage{color:#555;font-size:12px}
            .med-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 12px}
            .notes{background:#f9fafb;border-radius:6px;padding:10px;white-space:pre-line;line-height:1.7;font-size:12px}
            .page-break{page-break-before:always;padding-top:24px;border-top:2px solid #e5e7eb;margin-top:8px}
            @media print{.page-break{page-break-before:always}}
        </style>
    </head><body>
        <h1>Patient History Report</h1>
        <div class="meta">Patient ID: <strong>${patientId}</strong> &nbsp;|&nbsp; Total Records: <strong>${analyses.length}</strong></div>
        ${allHtml}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const History = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const paramPatientId = searchParams.get('patient') ?? '';

    const [patientId, setPatientId] = useState(paramPatientId);
    const [searchId, setSearchId] = useState(paramPatientId); // auto-search if param present

    // If the user navigates here again with a different patient param, re-trigger
    useEffect(() => {
        if (paramPatientId && paramPatientId !== searchId) {
            setPatientId(paramPatientId);
            setSearchId(paramPatientId);
        }
    }, [paramPatientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const { data: analyses, isLoading, error } = useQuery({
        queryKey: ['patientHistory', searchId],
        queryFn: async () => {
            const res = await api.get<AnalysisResult[]>(`/analysis-result/${searchId}`);
            return res.data;
        },
        enabled: !!searchId,
        retry: false,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchId(patientId);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold leading-7 text-gray-900">Patient History</h2>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mt-3 md:mt-0 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-teal-700 transition-colors cursor-pointer"
                >
                    <span aria-hidden="true">←</span> Back to Dashboard
                </button>
            </div>

            {/* Search bar */}
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
                            onChange={e => setPatientId(e.target.value)}
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

            {/* Print All */}
            {analyses && analyses.length > 0 && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => printAll(analyses, searchId)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-teal-700 transition-colors"
                    >
                        <Printer className="h-4 w-4" />
                        Print All Records
                    </button>
                </div>
            )}

            {/* Results */}
            <div className="space-y-6">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading history...</div>}

                {error && (
                    <div className="text-center py-10 text-gray-500">No history found for this patient.</div>
                )}

                {analyses?.map((analysis, idx) => (
                    <div key={idx} className="bg-white shadow sm:rounded-lg overflow-hidden border-l-4 border-indigo-500">
                        {/* Card Header */}
                        <div className="px-4 py-4 sm:px-6 bg-gray-50 flex flex-wrap justify-between items-center gap-2">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                Analysis Record
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className={clsx(
                                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                                    confidenceBadge(analysis.confidence_level)
                                )}>
                                    {analysis.confidence_level} confidence
                                </span>
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(analysis.analysis_date), 'MMM d, yyyy HH:mm')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => printRecord(analysis, searchId)}
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-teal-700 transition-colors"
                                    title="Print / Export PDF"
                                >
                                    <Printer className="h-4 w-4" />
                                    <span className="hidden sm:inline">Print</span>
                                </button>
                            </div>
                        </div>

                        <div className="px-4 py-5 sm:p-6 space-y-6">
                            {/* Conditions + Risk Factors */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Suspected Conditions</h4>
                                    <ul className="list-disc pl-5 text-sm text-gray-900 space-y-0.5">
                                        {analysis.suspected_conditions.map((c, i) => <li key={i}>{c}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Risk Factors</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.risk_factors?.map((r, i) => (
                                            <span key={i} className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                                {r}
                                            </span>
                                        ))}
                                        {(!analysis.risk_factors || analysis.risk_factors.length === 0) && (
                                            <span className="text-sm text-gray-400 italic">None identified</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recommended Medications */}
                            {analysis.recommended_medications && analysis.recommended_medications.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        <BookOpen className="h-4 w-4" /> Recommended Medications
                                    </h4>
                                    <div className="space-y-2">
                                        {analysis.recommended_medications.map((med, i) => (
                                            <MedCard key={i} med={med} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Additional Tests */}
                            {analysis.additional_tests && analysis.additional_tests.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <FlaskConical className="h-4 w-4" /> Additional Tests Recommended
                                    </h4>
                                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
                                        {analysis.additional_tests.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Treatment Notes */}
                            {analysis.treatment_notes && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Treatment Notes</h4>
                                    <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.treatment_notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
