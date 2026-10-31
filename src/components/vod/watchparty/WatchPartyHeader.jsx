import { useTranslation } from "react-i18next";
import {
    UsersIcon,
    Cog6ToothIcon,
    ArrowLeftOnRectangleIcon,
    QrCodeIcon,
    PencilSquareIcon,
    VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../ui";
import { UserAvatar, CopyButton } from "../../common";
import { getOnlineParticipantCount } from "../../../utils/watchPartyUtils";
import { WatchPartyNavMenu } from "./WatchPartyNavMenu";
import { WatchPartyMobileMenu } from "./WatchPartyMobileMenu";

const HeaderUserBadge = ({ activeUser, isHost, onOpenNameModal, t }) => {
    const isGuest = activeUser?.isGuest;
    const title = isGuest
        ? t("watchParty.header.changeGuestName", { defaultValue: "Đổi tên hiển thị" })
        : (activeUser?.displayName || "");
    const effectiveIsHost = Boolean(isHost ?? activeUser?.isHost);

    return (
        <Button
            onPress={onOpenNameModal}
            variant="secondary"
            size="sm"
            className="gap-1 px-2 sm:gap-1.5 sm:px-3 shrink-0"
            title={title}
        >
            <UserAvatar name={activeUser?.displayName} size="xs" isHost={effectiveIsHost} />
            <span className="max-w-[70px] truncate text-xs font-semibold sm:max-w-[120px]">
                {activeUser?.displayName || "Khách"}
            </span>
            {isGuest && (
                <PencilSquareIcon className="h-3 w-3 text-zinc-400 stroke-2 sm:h-3.5 sm:w-3.5" />
            )}
        </Button>
    );
};

const MeetActionButton = ({ meetUrl, canManageMeet, onOpenMeetModal }) => {
    if (meetUrl) {
        return (
            <Button
                onPress={() => window.open(meetUrl, "_blank", "noopener,noreferrer")}
                variant="secondary"
                size="sm"
                className="border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 gap-1.5"
                title="Vào phòng họp trực tuyến"
            >
                <VideoCameraIcon className="h-4 w-4 shrink-0 stroke-2 text-emerald-400" />
                <span className="hidden sm:inline">Phòng họp</span>
            </Button>
        );
    }

    if (!canManageMeet) return null;

    return (
        <Button
            onPress={onOpenMeetModal}
            variant="secondary"
            size="sm"
            className="gap-1.5"
            title="Ghim link phòng họp trực tuyến"
        >
            <VideoCameraIcon className="h-4 w-4 shrink-0 stroke-2" />
            <span className="hidden sm:inline">+ Phòng họp</span>
        </Button>
    );
};

const RoomTitleSection = ({ roomId, navTitle, t }) => (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 font-black text-white shrink-0 sm:h-9 sm:w-9">
            <UsersIcon className="h-4 w-4 stroke-2 sm:h-5 sm:w-5" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-red-500">
                {navTitle}
            </span>
            {roomId && (
                <CopyButton
                    textToCopy={roomId}
                    label={roomId}
                    copiedLabel={t("common.copied", { defaultValue: "Đã chép" })}
                    size="sm"
                    className="h-8 px-2 font-mono text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700"
                    title={t("watchParty.header.copiedCode", { defaultValue: "Bấm để sao chép mã phòng" })}
                />
            )}
        </div>
    </div>
);

export const WatchPartyHeader = ({
    room,
    isHost = false,
    activeUser,
    onOpenNameModal,
    onOpenMembersModal,
    onOpenSettings,
    onOpenQRModal,
    onLeaveRoom,
    onOpenMeetModal,
}) => {
    const { t } = useTranslation();
    const participantCount = getOnlineParticipantCount(room?.participants);
    const canManageMeet = Boolean(isHost || activeUser?.isHost);

    return (
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-2.5 text-white xl:h-14 xl:px-4">
            {/* Cụm bên trái: Menu điều hướng & Mã phòng */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <WatchPartyNavMenu movie={room?.movie} />
                <RoomTitleSection
                    roomId={room?.roomId}
                    navTitle={t("watchParty.navTitle")}
                    t={t}
                />
            </div>

            {/* Cụm bên phải trên Mobile & Tablet (< xl): Tinh gọn 1 hàng duy nhất chuẩn native app */}
            <div className="flex items-center gap-1.5 xl:hidden shrink-0">
                {/* Nút Chia sẻ */}
                <Button
                    onPress={onOpenQRModal}
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 text-emerald-400 hover:text-emerald-300"
                    title={t("common.share", { defaultValue: "Chia sẻ" })}
                >
                    <QrCodeIcon className="h-4 w-4 stroke-2" />
                </Button>

                {/* Nút Thành viên */}
                <Button
                    onPress={onOpenMembersModal}
                    variant="secondary"
                    size="sm"
                    className="h-8 gap-1 px-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                    title={t("watchParty.header.viewMembers", { defaultValue: "Xem danh sách thành viên & phân quyền" })}
                >
                    <UsersIcon className="h-4 w-4 text-emerald-400 stroke-2" />
                    <span className="text-xs font-bold">{participantCount}</span>
                </Button>

                {/* Nút 3 chấm mở rộng (Cài đặt, Meet, Đổi tên, Điều hướng) */}
                <WatchPartyMobileMenu
                    room={room}
                    activeUser={activeUser}
                    isHost={isHost}
                    onOpenNameModal={onOpenNameModal}
                    onOpenSettings={onOpenSettings}
                    onOpenMeetModal={onOpenMeetModal}
                />

                {/* Nút Rời phòng */}
                <Button
                    onPress={onLeaveRoom}
                    variant="danger"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title={t("watchParty.header.leave", { defaultValue: "Rời phòng" })}
                >
                    <ArrowLeftOnRectangleIcon className="h-4 w-4 stroke-2" />
                </Button>
            </div>

            {/* Cụm bên phải trên Desktop lớn (>= xl): Dàn phẳng đầy đủ các nút */}
            <div className="hidden items-center gap-2 xl:flex">
                <Button
                    onPress={onOpenQRModal}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    title={t("watchParty.header.qrCode")}
                >
                    <QrCodeIcon className="h-4 w-4 text-emerald-400 stroke-2" />
                    <span>{t("common.share", { defaultValue: "Chia sẻ" })}</span>
                </Button>

                <Button
                    onPress={onOpenMembersModal}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    title={t("watchParty.header.viewMembers", { defaultValue: "Xem danh sách thành viên & phân quyền" })}
                >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{t("watchParty.header.memberCount", { count: participantCount })}</span>
                </Button>

                <MeetActionButton
                    meetUrl={room?.meetUrl}
                    canManageMeet={canManageMeet}
                    onOpenMeetModal={onOpenMeetModal}
                />

                <Button
                    onPress={onOpenSettings}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    title={t("watchParty.header.settings")}
                >
                    <Cog6ToothIcon className="h-4 w-4 stroke-2" />
                    <span>{t("watchParty.header.settings")}</span>
                </Button>

                <HeaderUserBadge
                    activeUser={activeUser}
                    isHost={isHost}
                    onOpenNameModal={onOpenNameModal}
                    t={t}
                />

                <Button
                    onPress={onLeaveRoom}
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                    title={t("watchParty.header.leave")}
                >
                    <ArrowLeftOnRectangleIcon className="h-4 w-4 stroke-2" />
                    <span>{t("watchParty.header.leave")}</span>
                </Button>
            </div>
        </header>
    );
};

export default WatchPartyHeader;
