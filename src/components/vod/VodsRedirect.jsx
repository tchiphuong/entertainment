import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Spinner } from "../ui";

/**
 * Component hiển thị đếm ngược 3 2 1 trước khi tự động chuyển hướng từ các route /vods cũ sang /vod mới.
 */
export default function VodsRedirect() {
    const location = useLocation();
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(3);

    const targetPath = useMemo(() => {
        let path = location.pathname.replace(/^\/vods\/?/, "/vod/");
        if (
            location.pathname === "/vods" ||
            location.pathname === "/vods/" ||
            location.pathname === "/vods/browse"
        ) {
            path = "/vod";
        }
        const cleanPath = path.replace(/\/+$/, "") || "/vod";
        return `${cleanPath}${location.search}${location.hash}`;
    }, [location.pathname, location.search, location.hash]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate(targetPath, { replace: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [navigate, targetPath]);

    const handleImmediateNavigate = () => {
        navigate(targetPath, { replace: true });
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-4 text-white selection:bg-red-600/30">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl backdrop-blur-md">
                {/* Icon chuyển hướng HeroUI Spinner */}
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
                    <Spinner size="lg" color="danger" />
                </div>

                <h1 className="text-xl font-extrabold tracking-tight text-zinc-100">
                    Đang chuyển hướng
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                    Hệ thống xem phim đã được nâng cấp sang giao diện mới. Đang tự động chuyển trang sau:
                </p>

                {/* Vòng đếm ngược 3 2 1 */}
                <div className="my-6 flex items-center justify-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-600 bg-red-600/10 text-4xl font-black text-red-500 shadow-lg shadow-red-600/20 transition-all">
                        {countdown}
                    </span>
                </div>

                {/* Nút bấm chuyển ngay HeroUI Button */}
                <Button
                    variant="primary"
                    size="lg"
                    onPress={handleImmediateNavigate}
                    className="w-full font-bold shadow-lg"
                >
                    Chuyển ngay bây giờ
                </Button>
            </div>
        </div>
    );
}
