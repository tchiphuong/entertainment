import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    FilmIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    ArrowPathIcon,
    XMarkIcon,
    LinkIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button } from "../../ui";
import { searchSourceK, fetchSourceData } from "../../../services/vod/vodService";
import { SOURCES } from "../../../constants";
import { createCustomStreamPayload } from "../../../utils/watchPartyUtils";

const StreamInputSection = ({
    streamUrl,
    setStreamUrl,
    streamTitle,
    setStreamTitle,
    onSubmit,
    isSubmitting,
}) => (
    <div className="space-y-3 pt-1">
        <div>
            <div className="flex items-center justify-between">
                <label htmlFor="change-stream-url" className="block text-xs font-semibold text-zinc-300">
                    Đường dẫn luồng Stream (.m3u8 / .mpd) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-medium">HLS & DASH</span>
            </div>
            <div className="relative mt-1.5 flex items-center">
                <div className="pointer-events-none absolute left-3 text-zinc-500">
                    <LinkIcon className="h-4 w-4 stroke-2" />
                </div>
                <input
                    id="change-stream-url"
                    type="url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u8 hoặc manifest.mpd"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                    autoFocus
                />
            </div>
        </div>

        <div>
            <label htmlFor="change-stream-title" className="block text-xs font-semibold text-zinc-300">
                Tên phòng / Tên video (tùy chọn)
            </label>
            <div className="relative mt-1.5 flex items-center">
                <div className="pointer-events-none absolute left-3 text-zinc-500">
                    <FilmIcon className="h-4 w-4 stroke-2" />
                </div>
                <input
                    id="change-stream-title"
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    placeholder="VD: Trực tiếp bóng đá, Video cá nhân..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                />
            </div>
        </div>

        <Button
            type="button"
            variant="primary"
            size="md"
            onPress={onSubmit}
            className="w-full mt-2"
            disabled={!streamUrl.trim() || isSubmitting}
        >
            {isSubmitting ? (
                <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Đang nạp luồng stream...</span>
                </>
            ) : (
                <>
                    <CheckIcon className="h-4 w-4 stroke-2" />
                    <span>Đổi sang luồng này</span>
                </>
            )}
        </Button>
    </div>
);

const MovieResultCard = ({ movie, isSelecting, onSelect }) => {
    const posterUrl = movie.thumb_url || movie.poster_url;
    const year = movie.year || "";
    const originalName = movie.origin_name || "";

    return (
        <button
            type="button"
            disabled={isSelecting}
            onClick={() => onSelect(movie)}
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-[0.99] disabled:opacity-50"
        >
            <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt={movie.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        <FilmIcon className="h-5 w-5" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white truncate">{movie.name}</div>
                {originalName && (
                    <div className="text-xs text-zinc-400 truncate">{originalName}</div>
                )}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                    {year && <span className="rounded bg-zinc-800 px-1.5 py-0.2">{year}</span>}
                    {movie.time && <span>{movie.time}</span>}
                </div>
            </div>

            <Button
                variant="secondary"
                size="sm"
                isDisabled={isSelecting}
                className="shrink-0 text-xs gap-1"
            >
                {isSelecting ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <CheckIcon className="h-3.5 w-3.5" />
                )}
                <span>Chọn</span>
            </Button>
        </button>
    );
};

