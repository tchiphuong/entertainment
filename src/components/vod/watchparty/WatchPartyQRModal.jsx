import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import {
    QrCodeIcon,
    DevicePhoneMobileIcon,
    ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button } from "../../ui";
import { CopyButton } from "../../common";
import { getWatchPartyRoomPath } from "../../../constants";

export const WatchPartyQRModal = ({
    isOpen,
    onOpenChange,
    roomId,
    roomName,
}) => {
    const { t } = useTranslation();
    const [qrDataUrl, setQrDataUrl] = useState("");

    const shareUrl = typeof window !== "undefined" && roomId
        ? `${window.location.origin}${getWatchPartyRoomPath(roomId)}`
        : getWatchPartyRoomPath(roomId);

    useEffect(() => {
        if (!isOpen || !roomId) return;

        QRCode.toDataURL(shareUrl, {
            width: 320,
            margin: 2,
            color: {
                dark: "#ffffff",
                light: "#18181b",
            },
            errorCorrectionLevel: "H",
        })
            .then((url) => {
                setQrDataUrl(url);
            })
            .catch((err) => {
                console.error("Lỗi tạo mã QR:", err);
            });
    }, [isOpen, roomId, shareUrl]);

    if (!roomId) return null;

    const handleDownloadQR = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        link.download = `watch-party-${roomId}.png`;
        link.href = qrDataUrl;
        link.click();
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="sm">
                <Modal.Dialog aria-label={t("watchParty.qrModal.title")}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <QrCodeIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.qrModal.title")}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="flex flex-col items-center text-center">
                            <p className="line-clamp-1 text-xs font-semibold text-zinc-400">
                                {roomName || t("watchParty.lobby.title")}
                            </p>

                            {/* Khung hiển thị hình ảnh mã QR */}
                            <div className="mt-4 flex h-64 w-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
                                {qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt={`QR Code ${roomId}`}
                                        className="h-full w-full rounded-xl object-contain"
                                    />
                                ) : (
                                    <div className="text-xs text-zinc-500">
                                        {t("common.loading")}
                                    </div>
                                )}
                            </div>

                            {/* Mã phòng to rõ */}
                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-xs text-zinc-400">
                                    {t("watchParty.qrModal.roomCodeLabel")}
                                </span>
                                <span className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-sm font-black text-red-400 tracking-wider">
                                    {roomId}
                                </span>
                            </div>

                            {/* Hướng dẫn quét bằng điện thoại */}
                            <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5 text-left text-xs text-zinc-300">
                                <DevicePhoneMobileIcon className="h-5 w-5 shrink-0 text-emerald-400 stroke-2" />
                                <span>{t("watchParty.qrModal.instructions")}</span>
                            </div>
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <div className="flex w-full items-center justify-between gap-2">
                            <CopyButton
                                textToCopy={shareUrl}
                                label={t("watchParty.qrModal.copyLink")}
                                copiedLabel={t("watchParty.qrModal.copied")}
                                className="flex-1"
                            />

                            <Button
                                onPress={handleDownloadQR}
                                variant="secondary"
                                size="sm"
                                title="Tải ảnh QR"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4 stroke-2" />
                            </Button>

                            <Button
                                onPress={() => onOpenChange(false)}
                                variant="primary"
                                size="sm"
                            >
                                {t("watchParty.qrModal.close")}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
