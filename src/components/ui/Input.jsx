import { forwardRef } from "react";
import { Input as HeroInput } from "@heroui/react";

export {
    TextField,
    Label,
    Description,
    FieldError,
} from "@heroui/react";

/**
 * Input Component (HeroUI v3)
 * Giữ nguyên tên, anatomy và style gốc của HeroUI Input
 */
export const Input = forwardRef(
    (
        {
            variant = "secondary",
            fullWidth = true,
            className = "",
            ...props
        },
        ref,
    ) => {
        return (
            <HeroInput
                ref={ref}
                variant={variant}
                fullWidth={fullWidth}
                className={className}
                {...props}
            />
        );
    },
);

Input.displayName = "Input";

export default Input;
