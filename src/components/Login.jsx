import React from "react";
import { auth, googleProvider } from "../services/firebase";
import { signInWithPopup } from "firebase/auth";

export default function Login() {
    const handleGoogleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Lỗi khi đăng nhập bằng Google:", error);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
            <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
                <h1 className="mb-4 text-2xl font-bold text-gray-800">
                    Chào mừng bạn!
                </h1>
                <p className="mb-6 text-gray-600">
                    Vui lòng đăng nhập để tiếp tục và khám phá thế giới phim
                    ảnh.
                </p>
                <button
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                    <svg
                        className="h-5 w-5"
                        aria-hidden="true"
                        focusable="false"
                        data-prefix="fab"
                        data-icon="google"
                        role="img"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 488 512"
                    >
                        <path
                            fill="currentColor"
                            d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73.2 0 136.2 29.3 182.4 75.4l-62.4 60.3C337.2 114.6 295.6 96 244 96c-88.6 0-160.1 71.1-160.1 160s71.5 160 160.1 160c97.4 0 134-60.5 138.5-93.2H244v-74.4h239.9c2.4 12.6 3.6 25.8 3.6 40.2z"
                        ></path>
                    </svg>
                    <span>Đăng nhập với Google</span>
                </button>
            </div>
        </div>
    );
}
