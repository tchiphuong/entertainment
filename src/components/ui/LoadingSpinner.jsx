import Spinner from "./Spinner";

/**
 * LoadingSpinner - Component Loading overlay chung sử dụng HeroUI Spinner
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
                <Spinner color="danger" size="lg" />
                <span className="text-sm font-bold text-zinc-300">{text}</span>
            </div>
        </div>
    );
}
