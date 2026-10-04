import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Stethoscope,
    UploadCloud,
    FileText,
    History,
    Menu,
    X,
    LogOut,
    ShieldCheck,
} from 'lucide-react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

const navigation = [
    { name: 'Dashboard',    href: '/',        icon: LayoutDashboard },
    { name: 'New Analysis', href: '/analyze', icon: Stethoscope },
    { name: 'Batch Upload', href: '/batch',   icon: UploadCloud },
    { name: 'Reports',      href: '/reports', icon: FileText },
    { name: 'History',      href: '/history', icon: History },
];

const ROLE_COLORS: Record<string, string> = {
    admin:  'bg-purple-100 text-purple-700',
    doctor: 'bg-teal-100 text-teal-700',
    viewer: 'bg-gray-100 text-gray-600',
};

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
    return (
        <ul role="list" className="-mx-2 space-y-1">
            {navigation.map(item => (
                <li key={item.name}>
                    <NavLink
                        to={item.href}
                        end={item.href === '/'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            clsx(
                                isActive
                                    ? 'bg-gray-50 text-teal-600'
                                    : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50',
                                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                            )
                        }
                    >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {item.name}
                    </NavLink>
                </li>
            ))}
        </ul>
    );
}

function UserPanel({ onLogout }: { onLogout: () => void }) {
    const { user } = useAuth();
    if (!user) return null;

    const initials = user.username.slice(0, 2).toUpperCase();

    return (
        <div className="mt-auto border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                    {initials}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize', ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600')}>
                    <ShieldCheck className="h-3 w-3" />
                    {user.role}
                </span>
                <button
                    onClick={onLogout}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                </button>
            </div>
        </div>
    );
}

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <>
            <div>
                {/* Mobile sidebar */}
                <Transition show={sidebarOpen}>
                    <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
                        <TransitionChild
                            enter="transition-opacity ease-linear duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition-opacity ease-linear duration-300"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-gray-900/80" />
                        </TransitionChild>

                        <div className="fixed inset-0 flex">
                            <TransitionChild
                                enter="transition ease-in-out duration-300 transform"
                                enterFrom="-translate-x-full"
                                enterTo="translate-x-0"
                                leave="transition ease-in-out duration-300 transform"
                                leaveFrom="translate-x-0"
                                leaveTo="-translate-x-full"
                            >
                                <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
                                    <TransitionChild
                                        enter="ease-in-out duration-300"
                                        enterFrom="opacity-0"
                                        enterTo="opacity-100"
                                        leave="ease-in-out duration-300"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                    >
                                        <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                            <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                                <span className="sr-only">Close sidebar</span>
                                                <X className="h-6 w-6 text-white" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </TransitionChild>
                                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                                        <div className="flex h-16 shrink-0 items-center">
                                            <span className="text-2xl font-bold text-teal-600">MediAI</span>
                                        </div>
                                        <nav className="flex flex-1 flex-col">
                                            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                                                <li>
                                                    <NavItems onNavigate={() => setSidebarOpen(false)} />
                                                </li>
                                                <li>
                                                    <UserPanel onLogout={handleLogout} />
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </Dialog>
                </Transition>

                {/* Desktop sidebar */}
                <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
                        <div className="flex h-16 shrink-0 items-center">
                            <span className="text-2xl font-bold text-teal-600">Ifeakandum-AI-Med</span>
                        </div>
                        <nav className="flex flex-1 flex-col">
                            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                                <li>
                                    <NavItems />
                                </li>
                                <li className="mt-auto">
                                    <UserPanel onLogout={handleLogout} />
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>

                <div className="lg:pl-72">
                    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
                        <button
                            type="button"
                            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span className="sr-only">Open sidebar</span>
                            <Menu className="h-6 w-6" aria-hidden="true" />
                        </button>

                        <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

                        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                            <div className="flex flex-1 items-center">
                                <h1 className="text-lg font-semibold text-gray-900">Medical Analysis Platform</h1>
                            </div>
                            {/* Header user badge — visible on desktop */}
                            {user && (
                                <div className="hidden lg:flex items-center gap-x-3">
                                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600')}>
                                        <ShieldCheck className="h-3 w-3" />
                                        {user.role}
                                    </span>
                                    <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                                        {user.username.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{user.username}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <main className="py-10">
                        <div className="px-4 sm:px-6 lg:px-8">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
