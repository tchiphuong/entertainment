import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import LoadingSpinner from "../components/LoadingSpinner";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        return onAuthStateChanged(auth, (user) => {
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
