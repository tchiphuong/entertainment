import { Button as HeroButton, ButtonGroup as HeroButtonGroup } from "@heroui/react";

/**
 * Button Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc từ @heroui/react,
 * thiết lập các default settings (variant, size, className) cho đồng bộ toàn hệ thống.
 */
export const Button = ({
    children,
    variant = "primary",
    size = "sm",
    ...props
}) => {
    return (
        <HeroButton
            variant={variant}
            size={size}
            {...props}
        >
            {children}
        </HeroButton>
    );
};

export const ButtonGroup = ({
    children,
    variant = "primary",
    size = "sm",
    ...props
}) => {
    return (
        <HeroButtonGroup
            variant={variant}
            size={size}
            {...props}
        >
            {children}
        </HeroButtonGroup>
    );
};

Button.Group = ButtonGroup;

export default Button;
