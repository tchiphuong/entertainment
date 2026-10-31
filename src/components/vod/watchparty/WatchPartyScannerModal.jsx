import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    QrCodeIcon,
    ExclamationTriangleIcon,
    CameraIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button } from "../../ui";
import { parseRoomCodeFromText } from "../../../utils/watchPartyUtils";

export const WatchPartyScannerModal = ({
    isOpen,
    onOpenChange,
    onCodeScanned,
}) => {
    const { t } = useTranslation();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const scanIntervalRef = useRef(null);
    const [scanError, setScanError] = useState("");
    const [isScanning, setIsScanning] = useState(false);

    const stopCamera = useCallback(() => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsScanning(false);
    }, []);

    const startCameraAndScan = useCallback(async () => {
        setScanError("");
        setIsScanning(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Kiểm tra hỗ trợ BarcodeDetector chuẩn HTML5
            if ("BarcodeDetector" in window) {
                const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
                scanIntervalRef.current = setInterval(async () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                const detected = barcodes[0].rawValue;
                                const parsedCode = parseRoomCodeFromText(detected);
                                if (parsedCode) {
                                    stopCamera();
                                    onOpenChange(false);
                                    onCodeScanned(parsedCode);
                                }
                            }
                        } catch {
                            // Bỏ qua lỗi scan từng frame
                        }
                    }
                }, 300);
            } else {
                setScanError(t("watchParty.scannerModal.notSupported"));
            }
        } catch (err) {
            console.warn("Không thể mở camera quét QR:", err);
            setScanError(t("watchParty.scannerModal.cameraError"));
            setIsScanning(false);
        }
    }, [onCodeScanned, onOpenChange, stopCamera, t]);

    useEffect(() => {
        if (isOpen) {
            startCameraAndScan();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, startCameraAndScan, stopCamera]);

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="sm">
                <Modal.Dialog aria-label={t("watchParty.scannerModal.title")}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <QrCodeIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.scannerModal.title")}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="flex flex-col items-center text-center">
                            {/* Khung Camera Quét QR */}
                            <div className="relative aspect-square w-64 overflow-hidden rounded-2xl border-2 border-dashed border-red-600 bg-zinc-900 shadow-2xl">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="h-full w-full object-cover"
                                />

                                {/* Lưới hồng ngoại nhắm mục tiêu */}
                                {isScanning && !scanError && (
                                    <div className="pointer-events-none absolute inset-4 rounded-xl border border-red-500/40 animate-pulse">
                                        <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-red-500" />
                                        <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-red-500" />
                                        <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-red-500" />
                                        <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-red-500" />
                                    </div>
                                )}
                            </div>

                            {scanError ? (
                                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-left text-xs text-amber-300">
                                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0 stroke-2 text-amber-400" />
                                    <span>{scanError}</span>
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-zinc-400">
                                    {t("watchParty.scannerModal.instructions")}
                                </p>
                            )}
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <div className="flex w-full justify-between items-center">
                            <Button
                                onPress={startCameraAndScan}
                                variant="secondary"
                                size="sm"
                            >
                                <CameraIcon className="h-4 w-4 stroke-2" />
                                <span>{t("watchParty.scannerModal.retry")}</span>
                            </Button>
                            <Button
                                onPress={() => onOpenChange(false)}
                                variant="primary"
                                size="sm"
                            >
                                {t("watchParty.scannerModal.close")}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
