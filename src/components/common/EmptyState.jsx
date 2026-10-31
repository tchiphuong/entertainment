import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "../ui";

const VARIANT_ICON_STYLES = {
    default: "bg-zinc-900 text-zinc-500 border border-zinc-800",
    error: "bg-red-950/40 text-red-500 border border-red-900/50",
    warning: "bg-amber-950/40 text-amber-500 border border-amber-900/50",
};

const EmptyStateActions = ({
    actionLabel,
    onAction,
    actionIcon: ActionIcon,
    secondaryActionLabel,
    onSecondaryAction,
    children,
}) => {
    const hasAnyAction = Boolean(actionLabel || secondaryActionLabel || children);
    if (!hasAnyAction) return null;

    return (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {actionLabel && onAction && (
                <Button onPress={onAction} variant="primary" size="md" className="gap-2">
                    {ActionIcon && <ActionIcon className="h-4 w-4 stroke-2" />}
                    <span>{actionLabel}</span>
                </Button>
            )}

            {secondaryActionLabel && onSecondaryAction && (
                <Button onPress={onSecondaryAction} variant="secondary" size="md">
                    <span>{secondaryActionLabel}</span>
                </Button>
            )}

            {children}
        </div>
    );
};

/**
 * Component hiển thị trạng thái rỗng / lỗi / thông báo dùng chung
 */
export const EmptyState = ({
    icon: CustomIcon,
    title,
    description,
    actionLabel,
    onAction,
    actionIcon,
    secondaryActionLabel,
    onSecondaryAction,
    variant = "default",
    className = "",
    minHeight = "min-h-[40vh]",
    children,
}) => {
    const IconComponent = CustomIcon || ExclamationTriangleIcon;
    const iconStyle = VARIANT_ICON_STYLES[variant] || VARIANT_ICON_STYLES.default;

    return (
        <div className={`flex flex-col items-center justify-center p-6 text-center text-white ${minHeight} ${className}`}>
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner ${iconStyle}`}>
                <IconComponent className="h-8 w-8 stroke-1.5" />
            </div>

            {title && (
                <h3 className="mt-4 text-lg font-bold text-white tracking-tight">
                    {title}
                </h3>
            )}

            {description && (
                <p className="mt-2 max-w-md text-xs text-zinc-400 leading-relaxed">
                    {description}
                </p>
            )}

            <EmptyStateActions
                actionLabel={actionLabel}
                onAction={onAction}
                actionIcon={actionIcon}
                secondaryActionLabel={secondaryActionLabel}
                onSecondaryAction={onSecondaryAction}
            >
                {children}
            </EmptyStateActions>
        </div>
    );
};

export default EmptyState;
