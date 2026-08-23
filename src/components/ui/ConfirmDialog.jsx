import { Button } from "@heroui/react";

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            {/* Backdrop overlay */}
            <button
                type="button"
                aria-label="Đóng modal"
                className="fixed inset-0 cursor-default border-none bg-transparent outline-none"
                onClick={onCancel}
            />

            {/* Dialog panel */}
            <div className="relative z-10 w-11/12 max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="border-b border-zinc-800 px-6 py-4">
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-zinc-100">
                        {title}
                    </h3>
                </div>
                <div className="px-6 py-4">
                    <p className="text-sm text-zinc-400">{message}</p>
                </div>
                <div className="flex justify-end gap-3 rounded-b-2xl border-t border-zinc-800 bg-zinc-950 px-6 py-3">
                    <Button
                        variant="secondary"
                        onPress={onCancel}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={isDangerous ? "danger" : "secondary"}
                        onPress={onConfirm}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                            isDangerous
                                ? "bg-red-600 hover:bg-red-500"
                                : "border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                        }`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
