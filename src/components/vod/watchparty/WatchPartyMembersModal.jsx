import { useTranslation } from "react-i18next";
import {
    UsersIcon,
    ArrowsRightLeftIcon,
    CheckBadgeIcon,
    UserMinusIcon,
    NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button, Switch } from "../../ui";
import { UserAvatar, StatusBadge } from "../../common";
import { getOnlineParticipants } from "../../../utils/watchPartyUtils";

const ParticipantItem = ({
    participant,
    isTargetHost,
    isMe,
    isHost,
    controlMode,
    onToggleControl,
    onTransferHost,
    onKick,
    onBan,
    t,
}) => {
    const hasControl = isTargetHost || controlMode === "anyone" || participant.canControl === true;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            {/* Thông tin tên và vai trò */}
            <div className="flex items-center gap-3">
                <UserAvatar
                    name={participant.name}
                    avatarUrl={participant.avatar}
                    size="md"
                    isHost={isTargetHost}
                />
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                            {participant.name || "Thành viên"}
                        </span>
                        {isMe && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-400">
                                {t("common.you", { defaultValue: "Bạn" })}
                            </span>
                        )}
                        {isTargetHost && (
                            <StatusBadge variant="host">
                                {t("watchParty.members.hostBadge", { defaultValue: "Trưởng phòng" })}
                            </StatusBadge>
                        )}
                        {!isTargetHost && hasControl && (
                            <StatusBadge variant="control">
                                {t("watchParty.members.canControlBadge", { defaultValue: "Có quyền điều khiển" })}
                            </StatusBadge>
                        )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                        {isTargetHost
                            ? t("watchParty.members.hostDesc", { defaultValue: "Toàn quyền quản lý phòng & phát video" })
                            : hasControl
                            ? t("watchParty.members.controllerDesc", { defaultValue: "Được phép tua, play/pause và đổi tập" })
                            : t("watchParty.members.viewerDesc", { defaultValue: "Người xem (Đồng bộ theo phòng)" })}
                    </p>
                </div>
            </div>

            {/* Các thao tác phân quyền dành cho Trưởng phòng */}
            {isHost && !isTargetHost && (
                <div className="flex flex-wrap items-center gap-2">
                    {/* Bật / tắt quyền điều khiển */}
                    {controlMode !== "anyone" && (
                        <div className="flex items-center gap-1.5 mr-1">
                            <span className="text-[11px] text-zinc-400">
                                {participant.canControl
                                    ? t("watchParty.members.canControlLabel")
                                    : t("watchParty.members.viewerOnlyLabel")}
                            </span>
                            <Switch
                                size="sm"
                                isSelected={!!participant.canControl}
                                onChange={(selected) => onToggleControl(participant.uid, selected)}
                                aria-label={`Cấp quyền điều khiển cho ${participant.name}`}
                            >
                                <Switch.Thumb />
                            </Switch>
                        </div>
                    )}

                    {/* Nút Chuyển quyền Trưởng phòng */}
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onPress={() => onTransferHost(participant.uid)}
                        title={t("watchParty.members.transferHostTitle", { defaultValue: "Nhượng quyền Trưởng phòng cho người này" })}
                    >
                        <ArrowsRightLeftIcon className="h-3.5 w-3.5 stroke-2" />
                        <span className="hidden sm:inline">
                            {t("watchParty.members.transferHost", { defaultValue: "Chuyển Host" })}
                        </span>
                    </Button>

                    {/* Nút Mời ra khỏi phòng (Kick) */}
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border-amber-900/40"
                        onPress={() => onKick?.(participant.uid, participant.name)}
                        title={t("watchParty.members.kickTitle", { defaultValue: "Mời thành viên này rời khỏi phòng (Kick)" })}
                    >
                        <UserMinusIcon className="h-3.5 w-3.5 stroke-2" />
                        <span className="hidden sm:inline">
                            {t("watchParty.members.kick", { defaultValue: "Mời ra" })}
                        </span>
                    </Button>

                    {/* Nút Chặn vĩnh viễn (Ban) */}
                    <Button
                        variant="danger"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onPress={() => onBan?.(participant.uid, participant.name)}
                        title={t("watchParty.members.banTitle", { defaultValue: "Chặn thành viên này không cho vào lại (Ban)" })}
                    >
                        <NoSymbolIcon className="h-3.5 w-3.5 stroke-2" />
                        <span className="hidden sm:inline">
                            {t("watchParty.members.ban", { defaultValue: "Chặn" })}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
};

const BannedUserItem = ({ user, onUnban, t }) => (
    <div className="flex items-center justify-between rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
            <NoSymbolIcon className="h-4 w-4 text-red-500 shrink-0 stroke-2" />
            <span className="font-semibold text-white">{user.name || "Thành viên"}</span>
            <span className="text-[10px] text-zinc-500 font-mono">({String(user.uid).slice(0, 8)}...)</span>
        </div>
        <Button
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-[10px] border-zinc-700 hover:border-zinc-500 text-zinc-300"
            onPress={() => onUnban?.(user.uid)}
            title="Cho phép người này vào lại phòng"
        >
            {t("watchParty.members.unban", { defaultValue: "Bỏ chặn" })}
        </Button>
    </div>
);

export const WatchPartyMembersModal = ({
    isOpen,
    onOpenChange,
    participants = {},
    bannedUsers = [],
    hostId,
    currentUserId,
    isHost,
    controlMode = "host_only",
    onToggleControl,
    onTransferHost,
    onKick,
    onBan,
    onUnban,
}) => {
    const { t } = useTranslation();
    const onlineParticipants = getOnlineParticipants(participants);
    const participantList = Object.entries(onlineParticipants).map(([uid, p]) => ({
        ...p,
        uid: p.uid || uid,
    }));

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="md">
                <Modal.Dialog aria-label="Danh sách thành viên xem chung">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <UsersIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <div>
                                <Modal.Heading className="text-base font-bold text-white">
                                    {t("watchParty.members.title", { defaultValue: "Thành viên trong phòng" })} ({participantList.length})
                                </Modal.Heading>
                                <p className="text-[11px] text-zinc-400">
                                    {isHost
                                        ? t("watchParty.members.hostNotice", { defaultValue: "Trưởng phòng có thể cấp quyền, chuyển host, mời ra hoặc chặn thành viên." })
                                        : t("watchParty.members.viewerNotice", { defaultValue: "Danh sách những người đang xem chung với bạn." })}
                                </p>
                            </div>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                            {controlMode === "anyone" && (
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs text-zinc-300 flex items-center gap-2">
                                    <CheckBadgeIcon className="h-4 w-4 text-emerald-400 shrink-0 stroke-2" />
                                    <span>
                                        {t("watchParty.members.allControlNotice", {
                                            defaultValue: "Phòng đang ở chế độ Tất cả mọi người đều có thể tua, play/pause và đổi tập phim.",
                                        })}
                                    </span>
                                </div>
                            )}

                            {participantList.map((p, idx) => {
                                const isTargetHost = p.uid === hostId || p.isHost;
                                const isMe = p.uid === currentUserId;
                                return (
                                    <ParticipantItem
                                        key={p.uid || `participant-${idx}`}
                                        participant={p}
                                        isTargetHost={isTargetHost}
                                        isMe={isMe}
                                        isHost={isHost}
                                        controlMode={controlMode}
                                        onToggleControl={onToggleControl}
                                        onTransferHost={onTransferHost}
                                        onKick={onKick}
                                        onBan={onBan}
                                        t={t}
                                    />
                                );
                            })}

                            {/* Danh sách thành viên bị chặn (chỉ Trưởng phòng thấy) */}
                            {isHost && Array.isArray(bannedUsers) && bannedUsers.length > 0 && (
                                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                                    <h4 className="mb-2 text-xs font-bold text-red-400 flex items-center gap-1.5">
                                        <NoSymbolIcon className="h-3.5 w-3.5 stroke-2" />
                                        <span>{t("watchParty.members.bannedListTitle", { defaultValue: "Danh sách bị chặn" })} ({bannedUsers.length})</span>
                                    </h4>
                                    <div className="space-y-1.5">
                                        {bannedUsers.map((bUser, idx) => (
                                            <BannedUserItem
                                                key={bUser.uid || `banned-${idx}`}
                                                user={bUser}
                                                onUnban={onUnban}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <div className="flex justify-end">
                            <Button
                                onPress={() => onOpenChange(false)}
                                variant="secondary"
                                size="sm"
                            >
                                {t("common.close", { defaultValue: "Đóng" })}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
