import React, { createContext, useContext, useMemo, useState } from "react";
import { switchVariants, switchGroupVariants } from "@heroui/styles";

const SwitchContext = createContext({});

/**
 * Switch Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc của HeroUI:
 * Switch, Switch.Content, Switch.Control, Switch.Thumb, Switch.Icon, SwitchGroup
 * Sử dụng switchVariants từ @heroui/styles, không thêm class tùy biến vào component có sẵn
 */
export const Switch = ({
    children,
    isSelected: controlledSelected,
    defaultSelected = false,
    onChange,
    size = "sm",
    isDisabled = false,
    className = "",
    ...props
}) => {
    const [uncontrolledSelected, setUncontrolledSelected] = useState(defaultSelected);
    const isControlled = controlledSelected !== undefined;
    const isSelected = isControlled ? controlledSelected : uncontrolledSelected;

    const toggle = () => {
        if (isDisabled) return;
        const next = !isSelected;
        if (!isControlled) {
            setUncontrolledSelected(next);
        }
        if (onChange) {
            onChange(next);
        }
    };

    const slots = useMemo(() => switchVariants({ size }), [size]);

    return (
        <SwitchContext.Provider value={{ slots, isSelected, isDisabled, toggle }}>
            <div
                data-slot="switch"
                data-selected={isSelected}
                data-disabled={isDisabled}
                className={slots.base({ className })}
                onClick={toggle}
                role="switch"
                aria-checked={isSelected}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : 0}
                onKeyDown={(e) => {
                    if ([" ", "Enter"].includes(e.key)) {
                        e.preventDefault();
                        toggle();
                    }
                }}
                {...props}
            >
                {typeof children === "function" ? children({ isSelected, isDisabled }) : children}
            </div>
        </SwitchContext.Provider>
    );
};

Switch.displayName = "HeroUI.Switch";

const SwitchContent = ({ children, className = "", ...props }) => {
    const { slots } = useContext(SwitchContext);
    return (
        <div
            data-slot="switch-content"
            className={slots?.content ? slots.content({ className }) : className}
            {...props}
        >
            {children}
        </div>
    );
};

SwitchContent.displayName = "HeroUI.Switch.Content";

const SwitchControl = ({ children, className = "", ...props }) => {
    const { slots, isSelected, isDisabled } = useContext(SwitchContext);
    return (
        <span
            data-slot="switch-control"
            data-selected={isSelected}
            data-disabled={isDisabled}
            className={slots?.control ? slots.control({ className }) : className}
            {...props}
        >
            {children}
        </span>
    );
};

SwitchControl.displayName = "HeroUI.Switch.Control";

const SwitchThumb = ({ children, className = "", ...props }) => {
    const { slots } = useContext(SwitchContext);
    return (
        <span
            data-slot="switch-thumb"
            className={slots?.thumb ? slots.thumb({ className }) : className}
            {...props}
        >
            {children}
        </span>
    );
};

SwitchThumb.displayName = "HeroUI.Switch.Thumb";

const SwitchIcon = ({ children, className = "", ...props }) => {
    const { slots } = useContext(SwitchContext);
    return (
        <span
            data-slot="switch-icon"
            className={slots?.icon ? slots.icon({ className }) : className}
            {...props}
        >
            {children}
        </span>
    );
};

SwitchIcon.displayName = "HeroUI.Switch.Icon";

export const SwitchGroup = ({
    children,
    orientation = "vertical",
    className = "",
    ...props
}) => {
    const slots = useMemo(() => switchGroupVariants({ orientation }), [orientation]);
    return (
        <div
            data-slot="switch-group"
            data-orientation={orientation}
            className={slots.base({ className })}
            {...props}
        >
            {children}
        </div>
    );
};

SwitchGroup.displayName = "HeroUI.SwitchGroup";

Switch.Content = SwitchContent;
Switch.Control = SwitchControl;
Switch.Thumb = SwitchThumb;
Switch.Icon = SwitchIcon;
Switch.Group = SwitchGroup;

export default Switch;
