import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    UserIcon,
    PencilSquareIcon,
    CheckIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button, Input } from "../../ui";

export const WatchPartyNameModal = ({
    isOpen,
    onOpenChange,
    currentName = "",
    onSaveName,
}) => {
    const { t } = useTranslation();
    const [nameInput, setNameInput] = useState(currentName || "");
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setNameInput(currentName || "");
            setError("");
        }
    }, [isOpen, currentName]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const trimmed = nameInput.trim();
        if (!trimmed) {
            setError(t("watchParty.nameModal.errorEmpty", { defaultValue: "Vui lòng nhập tên hiển thị." }));
            return;
        }
        if (trimmed.length > 25) {
            setError(t("watchParty.nameModal.errorTooLong", { defaultValue: "Tên hiển thị tối đa 25 ký tự." }));
            return;
        }

        onSaveName(trimmed);
        onOpenChange(false);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="sm">
                <Modal.Dialog aria-label={t("watchParty.nameModal.title", { defaultValue: "Đổi tên hiển thị xem chung" })}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <PencilSquareIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <Modal.Heading className="text-base font-bold text-white">
                                {t("watchParty.nameModal.title", { defaultValue: "Đổi tên hiển thị" })}
                            </Modal.Heading>
                        </div>
                    </Modal.Header>

                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-400">
                                    {t(
                                        "watchParty.nameModal.desc",
                                        { defaultValue: "Tên này sẽ hiển thị với bạn bè trong phòng xem chung và danh sách tin nhắn chat." }
                                    )}
                                </p>

                                <div>
                                    <label htmlFor="guest-name-input" className="block text-xs font-semibold text-zinc-300">
                                        {t("watchParty.nameModal.label", { defaultValue: "Tên của bạn" })}
                                    </label>
                                    <div className="relative mt-1.5 flex items-center">
                                        <div className="pointer-events-none absolute left-3 text-zinc-500">
                                            <UserIcon className="h-4 w-4 stroke-2" />
                                        </div>
                                        <Input
                                            id="guest-name-input"
                                            value={nameInput}
                                            onChange={(e) => {
                                                setNameInput(e.target.value);
                                                if (error) setError("");
                                            }}
                                            placeholder={t("watchParty.nameModal.placeholder", { defaultValue: "Ví dụ: Nam miền Tây, Tuấn..." })}
                                            className="w-full pl-9 pr-3 text-sm"
                                            autoFocus
                                            maxLength={25}
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-500">
                                        {t("watchParty.nameModal.charCount", {
                                            current: nameInput.length,
                                            max: 25,
                                            defaultValue: `${nameInput.length}/25 ký tự`,
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
                            <div className="flex w-full justify-end gap-2">
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
                                    isDisabled={!nameInput.trim()}
                                >
                                    <CheckIcon className="h-4 w-4 stroke-2" />
                                    <span>{t("common.save", { defaultValue: "Lưu tên" })}</span>
                                </Button>
                            </div>
                        </Modal.Footer>
                    </form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
