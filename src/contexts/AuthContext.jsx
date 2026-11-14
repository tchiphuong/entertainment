import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
    subscribeToAuthChanges,
    checkRedirectLoginResult,
    loginWithGoogle,
    logoutUser,
    getFriendlyAuthErrorMessage,
} from "../services/authService";
import LoadingSpinner from "../components/LoadingSpinner";
import { vodCache } from "../utils/vodCache";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const isInitialAuth = useRef(true);

    useEffect(() => {
        // Kiểm tra kết quả trả về sau khi redirect xác thực trên mobile
        checkRedirectLoginResult()
            .then((user) => {
                if (user) {
                    vodCache.clear();
                    setCurrentUser(user);
                }
            })
            .catch((err) => {
                const msg = getFriendlyAuthErrorMessage(err);
                if (msg) setAuthError(msg);
            });

        const unsubscribe = subscribeToAuthChanges((user) => {
            // Khi người dùng đăng nhập thành công (không phải lần load đầu tiên)
            if (!isInitialAuth.current && user) {
                vodCache.clear();
            }
            isInitialAuth.current = false;
            setCurrentUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = useCallback(async () => {
        setAuthError(null);
        try {
            await loginWithGoogle();
            vodCache.clear();
        } catch (error) {
            const msg = getFriendlyAuthErrorMessage(error);
            if (msg) {
                setAuthError(msg);
                if (error?.code === "auth/unauthorized-domain") {
                    window.alert(msg);
                }
            }
            console.error("Login error:", error);
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        setAuthError(null);
        try {
            await logoutUser();
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    }, []);

    const value = {
        currentUser,
        authError,
        setAuthError,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="flex h-screen items-center justify-center">
                    <LoadingSpinner />
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
