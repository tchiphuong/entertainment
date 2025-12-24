import React from "react";
import { useAuth } from "../contexts/AuthContext";
import Login from "./Login";

export default function PrivateRoute({ children }) {
    const { currentUser } = useAuth();

    // Nếu có người dùng đăng nhập, hiển thị component con (Vods)
    // Nếu không, hiển thị trang đăng nhập
    return currentUser ? children : <Login />;
}
