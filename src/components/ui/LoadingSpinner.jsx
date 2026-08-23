/**
 * LoadingSpinner - Component Loading chung
 * @param {boolean} isLoading - Trạng thái loading
 * @param {string} text - Text hiển thị (mặc định: "Đang tải dữ liệu...")
 */
export default function LoadingSpinner({
    isLoading,
    text = "Đang tải dữ liệu...",
}) {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl">
                <svg
                    className="h-10 w-10 animate-spin text-red-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                <span className="text-sm font-bold text-zinc-300">{text}</span>
            </div>
        </div>
    );
}
