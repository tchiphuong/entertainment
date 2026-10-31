import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    FilmIcon,
    ServerIcon,
    PlayIcon,
    CheckIcon,
} from "@heroicons/react/24/outline";
import { Modal, Button } from "../../ui";
import { fetchSourceData } from "../../../services/vod/vodService";
import { SOURCES } from "../../../constants";

const EpisodeGrid = ({ episodes = [], currentEpisode, serverName, onSelect }) => {
    return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 max-h-64 overflow-y-auto pr-1">
            {episodes.map((ep, idx) => {
                const isActive = currentEpisode?.name === ep.name || currentEpisode?.slug === ep.slug;
                return (
                    <Button
                        key={ep.slug || `ep_${idx}`}
                        variant={isActive ? "primary" : "secondary"}
                        size="sm"
                        onPress={() => onSelect({ ...ep, server_name: serverName })}
                        className={`h-9 px-2 text-xs truncate ${
                            isActive ? "font-bold ring-1 ring-red-500" : ""
                        }`}
                    >
                        {isActive ? (
                            <CheckIcon className="h-3.5 w-3.5 shrink-0 stroke-2" />
                        ) : (
                            <PlayIcon className="h-3 w-3 shrink-0 opacity-60" />
                        )}
                        <span className="truncate">{ep.name}</span>
                    </Button>
                );
            })}
        </div>
    );
};

const ServerTabs = ({ servers = [], activeServerIdx, onSelectServer }) => {
    const { t } = useTranslation();
    if (servers.length <= 1) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 pb-3">
            <div className="mr-1 flex items-center gap-1 text-xs font-semibold text-zinc-400">
                <ServerIcon className="h-3.5 w-3.5 stroke-2" />
                <span>{t("vodPlay.source", { defaultValue: "Nguồn:" })}</span>
            </div>
            {servers.map((srv, idx) => (
                <Button
                    key={srv.server_name || idx}
                    size="sm"
                    variant={activeServerIdx === idx ? "primary" : "secondary"}
                    onPress={() => onSelectServer(idx)}
                    className="h-7 px-2.5 text-xs"
                >
                    {srv.server_name || `Server ${idx + 1}`}
                </Button>
            ))}
        </div>
    );
};

const EpisodeModalContent = ({
    isLoading,
    servers,
    activeServerIdx,
    setActiveServerIdx,
    currentEpisode,
    onSelect,
    t,
}) => {
    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
                <span>{t("common.loading", { defaultValue: "Đang tải danh sách tập..." })}</span>
            </div>
        );
    }

    if (servers.length === 0) {
        return (
            <div className="flex h-32 flex-col items-center justify-center text-xs text-zinc-500">
                <FilmIcon className="h-8 w-8 stroke-1 opacity-50" />
                <span className="mt-2">{t("vodPlay.noEpisodes", { defaultValue: "Chưa có danh sách tập." })}</span>
            </div>
        );
    }

    const activeServer = servers[activeServerIdx] || servers[0];
    const episodeList = activeServer?.server_data || [];

    return (
        <div className="space-y-4">
            <ServerTabs
                servers={servers}
                activeServerIdx={activeServerIdx}
                onSelectServer={setActiveServerIdx}
            />

            <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                        {activeServer?.server_name || "Vietsub"} ({episodeList.length} {t("vodPlay.episodesSuffix", { defaultValue: "tập" })})
                    </span>
                    <span className="text-[11px] text-zinc-500">
                        {t("vodPlay.playing", { defaultValue: "Đang phát" })}: <strong className="text-white">{currentEpisode?.name || t("common.updating", { defaultValue: "Đang cập nhật" })}</strong>
                    </span>
                </div>

                <EpisodeGrid
                    episodes={episodeList}
                    currentEpisode={currentEpisode}
                    serverName={activeServer?.server_name || "Vietsub"}
                    onSelect={onSelect}
                />
            </div>
        </div>
    );
};

export const WatchPartyEpisodeModal = ({
    isOpen,
    onOpenChange,
    movie,
    currentEpisode,
    onSelectEpisode,
}) => {
    const { t } = useTranslation();
    const [servers, setServers] = useState([]);
    const [activeServerIdx, setActiveServerIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !movie?.slug) return;
        let isMounted = true;
        setIsLoading(true);

        fetchSourceData(movie.slug, SOURCES.SOURCE_K)
            .then((data) => {
                if (!isMounted) return;
                setServers(data?.episodes || []);
                setIsLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setServers([]);
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, movie?.slug]);

    const handleSelect = (ep) => {
        onSelectEpisode(ep);
        onOpenChange(false);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container size="lg">
                <Modal.Dialog aria-label={t("watchParty.episodeModal.title", { defaultValue: "Chọn tập phim xem chung" })}>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-red-500">
                                <FilmIcon className="h-5 w-5 stroke-2" />
                            </div>
                            <div>
                                <Modal.Heading className="text-base font-bold text-white">
                                    {t("vodPlay.episodes", { defaultValue: "Danh sách tập phim" })}
                                </Modal.Heading>
                                <p className="text-[11px] text-zinc-400">
                                    {movie?.name || t("watchParty.episodeModal.selectDesc", { defaultValue: "Chọn tập để cả phòng cùng theo dõi" })}
                                </p>
                            </div>
                        </div>
                    </Modal.Header>

                    <Modal.Body>
                        <EpisodeModalContent
                            isLoading={isLoading}
                            servers={servers}
                            activeServerIdx={activeServerIdx}
                            setActiveServerIdx={setActiveServerIdx}
                            currentEpisode={currentEpisode}
                            onSelect={handleSelect}
                            t={t}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <div className="flex justify-end">
                            <Button
                                onPress={() => onOpenChange(false)}
                                variant="secondary"
                                size="sm"
                            >
                                {t("common.close", { defaultValue: "Đóng" })}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
