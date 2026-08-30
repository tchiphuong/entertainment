import { Modal as HeroModal } from "@heroui/react";

/**
 * Modal Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy của component gốc HeroUI:
 * Modal, Modal.Trigger, Modal.Backdrop, Modal.Container, Modal.Dialog,
 * Modal.Header, Modal.Heading, Modal.Body, Modal.Footer, Modal.CloseTrigger, Modal.Icon
 */
export const Modal = ({ children, ...props }) => {
    return <HeroModal {...props}>{children}</HeroModal>;
};

Modal.Trigger = HeroModal.Trigger;

Modal.Backdrop = ({
    children,
    variant = "blur",
    isDismissable = true,
    className = "",
    ...props
}) => {
    return (
        <HeroModal.Backdrop
            variant={variant}
            isDismissable={isDismissable}
            className={className}
            {...props}
        >
            {children}
        </HeroModal.Backdrop>
    );
};

Modal.Container = ({
    children,
    placement = "center",
    size = "md",
    className = "",
    ...props
}) => {
    return (
        <HeroModal.Container
            placement={placement}
            size={size}
            className={className}
            {...props}
        >
            {children}
        </HeroModal.Container>
    );
};

Modal.Dialog = HeroModal.Dialog;
Modal.Header = HeroModal.Header;
Modal.Heading = HeroModal.Heading;
Modal.Body = HeroModal.Body;
Modal.Footer = HeroModal.Footer;
Modal.CloseTrigger = HeroModal.CloseTrigger;
Modal.Icon = HeroModal.Icon;

export default Modal;
