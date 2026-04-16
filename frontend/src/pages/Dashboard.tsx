import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Activity, FileText, Plus, Upload, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/axios';
import type { DashboardStats, RecentActivity } from '../types';

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

const StatSkeleton = () => (
    <div className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6 animate-pulse">
        <div className="absolute rounded-md bg-gray-200 p-3 h-12 w-12" />
        <div className="ml-16 h-4 bg-gray-200 rounded w-40 mb-3" />
        <div className="ml-16 h-8 bg-gray-200 rounded w-20" />
    </div>
);

const RowSkeleton = () => (
    <tr>
        {[1, 2, 3, 4].map(i => (
            <td key={i} className="px-3 py-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
            </td>
        ))}
    </tr>
);

// ─── Config ───────────────────────────────────────────────────────────────────

const STAT_CONFIG = [
    { key: 'total_patients',    label: 'Total Patients Analyzed', icon: Users,    color: 'bg-teal-500' },
    { key: 'analyses_today',    label: 'Analyses Today',          icon: Activity, color: 'bg-indigo-500' },
    { key: 'reports_generated', label: 'Reports Generated',       icon: FileText, color: 'bg-purple-500' },
] as const;

const confidenceBadge = (level: string) => {
    const map: Record<string, string> = {
        high:   'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        low:    'bg-red-100 text-red-800',
    };
    return map[level?.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Dashboard = () => {
    const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
        queryKey: ['dashboardStats'],
        queryFn: async () => (await api.get<DashboardStats>('/stats')).data,
        refetchInterval: 30_000,
    });

    const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
        queryKey: ['recentActivity'],
        queryFn: async () => (await api.get<RecentActivity[]>('/recent-activity')).data,
        refetchInterval: 30_000,
    });

    return (
        <div>
            {/* Header */}
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Dashboard
                    </h2>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <Link
                        to="/batch"
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        <Upload className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Upload Batch
                    </Link>
                    <Link
                        to="/analyze"
                        className="ml-3 inline-flex items-center rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-800"
                    >
                        <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                        New Analysis
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {statsLoading
                    ? [1, 2, 3].map(i => <StatSkeleton key={i} />)
                    : STAT_CONFIG.map(({ key, label, icon: Icon, color }) => (
                        <div
                            key={key}
                            className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
                        >
                            <dt>
                                <div className={`absolute rounded-md ${color} p-3`}>
                                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                                </div>
                                <p className="ml-16 truncate text-sm font-medium text-gray-500">{label}</p>
                            </dt>
                            <dd className="ml-16 flex items-baseline pb-1 sm:pb-7">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stats?.[key]?.toLocaleString() ?? '—'}
                                </p>
                                <span className="ml-2 flex items-center text-xs text-gray-400">
                                    <ArrowUpRight className="h-3 w-3 mr-0.5 text-green-500" />
                                    live
                                </span>
                            </dd>
                        </div>
                    ))}
            </dl>

            {/* Recent Activity */}
            <div className="mt-8">
                <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Activity</h3>
                <div className="mt-4 flow-root">
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Patient</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Top Condition</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Confidence</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {activityLoading
                                            ? [1, 2, 3].map(i => <RowSkeleton key={i} />)
                                            : activity && activity.length > 0
                                                ? activity.map(item => (
                                                    <tr
                                                        key={item.analysis_id}
                                                        className="cursor-pointer hover:bg-teal-50 transition-colors"
                                                    >
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                            <Link
                                                                to={`/history?patient=${item.patient_id}`}
                                                                className="hover:text-teal-700 hover:underline block"
                                                            >
                                                                {item.patient_name}
                                                            </Link>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                                            <Link to={`/history?patient=${item.patient_id}`} className="block">
                                                                {item.top_condition}
                                                            </Link>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                            <Link to={`/history?patient=${item.patient_id}`} className="block">
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${confidenceBadge(item.confidence_level)}`}>
                                                                    {item.confidence_level}
                                                                </span>
                                                            </Link>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <Link to={`/history?patient=${item.patient_id}`} className="block">
                                                                {format(new Date(item.analysis_date), 'MMM d, HH:mm')}
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                                : (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                                                            No analyses recorded yet.{' '}
                                                            <Link to="/analyze" className="text-teal-600 font-medium hover:underline">
                                                                Run your first analysis →
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                )
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
