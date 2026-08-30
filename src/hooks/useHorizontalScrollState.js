import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook quản lý trạng thái cuộn ngang thông minh cho danh sách carousel/horizontal rows.
 * Tự động kiểm tra overflow và xác định khả năng cuộn trái/phải (canScrollLeft, canScrollRight).
 */
export function useHorizontalScrollState(dependencyList = [], customRef = null) {
    const internalRef = useRef(null);
    const scrollRef = customRef || internalRef;
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }

        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = scrollWidth - clientWidth;

        // Chỉ có thể cuộn nếu nội dung thực sự tràn ra ngoài (sai số 4px)
        const hasScrollableContent = maxScrollLeft > 4;

        setCanScrollLeft(hasScrollableContent && scrollLeft > 4);
        setCanScrollRight(hasScrollableContent && scrollLeft < maxScrollLeft - 4);
    }, [scrollRef]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        updateScrollState();

        // Lắng nghe sự kiện cuộn
        el.addEventListener("scroll", updateScrollState, { passive: true });

        // Lắng nghe thay đổi kích thước DOM của container
        let resizeObserver;
        if (typeof window !== "undefined" && window.ResizeObserver) {
            resizeObserver = new window.ResizeObserver(() => {
                updateScrollState();
            });
            resizeObserver.observe(el);
        }

        // Kiểm tra sau khi các hình ảnh / asset tải xong
        const timer1 = setTimeout(updateScrollState, 150);
        const timer2 = setTimeout(updateScrollState, 500);

        return () => {
            el.removeEventListener("scroll", updateScrollState);
            if (resizeObserver) resizeObserver.disconnect();
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [updateScrollState, ...dependencyList]);

    const scrollLeft = useCallback((ratio = 0.8) => {
        if (scrollRef.current) {
            const amount = scrollRef.current.clientWidth * ratio;
            scrollRef.current.scrollBy({ left: -amount, behavior: "smooth" });
        }
    }, [scrollRef]);

    const scrollRight = useCallback((ratio = 0.8) => {
        if (scrollRef.current) {
            const amount = scrollRef.current.clientWidth * ratio;
            scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
        }
    }, [scrollRef]);

    return {
        scrollRef,
        canScrollLeft,
        canScrollRight,
        hasOverflow: canScrollLeft || canScrollRight,
        scrollLeft,
        scrollRight,
        updateScrollState,
    };
}

export default useHorizontalScrollState;
