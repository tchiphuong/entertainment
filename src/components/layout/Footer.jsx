import { useState, memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@heroui/react";
import {
    ShieldCheckIcon,
    InformationCircleIcon,
} from "@heroicons/react/24/outline";
import Modal from "../ui/Modal";

const DisclaimerModal = memo(({ isOpen, onClose, t }) => {
    if (!isOpen) return null;

    return (
        <Modal>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose?.()} variant="blur">
                <Modal.Container size="lg" placement="center">
                    <Modal.Dialog className="border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
                        <Modal.CloseTrigger onPress={onClose} />

                        <Modal.Header className="flex items-center gap-2 border-b border-zinc-800 pb-4 pr-8">
                            <ShieldCheckIcon className="h-6 w-6 text-red-500" />
                            <Modal.Heading className="text-lg font-bold text-white">
                                {t("footer.disclaimerTitle")}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4 py-4 text-sm leading-relaxed text-zinc-400">
                            <p className="whitespace-pre-line">
                                {t("footer.disclaimerFull")}
                            </p>
                        </Modal.Body>
                        <Modal.Footer className="flex justify-end border-t border-zinc-800 pt-4">
                            <Button
                                variant="secondary"
                                onPress={onClose}
                                className="font-semibold text-white"
                            >
                                {t("common.close")}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
});

DisclaimerModal.displayName = "DisclaimerModal";

export function Footer() {
    const { t } = useTranslation();
    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

    return (
        <footer className="w-full border-t border-zinc-900 bg-zinc-950 font-sans text-zinc-400">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Khối Miễn trừ trách nhiệm nổi bật */}
                <div className="mb-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-lg">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-500 shadow-sm">
                            <InformationCircleIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                                    {t("footer.disclaimerTitle")}
                                </h4>
                                <Button
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => setIsDisclaimerOpen(true)}
                                    className="h-auto p-0 text-xs font-semibold text-red-500 hover:text-red-400 underline"
                                >
                                    {t("footer.viewFullDisclaimer")}
                                </Button>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                                {t("footer.disclaimerShort")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Các liên kết điều hướng & thông tin */}
                <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-6 sm:flex-row">
                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-zinc-500 sm:justify-start">
                        <Link to="/" className="transition-colors hover:text-white">
                            {t("footer.schedule")}
                        </Link>
                        <Link to="/vod" className="transition-colors hover:text-white">
                            {t("footer.explore")}
                        </Link>
                        <Link to="/tv" className="transition-colors hover:text-white">
                            {t("footer.liveTv")}
                        </Link>
                        <Link to="/vod/watch-party" className="transition-colors hover:text-white">
                            Watch Party
                        </Link>
                    </div>

                    <div className="text-center text-xs text-zinc-500 sm:text-right">
                        {t("footer.copyright")}
                    </div>
                </div>
            </div>

            {/* Modal hiển thị toàn văn tuyên bố miễn trừ trách nhiệm */}
            <DisclaimerModal
                isOpen={isDisclaimerOpen}
                onClose={() => setIsDisclaimerOpen(false)}
                t={t}
            />
        </footer>
    );
}

export default memo(Footer);
