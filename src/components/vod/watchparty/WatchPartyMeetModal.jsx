import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    LinkIcon,
    CheckIcon,
    TrashIcon,
    VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button, Input } from "../../ui";

export const MeetingRoomIcon = ({ className = "h-5 w-5" }) => (
    <VideoCameraIcon className={className} />
);

// Giữ lại alias để tương thích ngược nếu còn component khác import
export const GoogleMeetIcon = MeetingRoomIcon;

export const WatchPartyMeetModal = ({
    isOpen,
    onOpenChange,
    currentMeetUrl = "",
    onSaveMeetUrl,
}) => {
    const { t } = useTranslation();
    const [meetInput, setMeetInput] = useState(currentMeetUrl || "");
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setMeetInput(currentMeetUrl || "");
            setError("");
        }
    }, [isOpen, currentMeetUrl]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const trimmed = meetInput.trim();
        if (!trimmed) {
            onSaveMeetUrl("");
            onOpenChange(false);
            return;
        }

        const isValidMeetingUrl = trimmed.includes(".") && (trimmed.includes("http") || trimmed.includes("/"));
        if (!isValidMeetingUrl) {
            setError(t("watchParty.meet.invalidUrl", { defaultValue: "Vui lòng dán đúng định dạng đường dẫn liên kết phòng họp" }));
            return;
        }

        onSaveMeetUrl(trimmed);
        onOpenChange(false);
    };

    const handleRemove = () => {
        onSaveMeetUrl("");
        onOpenChange(false);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="sm">
                <Modal.Dialog aria-label="Ghim liên kết phòng họp thoại trực tuyến">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                                <VideoCameraIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.meet.modalTitle", { defaultValue: "Ghim link phòng họp thoại" })}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {t("watchParty.meet.modalDesc", {
                                        defaultValue: "Dán đường dẫn phòng họp trực tuyến vào đây. Mọi người trong phòng xem chung có thể bấm vào để cùng tham gia gọi thoại trực tiếp.",
                                    })}
                                </p>

                                <div>
                                    <label htmlFor="meet-link-input" className="block text-xs font-semibold text-zinc-300">
                                        {t("watchParty.meet.inputLabel", { defaultValue: "Đường dẫn phòng họp trực tuyến" })}
                                    </label>
                                    <div className="relative mt-1.5 flex items-center">
                                        <div className="pointer-events-none absolute left-3 text-zinc-500">
                                            <LinkIcon className="h-4 w-4 stroke-2" />
                                        </div>
                                        <Input
                                            id="meet-link-input"
                                            value={meetInput}
                                            onChange={(e) => {
                                                setMeetInput(e.target.value);
                                                if (error) setError("");
                                            }}
                                            placeholder="https://... (dán liên kết phòng họp vào đây)"
                                            className="w-full pl-9 pr-3 text-sm"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-500">
                                        {t("watchParty.meet.supportedHint", {
                                            defaultValue: "Hỗ trợ liên kết phòng họp bất kỳ (Google Meet, Zoom, MS Teams, Discord...)",
                                        })}
                                    </p>
                                </div>

                                {error && (
                                    <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-xs font-medium text-red-400">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </Modal.Body>

                        <Modal.Footer>
                            <div className="flex w-full items-center justify-between gap-2">
                                {currentMeetUrl ? (
                                    <Button
                                        type="button"
                                        onPress={handleRemove}
                                        variant="danger"
                                        size="sm"
                                    >
                                        <TrashIcon className="h-4 w-4 stroke-2" />
                                        <span>{t("watchParty.meet.removeLink", { defaultValue: "Gỡ link" })}</span>
                                    </Button>
                                ) : <div />}

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        onPress={() => onOpenChange(false)}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        {t("common.cancel", { defaultValue: "Hủy" })}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="sm"
                                    >
                                        <CheckIcon className="h-4 w-4 stroke-2" />
                                        <span>{t("common.save", { defaultValue: "Lưu link" })}</span>
                                    </Button>
                                </div>
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

export default WatchPartyMeetModal;