export const WatchPartyChangeMovieModal = ({
    isOpen,
    onOpenChange,
    currentMovie,
    onSelectMovie,
}) => {
    const { t } = useTranslation();
    const [tabMode, setTabMode] = useState("search");
    const [keyword, setKeyword] = useState("");
    const [streamUrl, setStreamUrl] = useState("");
    const [streamTitle, setStreamTitle] = useState("");
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectingSlug, setSelectingSlug] = useState(null);
    const [isSelectingStream, setIsSelectingStream] = useState(false);

    // Tự động tìm kiếm với debounce 400ms
    useEffect(() => {
        if (!isOpen) {
            setKeyword("");
            setStreamUrl("");
            setStreamTitle("");
            setResults([]);
            return;
        }

        if (tabMode !== "search") return;
        const clean = keyword.trim();
        if (!clean) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const items = await searchSourceK(clean);
                setResults(Array.isArray(items) ? items : []);
            } catch {
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [keyword, isOpen, tabMode]);

    const handleSelectStream = async () => {
        const cleanUrl = streamUrl.trim();
        if (!cleanUrl) return;
        setIsSelectingStream(true);
        try {
            const payload = createCustomStreamPayload(cleanUrl, streamTitle);
            await onSelectMovie?.(payload.movie, payload.episode);
            onOpenChange?.(false);
        } catch (err) {
            console.warn("Lỗi nạp luồng stream:", err);
        } finally {
            setIsSelectingStream(false);
        }
    };

    const handleSelect = async (movie) => {
        if (!movie?.slug) return;
        setSelectingSlug(movie.slug);

        try {
            // Lấy danh sách server và tập đầu tiên của phim mới
            const res = await fetchSourceData(movie.slug, SOURCES.SOURCE_K);
            const firstServer = res?.episodes?.[0];
            const firstEp = firstServer?.server_data?.[0] || null;

            const selectedEp = firstEp
                ? { ...firstEp, server_name: firstServer?.server_name || "Vietsub" }
                : null;

            await onSelectMovie?.(movie, selectedEp);
            onOpenChange?.(false);
        } catch (err) {
            console.warn("Lỗi chọn phim mới:", err);
        } finally {
            setSelectingSlug(null);
        }
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog aria-label={t("watchParty.changeMovie.title", { defaultValue: "Đổi phim cho phòng xem chung" })}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <FilmIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <div>
                                <Modal.Heading className="text-base font-bold text-white">
                                    {t("watchParty.changeMovie.title", { defaultValue: "Đổi phim hoặc luồng xem" })}
                                </Modal.Heading>
                                {currentMovie?.name && (
                                    <p className="text-[11px] text-zinc-400 truncate max-w-sm">
                                        Đang xem: <span className="text-zinc-300 font-semibold">{currentMovie.name}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <div className="space-y-3">
                            {/* Bộ chuyển tab: Kho phim vs Dán link Stream */}
                            <div className="flex rounded-xl border border-zinc-800 bg-zinc-900/80 p-1">
                                <button
                                    type="button"
                                    onClick={() => setTabMode("search")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                        tabMode === "search"
                                            ? "bg-zinc-800 text-white shadow-sm"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <FilmIcon className="h-3.5 w-3.5 stroke-2" />
                                    <span>Kho phim</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTabMode("stream")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                        tabMode === "stream"
                                            ? "bg-red-600 text-white shadow-sm"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <LinkIcon className="h-3.5 w-3.5 stroke-2" />
                                    <span>Dán link M3U8 / MPD</span>
                                </button>
                            </div>

                            {tabMode === "stream" ? (
                                <StreamInputSection
                                    streamUrl={streamUrl}
                                    setStreamUrl={setStreamUrl}
                                    streamTitle={streamTitle}
                                    setStreamTitle={setStreamTitle}
                                    onSubmit={handleSelectStream}
                                    isSubmitting={isSelectingStream}
                                />
                            ) : (
                                <>
                                    {/* Ô tìm kiếm phim */}
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                                            <MagnifyingGlassIcon className="h-4 w-4 stroke-2" />
                                        </div>
                                        <input
                                            type="text"
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
                                            placeholder={t("watchParty.changeMovie.placeholder", { defaultValue: "Nhập tên phim muốn đổi..." })}
                                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-9 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                            autoFocus
                                        />
                                        {keyword && (
                                            <button
                                                type="button"
                                                onClick={() => setKeyword("")}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-white"
                                            >
                                                <XMarkIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Danh sách kết quả */}
                                    <div className="max-h-72 min-h-[140px] space-y-2 overflow-y-auto pr-1">
                                        {isLoading ? (
                                            <div className="flex h-32 flex-col items-center justify-center text-zinc-400">
                                                <ArrowPathIcon className="h-6 w-6 animate-spin text-red-500" />
                                                <span className="mt-2 text-xs">Đang tìm kiếm phim...</span>
                                            </div>
                                        ) : results.length > 0 ? (
                                            results.map((m) => (
                                                <MovieResultCard
                                                    key={m.slug || m._id}
                                                    movie={m}
                                                    isSelecting={selectingSlug === m.slug}
                                                    onSelect={handleSelect}
                                                />
                                            ))
                                        ) : keyword.trim() ? (
                                            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-zinc-500">
                                                Không tìm thấy phim phù hợp với từ khóa "{keyword}".
                                            </div>
                                        ) : (
                                            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-zinc-500">
                                                Nhập từ khóa để tìm phim và đổi cho cả phòng cùng xem.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

export default WatchPartyChangeMovieModal;
