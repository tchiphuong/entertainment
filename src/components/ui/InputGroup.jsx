import { InputGroup as HeroInputGroup } from "@heroui/react";

/**
 * InputGroup Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc từ @heroui/react:
 * InputGroup, InputGroup.Input, InputGroup.Prefix, InputGroup.Suffix, InputGroup.Text, InputGroup.Button
 */
export const InputGroup = ({
    children,
    size = "sm",
    className = "",
    ...props
}) => {
    return (
        <HeroInputGroup
            size={size}
            className={className}
            {...props}
        >
            {children}
        </HeroInputGroup>
    );
};

InputGroup.Input = HeroInputGroup.Input;
InputGroup.Prefix = HeroInputGroup.Prefix;
InputGroup.Suffix = HeroInputGroup.Suffix;
InputGroup.Text = HeroInputGroup.Text;
InputGroup.Button = HeroInputGroup.Button;

export default InputGroup;
