import { createContext, useContext, useState, useEffect, useRef } from "react";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import LoadingSpinner from "../components/LoadingSpinner";
import { vodCache } from "../utils/vodCache";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const isInitialAuth = useRef(true);

    useEffect(() => {
        return onAuthStateChanged(auth, (user) => {
            // Khi người dùng đăng nhập thành công (không phải lần load đầu tiên)
            if (!isInitialAuth.current && user) {
                vodCache.clear();
            }
            isInitialAuth.current = false;
            setCurrentUser(user);
            setLoading(false);
        });
    }, []);

    const value = {
        currentUser,
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
