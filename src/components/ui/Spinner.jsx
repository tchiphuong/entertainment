import { Spinner as HeroSpinner } from "@heroui/react";

/**
 * Spinner Component (HeroUI v3)
 * Giữ nguyên 100% tên và props gốc, set color="danger" và size="md" mặc định
 */
export const Spinner = ({
    color = "danger",
    size = "md",
    className = "",
    ...props
}) => {
    return (
        <HeroSpinner
            color={color}
            size={size}
            className={className}
            {...props}
        />
    );
};

export default Spinner;
