import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    UsersIcon,
    FilmIcon,
    ArrowRightIcon,
    FireIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";
import { Button, Select, ListBox } from "../../ui";
import { StatusBadge, UserAvatar, LoadingSpinner } from "../../common";
import { subscribeActiveWatchPartyRooms } from "../../../services/vod/watchPartyService";
import { getWatchPartyRoomPath } from "../../../constants";
import { getOnlineParticipantCount } from "../../../utils/watchPartyUtils";

// Subcomponent hiển thị Thumbnail phòng xem chung phong cách RoPhim (16:9 cinematic)
const RoomCardThumbnail = ({ room, isPlaying, count }) => {
    const { t } = useTranslation();
    const movieThumb = room.movie?.thumb_url || room.movie?.poster_url;

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800">
            {movieThumb ? (
                <img
                    src={movieThumb}
                    alt={room.movie?.name || "Movie"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-600">
                    <FilmIcon className="h-10 w-10 stroke-1 opacity-50" />
                </div>
            )}

            {/* Lớp phủ tối bảo đảm tương phản (No Gradient Rule) */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Badge LIVE nhấp nháy góc trái trên chuẩn RoPhim */}
            <StatusBadge variant="live" className="absolute top-2 left-2 shadow-lg" />

            {/* Số người đang xem góc phải trên */}
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/90 px-2 py-0.5 text-[10px] font-bold text-zinc-200 border border-zinc-700/60 shadow-lg">
                <UsersIcon className="h-3 w-3 text-emerald-400 stroke-2" />
                <span>{count}</span>
            </div>

            {/* Trạng thái phát và Mã phòng góc dưới */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px]">
                <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono font-bold text-zinc-300 border border-zinc-700/50">
                    {room.roomId}
                </span>
                <span className={`font-semibold ${isPlaying ? "text-emerald-400" : "text-zinc-400"}`}>
                    {isPlaying ? t("watchParty.lobby.playing") : t("watchParty.lobby.paused")}
                </span>
            </div>
        </div>
    );
};

// Subcomponent Card phòng chuẩn RoPhim
const ActiveRoomCard = ({ room, onJoin }) => {
    const { t } = useTranslation();
    const count = getOnlineParticipantCount(room.participants);
    const isPlaying = room.playback?.isPlaying !== false;

    return (
        <div
            onClick={() => onJoin(room.roomId || room.id)}
            className="group cursor-pointer flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-3 transition-all hover:border-red-600/60 hover:bg-zinc-900/60 shadow-xl"
        >
            <div>
                {/* 1. Thumbnail 16:9 */}
                <RoomCardThumbnail room={room} isPlaying={isPlaying} count={count} />

                {/* 2. Chi tiết phòng & Avatar Chủ phòng */}
                <div className="mt-3 flex items-start gap-2.5">
                    {/* Avatar chủ phòng có viền đỏ Live chuẩn RoPhim */}
                    <UserAvatar
                        name={room.hostName || "Host"}
                        avatarUrl={room.participants?.[room.hostId]?.avatar}
                        size="md"
                        isHost={true}
                        className="border-2 border-red-500 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                        <h3 className="line-clamp-1 text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                            {room.movie?.name || "Xem chung"}
                        </h3>
                        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                            {room.episode?.name || "Tập 1"} • {t("watchParty.lobby.host")}:{" "}
                            <span className="text-zinc-300 font-semibold">{room.hostName || "Chủ phòng"}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer: Nút vào phòng một chạm */}
            <div className="mt-3.5 flex items-center justify-between border-t border-zinc-900 pt-2.5">
                <span className="text-[11px] text-zinc-500">
                    {t("watchParty.lobby.watchingCount", { count })}
                </span>
                <Button
                    onPress={(e) => {
                        e?.stopPropagation();
                        onJoin(room.roomId || room.id);
                    }}
                    variant="primary"
                    size="sm"
                    className="py-1 px-3 text-xs"
                >
                    <span>{t("watchParty.lobby.join")}</span>
                    <ArrowRightIcon className="h-3.5 w-3.5 stroke-2" />
                </Button>
            </div>
        </div>
    );
};

