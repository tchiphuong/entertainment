import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const SIZE_MAP = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-2xl",
};

const resolveInitial = (name) => {
    if (!name || typeof name !== "string") return "U";
    const clean = name.trim();
    return clean ? clean.charAt(0).toUpperCase() : "U";
};

/**
 * Component Avatar người dùng chuẩn dùng chung
 */
export const UserAvatar = ({
    name,
    avatarUrl,
    size = "sm",
    isHost = false,
    className = "",
    alt,
}) => {
    const sizeClasses = SIZE_MAP[size] || SIZE_MAP.sm;
    const initial = resolveInitial(name);
    const label = alt || name || "User Avatar";

    return (
        <div className="relative inline-flex shrink-0 items-center justify-center">
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={label}
                    className={`rounded-full object-cover border border-zinc-800 ${sizeClasses} ${className}`}
                    loading="lazy"
                />
            ) : (
                <div
                    aria-label={label}
                    className={`flex items-center justify-center rounded-full font-bold uppercase select-none ${
                        isHost
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : "bg-zinc-800 text-zinc-300 border border-zinc-700/60"
                    } ${sizeClasses} ${className}`}
                >
                    {initial}
                </div>
            )}

            {isHost && size !== "xs" && (
                <span
                    title="Trưởng phòng"
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow ring-1 ring-black"
                >
                    <ShieldCheckIcon className="h-2.5 w-2.5 stroke-[2.5]" />
                </span>
            )}
        </div>
    );
};

export default UserAvatar;
