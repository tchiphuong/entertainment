import { useState, useEffect, useRef } from "react";

/**
 * LazySection - Component tối ưu hiệu năng giúp trì hoãn render các phần tử ngoài viewport
 * Chỉ mount nội dung khi người dùng cuộn đến gần khu vực hiển thị.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children - Nội dung cần hiển thị khi vào tầm nhìn
 * @param {import("react").ReactNode} [props.fallback=null] - Giao diện giữ chỗ (skeleton/placeholder)
 * @param {string} [props.rootMargin="250px"] - Khoảng cách đệm trước khi kích hoạt tải
 * @param {string} [props.minHeight="auto"] - Chiều cao tối thiểu tránh hiện tượng giật layout (CLS)
 * @param {string} [props.className=""] - Lớp CSS tùy biến
 */
export function LazySection({
    children,
    fallback = null,
    rootMargin = "250px",
    minHeight = "auto",
    className = "",
}) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (isVisible) return;

        // Fallback an toàn nếu môi trường không hỗ trợ IntersectionObserver
        if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
            setIsVisible(true);
            return;
        }

        const currentElem = containerRef.current;
        if (!currentElem) return;

        const observer = new window.IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin }
        );

        observer.observe(currentElem);

        return () => {
            observer.disconnect();
        };
    }, [isVisible, rootMargin]);

    const wrapperStyle = !isVisible && minHeight !== "auto" ? { minHeight } : undefined;

    return (
        <div
            ref={containerRef}
            className={className}
            style={wrapperStyle}
        >
            {isVisible ? children : fallback}
        </div>
    );
}

export default LazySection;
