/**
 * LoadingSpinner - Component vòng xoay tải dữ liệu dùng chung toàn hệ thống
 * Tuân thủ chuẩn No Gradient (Solid Colors) và SonarQube Complexity <= 15
 */
const SIZE_CLASSES = {
    xs: "h-3.5 w-3.5 border-2",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-2",
    xl: "h-14 w-14 border-[3px]",
};

export const LoadingSpinner = ({
    size = "md",
    label,
    center = false,
    className = "",
    color = "red", // 'red' | 'white' | 'zinc'
}) => {
    const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;

    let colorCls = "border-zinc-800 border-t-red-600";
    if (color === "white") {
        colorCls = "border-white/20 border-t-white";
    } else if (color === "zinc") {
        colorCls = "border-zinc-800 border-t-zinc-400";
    }

    const spinner = (
        <div
            className={`inline-block animate-spin rounded-full ${sizeCls} ${colorCls} ${className}`}
            role="status"
            aria-label={label || "Đang tải"}
        />
    );

    if (!label && !center) {
        return spinner;
    }

    return (
        <div className={`flex items-center gap-2.5 ${center ? "justify-center py-6" : ""}`}>
            {spinner}
            {label && <span className="text-xs text-zinc-400">{label}</span>}
        </div>
    );
};

export default LoadingSpinner;
