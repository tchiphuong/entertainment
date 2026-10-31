import {
    ArrowTopRightOnSquareIcon,
    PencilSquareIcon,
    PlusIcon,
    VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../ui";
import { CopyButton } from "../../common";

export const WatchPartyMeetBanner = ({
    meetUrl,
    isHost,
    onOpenMeetModal,
}) => {
    if (!meetUrl) {
        if (!isHost) return null;
        return (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-2.5 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5 shrink-0 stroke-2 text-emerald-400" />
                    <span>Muốn gọi thoại nhóm ngoài? Dán liên kết phòng họp trực tuyến để bạn bè cùng tham gia.</span>
                </div>
                <Button
                    type="button"
                    onPress={onOpenMeetModal}
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                >
                    <PlusIcon className="h-3.5 w-3.5 stroke-2" />
                    <span>Dán link phòng họp</span>
                </Button>
            </div>
        );
    }

    return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-white shadow-lg">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400">
                    <VideoCameraIcon className="h-6 w-6 shrink-0 stroke-2" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Phòng họp trực tuyến
                        </span>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <a
                        href={meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-1 max-w-[280px] sm:max-w-md text-xs text-zinc-300 hover:text-white hover:underline font-mono"
                        title={meetUrl}
                    >
                        {meetUrl}
                    </a>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <CopyButton
                    textToCopy={meetUrl}
                    label="Sao chép"
                    copiedLabel="Đã chép"
                    title="Sao chép liên kết cuộc họp"
                />

                {isHost && (
                    <Button
                        type="button"
                        onPress={onOpenMeetModal}
                        variant="secondary"
                        size="sm"
                        title="Đổi đường link cuộc họp"
                    >
                        <PencilSquareIcon className="h-3.5 w-3.5 stroke-2" />
                        <span className="hidden sm:inline">Đổi link</span>
                    </Button>
                )}

                <Button
                    type="button"
                    onPress={() => window.open(meetUrl, "_blank", "noopener,noreferrer")}
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 border-none text-white font-bold"
                >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 stroke-2" />
                    <span>Vào phòng họp</span>
                </Button>
            </div>
        </div>
    );
};