// Subcomponent thanh Tabs & Bộ lọc (Mới nhất, Phổ biến, Trạng thái) chuẩn RoPhim
const ActiveRoomsFilterBar = ({
    activeTab,
    onTabChange,
    statusFilter,
    onStatusChange,
    roomCount,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            {/* Tiêu đề & Chấm đỏ Live */}
            <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <h2 className="text-base sm:text-lg font-black text-white">
                    {t("watchParty.lobby.activeRooms")}
                </h2>
                <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-xs font-bold text-red-400">
                    {roomCount}
                </span>
            </div>

            {/* Tab chuyển Mới nhất / Phổ biến chuẩn RoPhim */}
            <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800">
                    <button
                        type="button"
                        onClick={() => onTabChange("new")}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                            activeTab === "new"
                                ? "bg-red-600 text-white shadow"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <ClockIcon className="h-3.5 w-3.5 stroke-2" />
                        <span>{t("watchParty.lobby.tabNewest", { defaultValue: "Mới nhất" })}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onTabChange("popular")}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                            activeTab === "popular"
                                ? "bg-red-600 text-white shadow"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <FireIcon className="h-3.5 w-3.5 stroke-2" />
                        <span>{t("watchParty.lobby.tabPopular", { defaultValue: "Phổ biến" })}</span>
                    </button>
                </div>

                {/* Dropdown/Select lọc trạng thái HeroUI v3 */}
                <Select
                    selectedKey={statusFilter}
                    onSelectionChange={(key) => onStatusChange(String(key))}
                    aria-label={t("watchParty.lobby.filterRoomsAria", { defaultValue: "Lọc trạng thái phòng" })}
                    className="w-32"
                    size="sm"
                >
                    <Select.Trigger className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 focus:border-red-600 focus:outline-none">
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="border border-zinc-800 bg-zinc-900 text-zinc-200 shadow-xl">
                        <ListBox>
                            <ListBox.Item id="all" textValue={t("watchParty.lobby.filterAll", { defaultValue: "Tất cả" })}>
                                {t("watchParty.lobby.filterAll", { defaultValue: "Tất cả" })}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="playing" textValue={t("watchParty.lobby.filterPlaying", { defaultValue: "Đang phát" })}>
                                {t("watchParty.lobby.filterPlaying", { defaultValue: "Đang phát" })}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="paused" textValue={t("watchParty.lobby.filterPaused", { defaultValue: "Tạm dừng" })}>
                                {t("watchParty.lobby.filterPaused", { defaultValue: "Tạm dừng" })}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>
        </div>
    );
};

export const WatchPartyActiveRooms = ({ onSelectRoom }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("new");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        const unsubscribe = subscribeActiveWatchPartyRooms((activeRooms) => {
            setRooms(activeRooms);
            setIsLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Lọc và sắp xếp danh sách phòng
    const filteredRooms = useMemo(() => {
        let result = [...rooms];

        // Lọc theo trạng thái
        if (statusFilter === "playing") {
            result = result.filter((r) => r.playback?.isPlaying !== false);
        } else if (statusFilter === "paused") {
            result = result.filter((r) => r.playback?.isPlaying === false);
        }

        // Sắp xếp
        if (activeTab === "popular") {
            result.sort((a, b) => {
                const countA = getOnlineParticipantCount(a.participants);
                const countB = getOnlineParticipantCount(b.participants);
                return countB - countA;
            });
        }

        return result;
    }, [rooms, statusFilter, activeTab]);

    const handleJoinRoom = (roomId) => {
        if (onSelectRoom) {
            onSelectRoom(roomId);
        } else {
            navigate(getWatchPartyRoomPath(roomId));
        }
    };

    if (isLoading) {
        return (
            <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                <LoadingSpinner label={t("common.loading")} />
            </div>
        );
    }

    if (rooms.length === 0) {
        return null;
    }

    return (
        <section aria-label={t("watchParty.lobby.activeRooms")} className="mt-12">
            <ActiveRoomsFilterBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                roomCount={filteredRooms.length}
            />

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRooms.map((room) => (
                    <ActiveRoomCard
                        key={room.id || room.roomId}
                        room={room}
                        onJoin={handleJoinRoom}
                    />
                ))}
            </div>
        </section>
    );
};
