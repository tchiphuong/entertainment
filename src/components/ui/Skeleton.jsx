import React from "react";

/**
 * Component Skeleton cơ bản mang hiệu ứng Shimmer (lấp lánh) hiện đại.
 */
export default function Skeleton({ className = "", variant = "rect" }) {
    const variants = {
        rect: "rounded-md",
        circle: "rounded-full",
        text: "rounded h-4 w-full"
    };

    return (
        <div 
            className={`animate-pulse bg-zinc-800/50 ${variants[variant]} ${className}`}
            style={{
                backgroundImage: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite linear'
            }}
        />
    );
}
