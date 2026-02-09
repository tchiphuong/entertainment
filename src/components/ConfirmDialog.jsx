import React from "react";

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Xoá",
    cancelText = "Huỷ",
    isDangerous = false,
}) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={onCancel}
        >
            <div
                className="w-11/12 max-w-md rounded-lg bg-zinc-800 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-zinc-700 px-6 py-4">
                    <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
                </div>
                <div className="px-6 py-4">
                    <p className="text-zinc-400">{message}</p>
                </div>
                <div className="flex justify-end gap-3 rounded-b-lg bg-zinc-700 px-6 py-3">
                    <button
                        onClick={onCancel}
                        className="rounded-lg bg-zinc-600 px-4 py-2 text-zinc-300 transition hover:bg-zinc-500"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`rounded-lg px-4 py-2 text-white transition ${
                            isDangerous
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-blue-500 hover:bg-blue-600"
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
