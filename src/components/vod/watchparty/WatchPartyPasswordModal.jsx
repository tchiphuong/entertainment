import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    LockClosedIcon,
    KeyIcon,
    EyeIcon,
    EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button } from "../../ui";

export const WatchPartyPasswordModal = ({
    isOpen,
    onOpenChange,
    roomId,
    roomName,
    onSubmitPassword,
    isLoading = false,
    errorMessage = "",
}) => {
    const { t } = useTranslation();
    const [passwordInput, setPasswordInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (!passwordInput.trim()) return;
        onSubmitPassword(passwordInput.trim());
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="sm">
                <Modal.Dialog aria-label={t("watchParty.passwordModal.title", { defaultValue: "Nhập mật khẩu phòng" })}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-amber-500">
                                <LockClosedIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.passwordModal.title", { defaultValue: "Phòng yêu cầu mật khẩu" })}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-400">
                                    {roomName || t("watchParty.passwordModal.roomFallback", { id: roomId, defaultValue: `Phòng ${roomId}` })} {t("watchParty.passwordModal.desc", { defaultValue: "được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để tham gia." })}
                                </p>

                                <div>
                                    <label htmlFor="room-password-input" className="block text-xs font-semibold text-zinc-300">
                                        {t("watchParty.passwordModal.label", { defaultValue: "Mật khẩu phòng" })}
                                    </label>
                                    <div className="relative mt-1.5 flex items-center">
                                        <div className="pointer-events-none absolute left-3 text-zinc-500">
                                            <KeyIcon className="h-4 w-4 stroke-2" />
                                        </div>
                                        <input
                                            id="room-password-input"
                                            type={showPassword ? "text" : "password"}
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            placeholder={t("watchParty.passwordModal.placeholder", { defaultValue: "Nhập mật khẩu phòng..." })}
                                            autoFocus
                                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-10 pl-9 text-sm text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 text-zinc-400 hover:text-white"
                                            title={showPassword ? t("common.hide", { defaultValue: "Ẩn" }) : t("common.show", { defaultValue: "Hiện" })}
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-4 w-4 stroke-2" />
                                            ) : (
                                                <EyeIcon className="h-4 w-4 stroke-2" />
                                            )}
                                        </button>
                                    </div>
                                    {errorMessage && (
                                        <p className="mt-1.5 text-xs text-red-500 font-medium">
                                            {errorMessage}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Modal.Body>

                        <Modal.Footer>
                            <div className="flex w-full items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    onPress={() => onOpenChange(false)}
                                    variant="secondary"
                                    size="sm"
                                >
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={!passwordInput.trim() || isLoading}
                                >
                                    {isLoading ? t("common.loading") : t("watchParty.passwordModal.submit", { defaultValue: "Vào phòng" })}
                                </Button>
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
