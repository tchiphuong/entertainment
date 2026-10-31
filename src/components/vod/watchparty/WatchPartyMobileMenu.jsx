import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    EllipsisVerticalIcon,
    Cog6ToothIcon,
    PencilSquareIcon,
    HomeIcon,
    FilmIcon,
    VideoCameraIcon,
    ArrowUturnLeftIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../ui";
import { UserAvatar } from "../../common";
import { ROUTES, getVodCategoryPath, getVodPlayPath } from "../../../constants";

const MobileMenuItem = ({ icon: Icon, label, subtitle, onClick, to, isHighlight = false }) => {
    const content = (
        <>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${isHighlight ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
                <Icon className="h-4 w-4 stroke-2" />
            </div>
            <div className="flex flex-col min-w-0 text-left">
                <span className="font-semibold truncate">{label}</span>
                {subtitle && <span className="text-[10px] text-zinc-500 truncate">{subtitle}</span>}
            </div>
        </>
    );

    const baseClass = `flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors ${
        isHighlight
            ? "bg-red-950/40 text-red-300 hover:bg-red-950/70 hover:text-white border border-red-900/40"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
    }`;

    if (to) {
        return (
            <Link to={to} onClick={onClick} className={baseClass}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={onClick} className={baseClass}>
            {content}
        </button>
    );
};

const MobileUserHeader = ({ activeUser, isHost, onOpenNameModal, onClose, t }) => {
    const isGuest = activeUser?.isGuest;
    const displayName = activeUser?.displayName || "Khách";

    return (
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-2.5 pb-2.5 pt-1">
            <button
                type="button"
                onClick={onOpenNameModal}
                className="flex items-center gap-2 text-left min-w-0 hover:opacity-80 transition-opacity"
                title={isGuest ? t("watchParty.header.changeGuestName", { defaultValue: "Đổi tên hiển thị" }) : displayName}
            >
                <UserAvatar name={displayName} size="xs" isHost={isHost} />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate max-w-[150px]">
                        {displayName}
                    </span>
                    {isGuest && (
                        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                            <PencilSquareIcon className="h-3 w-3 stroke-2" />
                            <span>{t("watchParty.header.changeGuestNameShort", { defaultValue: "Đổi tên" })}</span>
                        </span>
                    )}
                </div>
            </button>

            <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label="Đóng menu"
            >
                <XMarkIcon className="h-4 w-4 stroke-2" />
            </button>
        </div>
    );
};

const MobileActionList = ({
    room,
    isHost,
    movieSlug,
    movieName,
    onOpenSettings,
    onOpenMeetModal,
    onOpenChangeMovieModal,
    onClose,
    t,
}) => (
    <div className="mt-1.5 space-y-1 max-h-80 overflow-y-auto">
        {isHost && onOpenChangeMovieModal && (
            <MobileMenuItem
                icon={FilmIcon}
                label={t("watchParty.changeMovie.title", { defaultValue: "Đổi phim khác" })}
                subtitle={t("watchParty.changeMovie.subtitle", { defaultValue: "Tìm & đổi phim cho cả phòng" })}
                onClick={() => {
                    onClose();
                    onOpenChangeMovieModal();
                }}
                isHighlight={true}
            />
        )}

        <MobileMenuItem
            icon={Cog6ToothIcon}
            label={t("watchParty.header.settings", { defaultValue: "Cài đặt phòng" })}
            subtitle={t("watchParty.header.settingsDesc", { defaultValue: "Quyền điều khiển, webcam, chat" })}
            onClick={() => {
                onClose();
                onOpenSettings?.();
            }}
        />

        <MobileMenuItem
            icon={VideoCameraIcon}
            label={t("watchParty.meet.roomLabel", { defaultValue: "Phòng họp thoại" })}
            subtitle={room?.meetUrl ? t("watchParty.meet.joined", { defaultValue: "Đã có link phòng họp" }) : t("watchParty.meet.add", { defaultValue: "Ghim link phòng họp thoại" })}
            onClick={() => {
                onClose();
                onOpenMeetModal?.();
            }}
        />

        <div className="my-1 border-t border-zinc-800/60" />

        {movieSlug && (
            <MobileMenuItem
                icon={ArrowUturnLeftIcon}
                label={t("watchParty.nav.backToMovie", { defaultValue: "Về trang phim này" })}
                subtitle={movieName}
                to={getVodPlayPath(movieSlug)}
                onClick={onClose}
                isHighlight={true}
            />
        )}

        <MobileMenuItem
            icon={HomeIcon}
            label={t("watchParty.nav.vodHome", { defaultValue: "Trang chủ VOD" })}
            to={ROUTES.VOD.ROOT}
            onClick={onClose}
        />

        <MobileMenuItem
            icon={FilmIcon}
            label={t("vods.series", { defaultValue: "Phim Bộ" })}
            to={getVodCategoryPath("phim-bo")}
            onClick={onClose}
        />

        <MobileMenuItem
            icon={VideoCameraIcon}
            label={t("vods.movies", { defaultValue: "Phim Lẻ" })}
            to={getVodCategoryPath("phim-le")}
            onClick={onClose}
        />
    </div>
);

export const WatchPartyMobileMenu = ({
    room,
    activeUser,
    isHost,
    onOpenNameModal,
    onOpenSettings,
    onOpenMeetModal,
    onOpenChangeMovieModal,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const movieSlug = room?.movie?.slug;
    const movieName = room?.movie?.name || room?.movie?.origin_name;

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="relative xl:hidden">
            <Button
                onPress={() => setIsOpen((prev) => !prev)}
                variant="secondary"
                size="sm"
                className={`h-8 w-8 p-0 border-zinc-800 transition-colors ${
                    isOpen ? "bg-zinc-800 text-white" : "bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
                title={t("common.moreOptions", { defaultValue: "Tùy chọn khác" })}
                aria-expanded={isOpen}
            >
                <EllipsisVerticalIcon className="h-4 w-4 stroke-2" />
            </Button>

            {isOpen && (
                <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-zinc-800 bg-zinc-950/98 p-2 text-white shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                    <MobileUserHeader
                        activeUser={activeUser}
                        isHost={isHost}
                        onOpenNameModal={() => {
                            setIsOpen(false);
                            onOpenNameModal?.();
                        }}
                        onClose={() => setIsOpen(false)}
                        t={t}
                    />

                    <MobileActionList
                        room={room}
                        isHost={isHost}
                        movieSlug={movieSlug}
                        movieName={movieName}
                        onOpenSettings={onOpenSettings}
                        onOpenMeetModal={onOpenMeetModal}
                        onOpenChangeMovieModal={onOpenChangeMovieModal}
                        onClose={() => setIsOpen(false)}
                        t={t}
                    />
                </div>
            )}
        </div>
    );
};

export default WatchPartyMobileMenu;
