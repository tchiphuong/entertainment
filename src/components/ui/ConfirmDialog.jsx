import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import Button from "./Button";
import Modal from "./Modal";

/**
 * ConfirmDialog - Hộp thoại xác nhận chuẩn hóa bằng HeroUI Modal + Button
 */
export default function ConfirmDialog({
    isOpen,
    title = "Xác nhận",
    message,
    onConfirm,
    onCancel,
    confirmText = "Xoá",
    cancelText = "Huỷ",
    isDangerous = false,
}) {
    if (!isOpen) return null;

    return (
        <Modal>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onCancel?.()}>
                <Modal.Container size="sm" placement="center">
                    <Modal.Dialog className="p-6">
                        <Modal.CloseTrigger onPress={onCancel} />
                        
                        <Modal.Header className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDangerous ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-300"}`}>
                                {isDangerous ? (
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                ) : (
                                    <QuestionMarkCircleIcon className="h-5 w-5" />
                                )}
                            </div>
                            <Modal.Heading className="text-lg font-bold text-white">
                                {title}
                            </Modal.Heading>
                        </Modal.Header>

                        <Modal.Body className="mt-2 text-sm text-zinc-300">
                            {message}
                        </Modal.Body>

                        <Modal.Footer className="mt-6 flex justify-end gap-3">
                            <Button variant="secondary" onPress={onCancel}>
                                {cancelText}
                            </Button>
                            <Button
                                variant={isDangerous ? "danger" : "primary"}
                                onPress={onConfirm}
                            >
                                {confirmText}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
