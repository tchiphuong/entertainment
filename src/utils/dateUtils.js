/**
 * Date / Time Utilities dùng chung cho toàn hệ thống
 */
import moment from "moment";

/**
 * Chuyển đổi timestamp, ISO string hoặc Date sang millisecond
 */
export const toMs = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = Date.parse(v);
        return Number.isNaN(n) ? null : n;
    }
    if (v instanceof Date) return v.getTime();
    return null;
};

/**
 * Lấy thời gian bắt đầu và kết thúc (ms) từ item chương trình
 */
export const getStartEndMs = (item) => {
    const s = toMs(item?.startMs ?? item?.start ?? item?.s ?? null);
    const e = toMs(item?.stopMs ?? item?.end ?? item?.stop ?? item?.e ?? null);
    return { s, e };
};

/**
 * Format hiển thị giờ:phút (HH:mm)
 */
export const formatTimeOnly = (value) => {
    const ms = toMs(value);
    if (!ms) return "--:--";
    const d = new Date(ms);
    return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

/**
 * Format hiển thị ngày giờ đầy đủ (DD/MM/YYYY HH:mm)
 */
export const formatDateTime = (value) => {
    const ms = toMs(value);
    if (!ms) return "--";
    const d = new Date(ms);
    return d.toLocaleString([], {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

/**
 * Lấy nhãn ngày tương đối (Hôm nay, Ngày mai, Hôm qua, hoặc Thứ X DD/MM)
 */
export const getRelativeDateLabel = (dateInput) => {
    const d = dateInput instanceof Date ? dateInput : new Date(toMs(dateInput));
    if (Number.isNaN(d.getTime())) return "";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hôm nay";
    if (d.toDateString() === tomorrow.toDateString()) return "Ngày mai";
    if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";

    return d.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
    });
};

/**
 * Format thời gian trận đấu thể thao theo múi giờ Việt Nam GMT+7
 */
export const formatMatchDateTime = (dateEvent, strTime, format = "DD/MM HH:mm") => {
    if (!dateEvent) return "TBD";
    if (!strTime) return dateEvent;
    try {
        return moment
            .utc(`${dateEvent}T${strTime}`)
            .utcOffset(7)
            .format(format);
    } catch {
        return `${dateEvent} ${strTime}`;
    }
};
