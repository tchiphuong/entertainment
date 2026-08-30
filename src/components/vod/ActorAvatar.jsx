import { useState, useEffect, memo } from "react";
import { TMDB_IMAGE_BASE_URL, TMDB_IMAGE_SIZES } from "../../constants";
import { wikiService } from "../../services/vod/wikiService";

/**
 * Component hiển thị Avatar diễn viên thông minh:
 * 1. Ưu tiên ảnh chính chủ từ TMDB (size h632 siêu nét).
 * 2. Tự động fallback sang Wikipedia / Wikimedia Commons API khi không có TMDB profile.
 * 3. Fallback về chữ cái đầu tiên trong khung tối sang trọng nếu cả 2 nguồn đều không có.
 */
function ActorAvatar({ name, profilePath, className = "" }) {
    const [wikiSrc, setWikiSrc] = useState(null);
    const [hasError, setHasError] = useState(false);

    const tmdbSrc = profilePath
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.PROFILE}/${profilePath}`
        : null;

    useEffect(() => {
        let isMounted = true;

        if (!profilePath && name) {
            wikiService.fetchWikiActorImage(name).then((url) => {
                if (isMounted && url) {
                    setWikiSrc(url);
                }
            });
        }

        return () => {
            isMounted = false;
        };
    }, [profilePath, name]);

    const activeSrc = tmdbSrc || wikiSrc;

    if (activeSrc && !hasError) {
        return (
            <img
                loading="lazy"
                src={activeSrc}
                alt={name || "Diễn viên"}
                onError={() => setHasError(true)}
                className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${className}`}
            />
        );
    }

    const initialLetter = name?.trim() ? name.trim().charAt(0).toUpperCase() : "?";

    return (
        <div className="flex h-full w-full items-center justify-center border border-zinc-800 bg-zinc-900 text-2xl font-black text-zinc-600 transition-colors duration-300 group-hover:text-red-500">
            {initialLetter}
        </div>
    );
}

export default memo(ActorAvatar);
