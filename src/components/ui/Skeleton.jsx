import { Skeleton as HeroSkeleton } from "@heroui/react";

/**
 * Skeleton Component (HeroUI v3)
 * Giữ nguyên tên và props gốc của HeroUI Skeleton
 */
export const Skeleton = ({
    children,
    className = "",
    ...props
}) => {
    return (
        <HeroSkeleton
            className={`rounded-lg bg-zinc-800/60 ${className}`}
            {...props}
        >
            {children}
        </HeroSkeleton>
    );
};

export default Skeleton;
