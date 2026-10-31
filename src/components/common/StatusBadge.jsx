import { ShieldCheckIcon, KeyIcon } from "@heroicons/react/24/outline";

const HostBadge = ({ children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded bg-red-950/80 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-800/60 ${className}`}>
        <ShieldCheckIcon className="h-3 w-3 stroke-2 shrink-0" />
        <span>{children || "Trưởng phòng"}</span>
    </span>
);

const ControlBadge = ({ children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60 ${className}`}>
        <KeyIcon className="h-3 w-3 stroke-2 shrink-0" />
        <span>{children || "Có quyền"}</span>
    </span>
);

const LiveBadge = ({ children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white tracking-wider ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        <span>{children || "LIVE"}</span>
    </span>
);

const PlayingBadge = ({ children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded bg-red-600/20 px-1.5 py-0.5 text-[9px] font-black text-red-400 uppercase tracking-wider ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        <span>{children || "Đang phát"}</span>
    </span>
);

const ServerBadge = ({ children, className }) => (
    <span className={`inline-flex items-center rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider ${className}`}>
        {children}
    </span>
);

const ViewerBadge = ({ children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-800 ${className}`}>
        <span>{children || "Thành viên"}</span>
    </span>
);

const BADGE_COMPONENTS = {
    host: HostBadge,
    control: ControlBadge,
    viewer: ViewerBadge,
    live: LiveBadge,
    playing: PlayingBadge,
    server: ServerBadge,
};

/**
 * Component hiển thị badge trạng thái dùng chung (Role, Live, Playing, Server...)
 */
export const StatusBadge = ({
    variant = "default",
    children,
    className = "",
    size = "sm",
}) => {
    const Component = BADGE_COMPONENTS[variant];
    if (Component) {
        return <Component className={className}>{children}</Component>;
    }

    const sizeClass = size === "xs" ? "px-1.5 py-0.2 text-[9px]" : "px-2 py-0.5 text-[10px]";
    return (
        <span className={`inline-flex items-center rounded bg-zinc-800 font-semibold text-zinc-300 border border-zinc-700/50 ${sizeClass} ${className}`}>
            {children}
        </span>
    );
};

export default StatusBadge;
