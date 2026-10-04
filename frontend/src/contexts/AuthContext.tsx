import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/axios';

export interface AuthUser {
    id: number;
    email: string;
    username: string;
    role: 'admin' | 'doctor' | 'viewer';
    is_active: boolean;
    created_at: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'medi_ai_token';
const USER_KEY  = 'medi_ai_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken]     = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser]       = useState<AuthUser | null>(() => {
        const stored = localStorage.getItem(USER_KEY);
        return stored ? JSON.parse(stored) : null;
    });
    const [isLoading, setIsLoading] = useState(false);

    // Verify the stored token is still valid on first mount
    useEffect(() => {
        if (!token) return;
        api.get<AuthUser>('/auth/me')
            .then(res => {
                setUser(res.data);
                localStorage.setItem(USER_KEY, JSON.stringify(res.data));
            })
            .catch(() => {
                // Token expired or invalid — clear auth state
                logout();
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const res = await api.post<{ access_token: string; user: AuthUser }>('/auth/login', {
                email,
                password,
            });
            const { access_token, user: authUser } = res.data;
            setToken(access_token);
            setUser(authUser);
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
