const GUEST_NAME_KEY = "wp_guest_name";
const GUEST_ID_KEY = "wp_guest_uid";

// Bộ nhớ cache singleton đảm bảo UID và tên không bao giờ bị đổi giữa các lần gọi
let memoryGuestUid = null;
let memoryGuestName = null;

const generateGuestId = () => {
    return `guest_${Math.random().toString(36).substring(2, 9)}`;
};

const generateDefaultGuestName = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `Khách #${randomSuffix}`;
};

const safeSessionGet = (key) => {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeSessionSet = (key, value) => {
    try {
        sessionStorage.setItem(key, value);
    } catch {}
};

/**
 * Lấy thông tin tài khoản khách ẩn danh từ sessionStorage riêng biệt của từng tab
 * Đảm bảo mỗi tab mở ra là một người dùng độc lập, không bị đè chéo quyền Host
 * @returns {{ uid: string, displayName: string, photoURL: string, isGuest: boolean }}
 */
export const getGuestProfile = () => {
    if (!memoryGuestUid) {
        memoryGuestUid = safeSessionGet(GUEST_ID_KEY);
        if (!memoryGuestUid) {
            memoryGuestUid = generateGuestId();
            safeSessionSet(GUEST_ID_KEY, memoryGuestUid);
        }
    }

    if (!memoryGuestName) {
        memoryGuestName = safeSessionGet(GUEST_NAME_KEY);
        if (!memoryGuestName?.trim()) {
            memoryGuestName = generateDefaultGuestName();
            safeSessionSet(GUEST_NAME_KEY, memoryGuestName);
        }
    }

    return {
        uid: memoryGuestUid,
        displayName: memoryGuestName.trim(),
        photoURL: "",
        isGuest: true,
    };
};

/**
 * Lưu hoặc đổi tên hiển thị của khách
 * @param {string} newName - Tên mới muốn đặt
 * @returns {string} Tên đã được làm sạch và lưu
 */
export const setGuestName = (newName) => {
    const cleanName = (newName || "").trim().substring(0, 30);
    if (!cleanName) return "";

    memoryGuestName = cleanName;
    safeSessionSet(GUEST_NAME_KEY, cleanName);
    return cleanName;
};
