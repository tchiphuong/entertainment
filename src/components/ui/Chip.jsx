import { Chip as HeroChip } from "@heroui/react";

/**
 * Chip Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc:
 * Chip, Chip.Label
 */
export const Chip = ({
    children,
    color = "default",
    size = "sm",
    variant = "secondary",
    className = "",
    ...props
}) => {
    return (
        <HeroChip
            color={color}
            size={size}
            variant={variant}
            className={className}
            {...props}
        >
            {children}
        </HeroChip>
    );
};

Chip.Label = HeroChip.Label;

export default Chip;
