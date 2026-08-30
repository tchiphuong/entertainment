import { Badge as HeroBadge } from "@heroui/react";

/**
 * Badge Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc:
 * Badge, Badge.Anchor, Badge.Label
 */
export const Badge = ({
    children,
    color = "accent",
    size = "md",
    variant = "primary",
    className = "",
    ...props
}) => {
    return (
        <HeroBadge
            color={color}
            size={size}
            variant={variant}
            className={className}
            {...props}
        >
            {children}
        </HeroBadge>
    );
};

Badge.Anchor = HeroBadge.Anchor;
Badge.Label = HeroBadge.Label;

export default Badge;
