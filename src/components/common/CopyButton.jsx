import { useState, useCallback } from "react";
import {
    ClipboardDocumentIcon,
    ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../ui";

/**
 * Nút sao chép văn bản vào clipboard với phản hồi giao diện trực quan
 */
export const CopyButton = ({
    textToCopy,
    label,
    copiedLabel,
    variant = "secondary",
    size = "sm",
    className = "",
    labelClassName = "",
    title = "Sao chép",
    onCopied,
    children,
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        if (!textToCopy && typeof textToCopy !== "string") return;
        navigator.clipboard.writeText(String(textToCopy));
        setCopied(true);
        if (onCopied) onCopied();

        const timer = setTimeout(() => {
            setCopied(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, [textToCopy, onCopied]);

    const displayLabel = copied ? (copiedLabel || label) : label;

    return (
        <Button
            onPress={handleCopy}
            variant={variant}
            size={size}
            className={`gap-1.5 ${className}`}
            title={title}
        >
            {copied ? (
                <ClipboardDocumentCheckIcon className="h-4 w-4 shrink-0 text-emerald-400 stroke-2" />
            ) : (
                <ClipboardDocumentIcon className="h-4 w-4 shrink-0 stroke-2" />
            )}
            {children || (displayLabel && <span className={labelClassName}>{displayLabel}</span>)}
        </Button>
    );
};

export default CopyButton;
