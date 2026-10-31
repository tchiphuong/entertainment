import React, { useState, useEffect, useRef, useCallback } from "react";

const TOAST_DURATION_MS = 4000;

const UserPlusIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
        className="h-5 w-5"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
        />
    </svg>
);

const UserMinusIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
        className="h-5 w-5"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
        />
    </svg>
);

const CloseIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-4 w-4"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

const ToastItem = ({ toast, onClose }) => {
    const isJoin = toast.type === "join";

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-center justify-between gap-3.5 rounded-xl border border-zinc-800 bg-zinc-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isJoin
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border border-zinc-700 bg-zinc-800 text-zinc-400"
                    }`}
                >
                    {isJoin ? <UserPlusIcon /> : <UserMinusIcon />}
                </div>

                <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                        {toast.name}
                    </span>
                    <span
                        className={`text-xs font-medium ${
                            isJoin ? "text-emerald-400" : "text-zinc-400"
                        }`}
                    >
                        {isJoin ? "đã vào phòng xem" : "đã rời khỏi phòng xem"}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onPress={() => onClose(toast.id)}
                onClick={() => onClose(toast.id)}
                aria-label="Đóng thông báo"
                className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
                <CloseIcon />
            </button>
        </div>
    );
};

const resolveParticipantChanges = (current, prev, currentUserId) => {
    const changes = [];
    if (!current || !prev) return changes;

    Object.keys(current).forEach((uid) => {
        if (!prev[uid] && uid !== currentUserId) {
            changes.push({
                id: `${uid}-join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "join",
                name: current[uid]?.name || "Một thành viên",
            });
        }
    });

    Object.keys(prev).forEach((uid) => {
        if (!current[uid] && uid !== currentUserId) {
            changes.push({
                id: `${uid}-leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "leave",
                name: prev[uid]?.name || "Một thành viên",
            });
        }
    });

    return changes;
};

export const WatchPartyNotificationToast = ({ participants, currentUserId }) => {
    const [toasts, setToasts] = useState([]);
    const prevParticipantsRef = useRef(null);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
    }, []);

    useEffect(() => {
        if (!participants || typeof participants !== "object") return;

        if (prevParticipantsRef.current === null) {
            prevParticipantsRef.current = participants;
            return;
        }

        const changes = resolveParticipantChanges(
            participants,
            prevParticipantsRef.current,
            currentUserId
        );
        prevParticipantsRef.current = participants;

        if (changes.length > 0) {
            setToasts((prev) => [...prev, ...changes].slice(-5));
        }
    }, [participants, currentUserId]);

    // Tự động đóng toast sau TOAST_DURATION_MS
    useEffect(() => {
        if (toasts.length === 0) return;

        const latestToast = toasts[toasts.length - 1];
        const timer = setTimeout(() => {
            removeToast(latestToast.id);
        }, TOAST_DURATION_MS);

        return () => clearTimeout(timer);
    }, [toasts, removeToast]);

    if (toasts.length === 0) return null;

    return (
        <div
            aria-live="polite"
            className="fixed top-20 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 pointer-events-none"
        >
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
            ))}
        </div>
    );
};

export default WatchPartyNotificationToast;
