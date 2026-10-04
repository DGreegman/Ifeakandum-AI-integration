import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
    children: React.ReactNode;
    requiredRole?: 'admin' | 'doctor' | 'viewer';
}

const ROLE_RANK: Record<string, number> = { viewer: 1, doctor: 2, admin: 3 };

export function ProtectedRoute({ children, requiredRole }: Props) {
    const { user, token } = useAuth();
    const location = useLocation();

    if (!token || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole && (ROLE_RANK[user.role] ?? 0) < (ROLE_RANK[requiredRole] ?? 0)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 text-sm">
                    You need <strong>{requiredRole}</strong> access to view this page.
                    Contact your administrator.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
