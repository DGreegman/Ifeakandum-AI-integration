import { Link } from 'react-router-dom';
import {
    Users,
    Activity,
    FileText,
    ArrowUpRight,
    Plus,
    Upload
} from 'lucide-react';
import clsx from 'clsx';


const stats = [
    { name: 'Total Patients Analyzed', value: '1,248', icon: Users, change: '+12%', changeType: 'increase' },
    { name: 'Analyses Today', value: '24', icon: Activity, change: '+4.75%', changeType: 'increase' },
    { name: 'Reports Generated', value: '86', icon: FileText, change: '-1.3%', changeType: 'decrease' },
];

const activity = [
    { id: 1, type: 'analysis', person: 'Sarah Conner', date: '1h ago', status: 'Completed', result: 'Hypertension Risk' },
    { id: 2, type: 'batch', person: 'Batch #402', date: '3h ago', status: 'Processing', result: '45/100 Records' },
    { id: 3, type: 'report', person: 'John Doe', date: '5h ago', status: 'Sent', result: 'Dr. Smith' },
    { id: 4, type: 'analysis', person: 'Emily Blunt', date: '1d ago', status: 'Completed', result: 'Healthy' },
];

export const Dashboard = () => {
    return (
        <div>
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
                        className="ml-3 inline-flex items-center rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                    >
                        <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                        New Analysis
                    </Link>
                </div>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((item) => (
                    <div
                        key={item.name}
                        className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
                    >
                        <dt>
                            <div className="absolute rounded-md bg-teal-500 p-3">
                                <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                            </div>
                            <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
                        </dt>
                        <dd className="ml-16 flex items-baseline pb-1 sm:pb-7">
                            <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
                            <p
                                className={clsx(
                                    item.changeType === 'increase' ? 'text-green-600' : 'text-red-600',
                                    'ml-2 flex items-baseline text-sm font-semibold'
                                )}
                            >
                                {item.changeType === 'increase' ? (
                                    <ArrowUpRight className="h-4 w-4 shrink-0 self-center text-green-500" aria-hidden="true" />
                                ) : (
                                    <ArrowUpRight className="h-4 w-4 shrink-0 self-center text-red-500 rotate-90" aria-hidden="true" />
                                )}
                                <span className="sr-only"> {item.changeType === 'increase' ? 'Increased' : 'Decreased'} by </span>
                                {item.change}
                            </p>
                        </dd>
                    </div>
                ))}
            </dl>

            <div className="mt-8">
                <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Activity</h3>
                <div className="mt-4 flow-root">
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                                Subject
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Type
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Result/Status
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {activity.map((item) => (
                                            <tr key={item.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                    {item.person}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {item.type === 'analysis' && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Analysis</span>}
                                                    {item.type === 'batch' && <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Batch</span>}
                                                    {item.type === 'report' && <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">Report</span>}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.result}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.date}</td>
                                            </tr>
                                        ))}
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
