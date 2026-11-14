/**
 * Service quản lý xác thực người dùng qua Firebase Authentication
 * Hỗ trợ tối ưu cho cả Desktop (Popup) lẫn Mobile (Redirect)
 */
import { auth, googleProvider } from "./firebase";
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from "firebase/auth";

/**
 * Kiểm tra xem người dùng có đang truy cập bằng trình duyệt di động hay không
 */
export const isMobileBrowser = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Chuyển đổi mã lỗi Firebase Auth sang thông điệp tiếng Việt thân thiện
 */
export const getFriendlyAuthErrorMessage = (error) => {
    const code = error?.code || "";
    switch (code) {
        case "auth/unauthorized-domain":
            return "Tên miền này chưa được cấp phép trong Firebase Auth. Vui lòng thêm tên miền hiện tại vào Firebase Console > Authentication > Settings > Authorized Domains.";
        case "auth/popup-blocked":
            return "Trình duyệt đã chặn cửa sổ đăng nhập. Đang tự động chuyển hướng...";
        case "auth/popup-closed-by-user":
            return "Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.";
        case "auth/network-request-failed":
            return "Lỗi kết nối mạng khi xác thực. Vui lòng kiểm tra lại đường truyền internet.";
        case "auth/cancelled-popup-request":
            return null;
        default:
            return error?.message || "Đăng nhập thất bại. Vui lòng thử lại sau.";
    }
};

/**
 * Đăng nhập bằng tài khoản Google
 * - Trên Mobile: Sử dụng signInWithRedirect để tránh bị Safari/Chrome chặn popup
 * - Trên Desktop: Dùng signInWithPopup, tự động fallback sang signInWithRedirect nếu popup bị chặn
 */
export const loginWithGoogle = async () => {
    if (isMobileBrowser()) {
        await signInWithRedirect(auth, googleProvider);
        return;
    }

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        if (error?.code === "auth/popup-blocked" || error?.code === "auth/popup-closed-by-user") {
            await signInWithRedirect(auth, googleProvider);
            return;
        }
        throw error;
    }
};

/**
 * Đăng xuất người dùng
 */
export const logoutUser = async () => {
    await firebaseSignOut(auth);
};

/**
 * Lắng nghe thay đổi trạng thái xác thực
 */
export const subscribeToAuthChanges = (callback) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Xử lý kết quả đăng nhập sau khi redirect quay trở lại trang web
 */
export const checkRedirectLoginResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        return result?.user || null;
    } catch (error) {
        console.error("Firebase getRedirectResult error:", error);
        throw error;
    }
};

export const authService = {
    loginWithGoogle,
    logoutUser,
    subscribeToAuthChanges,
    checkRedirectLoginResult,
    isMobileBrowser,
    getFriendlyAuthErrorMessage,
};
