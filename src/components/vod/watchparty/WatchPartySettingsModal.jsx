import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Cog6ToothIcon,
    ShieldCheckIcon,
    TrashIcon,
    ChatBubbleLeftRightIcon,
    VideoCameraIcon,
    ArrowPathIcon,
    LockClosedIcon,
    KeyIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button, Switch } from "../../ui";
import { VoiceVolumeSettingsBlock } from "./VoiceVolumeControls";

export const WatchPartySettingsModal = ({
    isOpen,
    onOpenChange,
    settings = {},
    isHost,
    onSaveSettings,
    micVolume = 100,
    onMicVolumeChange,
    speakerVolume = 100,
    onSpeakerVolumeChange,
}) => {
    const { t } = useTranslation();
    const controlMode = settings?.controlMode || "host_only";
    const emptyAutoDelete = settings?.emptyAutoDelete !== false;
    const allowChat = settings?.allowChat !== false;
    const allowWebcam = settings?.allowWebcam !== false;
    const autoSync = settings?.autoSync !== false;

    const [passwordInput, setPasswordInput] = useState("");
    const [isPasswordSaved, setIsPasswordSaved] = useState(false);

    const handleToggle = (key, value) => {
        if (!isHost) return;
        onSaveSettings?.({ [key]: value });
    };

    const handleSavePassword = (e) => {
        e?.preventDefault();
        if (!isHost) return;
        const clean = passwordInput.trim();
        onSaveSettings?.({
            hasPassword: !!clean,
            password: clean,
        });
        setIsPasswordSaved(true);
        setPasswordInput("");
        setTimeout(() => setIsPasswordSaved(false), 2000);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="md">
                <Modal.Dialog aria-label={t("watchParty.settings.title")}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <Cog6ToothIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.settings.title")}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="space-y-4 text-xs text-zinc-300">
                            {/* Cài đặt Âm lượng Voice Chat cá nhân */}
                            <VoiceVolumeSettingsBlock
                                micVolume={micVolume}
                                onMicVolumeChange={onMicVolumeChange}
                                speakerVolume={speakerVolume}
                                onSpeakerVolumeChange={onSpeakerVolumeChange}
                            />

                            {!isHost && (
                                <div className="rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-400 border border-zinc-800">
                                    {t("watchParty.settings.subtitle")}
                                </div>
                            )}

                            {/* Cài đặt Mật khẩu phòng */}
                            {isHost && (
                                <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <LockClosedIcon className="h-4 w-4 text-amber-500 stroke-2" />
                                        <span>{t("watchParty.settings.passwordTitle", { defaultValue: "Mật khẩu phòng (Bảo vệ riêng tư)" })}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {t("watchParty.settings.passwordDesc", { defaultValue: "Đặt mật khẩu nếu bạn chỉ muốn người có mã PIN này mới được vào xem phim. Để trống nếu là phòng công khai." })}
                                    </p>
                                    <form onSubmit={handleSavePassword} className="mt-2 flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                                                <KeyIcon className="h-3.5 w-3.5 stroke-2" />
                                            </div>
                                            <input
                                                type="text"
                                                value={passwordInput}
                                                onChange={(e) => setPasswordInput(e.target.value)}
                                                placeholder={t("watchParty.settings.passwordPlaceholder", { defaultValue: "Để trống = Không có mật khẩu" })}
                                                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pr-3 pl-8 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                            />
                                        </div>
                                        <Button type="submit" variant="secondary" size="sm">
                                            {isPasswordSaved
                                                ? t("watchParty.settings.passwordSaved", { defaultValue: "Đã lưu!" })
                                                : t("watchParty.settings.updatePassword", { defaultValue: "Cập nhật pass" })}
                                        </Button>
                                    </form>
                                </div>
                            )}

                            {/* 1. Quyền điều khiển Video (Control Mode) */}
                            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                <div className="flex items-center gap-2 font-bold text-white">
                                    <ShieldCheckIcon className="h-4 w-4 text-red-500 stroke-2" />
                                    <span>{t("watchParty.settings.syncControl")}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400">
                                    {t("watchParty.settings.hostOnlyDesc")}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        disabled={!isHost}
                                        onClick={() => handleToggle("controlMode", "host_only")}
                                        className={`rounded-lg border px-3 py-2 text-left transition-all ${
                                            controlMode === "host_only"
                                                ? "border-red-600 bg-red-950/30 text-white font-bold"
                                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                                        }`}
                                    >
                                        <div className="font-semibold">{t("watchParty.settings.hostOnly")}</div>
                                        <div className="text-[10px] text-zinc-400 font-normal">
                                            {t("watchParty.settings.hostOnlyDesc")}
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!isHost}
                                        onClick={() => handleToggle("controlMode", "anyone")}
                                        className={`rounded-lg border px-3 py-2 text-left transition-all ${
                                            controlMode === "anyone"
                                                ? "border-red-600 bg-red-950/30 text-white font-bold"
                                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                                        }`}
                                    >
                                        <div className="font-semibold">{t("watchParty.settings.anyone")}</div>
                                        <div className="text-[10px] text-zinc-400 font-normal">
                                            {t("watchParty.settings.anyoneDesc")}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Tự động xoá phòng khi không còn ai xem */}
                            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                <div className="space-y-0.5 pr-4">
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <TrashIcon className="h-4 w-4 text-amber-500 stroke-2" />
                                        <span>{t("watchParty.settings.autoDelete")}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {t("watchParty.settings.autoDeleteSub")}
                                    </p>
                                </div>
                                <Switch
                                    size="sm"
                                    isDisabled={!isHost}
                                    isSelected={emptyAutoDelete}
                                    onChange={(checked) => handleToggle("emptyAutoDelete", checked)}
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Content>
                                </Switch>
                            </div>

                            {/* 3. Bật / Tắt Chat */}
                            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                <div className="space-y-0.5 pr-4">
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-400 stroke-2" />
                                        <span>{t("watchParty.settings.enableChat")}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {t("watchParty.chat.title")}
                                    </p>
                                </div>
                                <Switch
                                    size="sm"
                                    isDisabled={!isHost}
                                    isSelected={allowChat}
                                    onChange={(checked) => handleToggle("allowChat", checked)}
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Content>
                                </Switch>
                            </div>

                            {/* 4. Bật / Tắt WebCam & Mic */}
                            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                <div className="space-y-0.5 pr-4">
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <VideoCameraIcon className="h-4 w-4 text-emerald-400 stroke-2" />
                                        <span>{t("watchParty.settings.enableWebcam")}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {t("watchParty.lobby.features.camDesc")}
                                    </p>
                                </div>
                                <Switch
                                    size="sm"
                                    isDisabled={!isHost}
                                    isSelected={allowWebcam}
                                    onChange={(checked) => handleToggle("allowWebcam", checked)}
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Content>
                                </Switch>
                            </div>

                            {/* 5. Tự động đồng bộ (Auto Sync) */}
                            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                                <div className="space-y-0.5 pr-4">
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <ArrowPathIcon className="h-4 w-4 text-purple-400 stroke-2" />
                                        <span>{t("watchParty.lobby.features.syncTitle")}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        {t("watchParty.lobby.features.syncDesc")}
                                    </p>
                                </div>
                                <Switch
                                    size="sm"
                                    isDisabled={!isHost}
                                    isSelected={autoSync}
                                    onChange={(checked) => handleToggle("autoSync", checked)}
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Content>
                                </Switch>
                            </div>
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <div className="flex justify-end">
                            <Button
                                onPress={() => onOpenChange(false)}
                                variant="primary"
                                size="sm"
                            >
                                {t("common.close")}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
