import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    UsersIcon,
    ArrowRightIcon,
    PlusIcon,
    ChatBubbleLeftRightIcon,
    VideoCameraIcon,
    TrashIcon,
    ArrowPathIcon,
    QrCodeIcon,
    CameraIcon,
    LockClosedIcon,
    FilmIcon,
    LinkIcon,
    ExclamationTriangleIcon,
    PencilSquareIcon,
} from "@heroicons/react/24/outline";
import VodLayout from "../../components/layout/VodLayout";
import { Button } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import {
    generateRoomCode,
    parseRoomCodeFromText,
    createWatchPartyRoom,
    getWatchPartyRoom,
    hashWatchPartyPassword,
    verifyWatchPartyPassword,
} from "../../services/vod/watchPartyService";
import { ROUTES, getWatchPartyRoomPath } from "../../constants";
import { WatchPartyScannerModal } from "../../components/vod/watchparty/WatchPartyScannerModal";
import { WatchPartyQRModal } from "../../components/vod/watchparty/WatchPartyQRModal";
import { WatchPartyActiveRooms } from "../../components/vod/watchparty/WatchPartyActiveRooms";
import { WatchPartyPasswordModal } from "../../components/vod/watchparty/WatchPartyPasswordModal";
import { WatchPartyNameModal } from "../../components/vod/watchparty/WatchPartyNameModal";
import { getGuestProfile, setGuestName } from "../../utils/watchPartyGuest";
import { resolveMovieAndEpisodePayload } from "../../utils/watchPartyUtils";

const PrefillMovieBanner = ({ movie, episode, t }) => {
    if (!movie) return null;
    const thumb = movie.thumb_url || movie.poster_url;
    return (
        <div className="flex items-center gap-3 rounded-xl border border-red-600/30 bg-zinc-900/90 p-2.5">
            {thumb && (
                <img
                    src={thumb}
                    alt={movie.name}
                    className="h-12 w-9 rounded-lg object-cover border border-zinc-800"
                />
            )}
            <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                    {t ? t("watchParty.lobby.selectedMovie") : "Phim đã chọn xem"}
                </span>
                <p className="truncate text-xs font-bold text-white">
                    {movie.name}
                </p>
                {episode?.name && (
                    <p className="text-[11px] text-zinc-400">
                        {episode.name} • {episode.server_name || "Vietsub"}
                    </p>
                )}
            </div>
        </div>
    );
};

const CreateRoomErrorAlert = ({ error, t }) => {
    if (!error) return null;
    return (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300 shadow-md">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
                <ExclamationTriangleIcon className="h-4 w-4 stroke-2" />
                <span>{t ? t("watchParty.lobby.createErrorTitle") : "Lỗi tạo phòng"}</span>
            </div>
            <p className="mt-1 leading-relaxed text-zinc-300">{error}</p>
        </div>
    );
};



const GuestIdentityBanner = ({ currentUser, guestName, onOpenChangeName, t }) => {
    if (currentUser) {
        return (
            <div className="mt-6 flex items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{t("watchParty.lobby.loggedInAs", { defaultValue: "Tài khoản:" })}</span>
                    <span className="font-bold text-white">{currentUser.displayName || currentUser.email}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6 flex items-center justify-center">
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>{t("watchParty.lobby.guestGreeting", { defaultValue: "Xem với tên:" })}</span>
                <span className="font-bold text-white">{guestName}</span>
                <Button
                    type="button"
                    onPress={onOpenChangeName}
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                >
                    <PencilSquareIcon className="h-3.5 w-3.5 text-zinc-400 stroke-2" />
                    <span>{t("common.edit", { defaultValue: "Đổi tên" })}</span>
                </Button>
            </div>
        </div>
    );
};

const persistRoomSession = async (roomId, hostUid, password) => {
    if (password) {
        try {
            const passHash = await hashWatchPartyPassword(password);
            sessionStorage.setItem(`wp_pass_${roomId}`, passHash);
        } catch {}
    }
    try {
        sessionStorage.setItem(`wp_creator_${roomId}`, hostUid);
    } catch {}
};

const isFirestorePermissionError = (err) =>
    err?.code === "permission-denied" || err?.message?.includes("insufficient permissions");

const isFirestoreQuotaError = (err) =>
    err?.code === "resource-exhausted" || err?.message?.includes("resource-exhausted") || err?.message?.includes("Quota exceeded");

const getCreateRoomErrorMessage = (err) => {
    if (isFirestorePermissionError(err)) {
        return "Không thể kết nối đến máy chủ phòng xem. Vui lòng thử lại sau.";
    }
    if (isFirestoreQuotaError(err)) {
        return "Hệ thống phòng xem chung hiện đang quá tải. Vui lòng thử lại sau ít phút.";
    }
    return err?.message || "Không thể tạo phòng xem chung. Vui lòng thử lại.";
};

export default function WatchPartyLobby() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();

    const prefillMovie = location.state?.movie;
    const prefillEpisode = location.state?.activeEpisode;

    const [roomCodeInput, setRoomCodeInput] = useState("");
    const [createMode, setCreateMode] = useState("movie");
    const [customSlugInput, setCustomSlugInput] = useState(prefillMovie?.slug || "");
    const [streamUrlInput, setStreamUrlInput] = useState("");
    const [streamTitleInput, setStreamTitleInput] = useState("");
    const [roomPasswordInput, setRoomPasswordInput] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isQROpen, setIsQROpen] = useState(false);
    const [qrModalRoomId, setQrModalRoomId] = useState("");
    const [joinError, setJoinError] = useState("");
    const [createError, setCreateError] = useState("");

    // State cho Modal nhập mật khẩu khi phòng yêu cầu pass
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [selectedTargetRoomId, setSelectedTargetRoomId] = useState("");
    const [passwordModalError, setPasswordModalError] = useState("");

    // State cho Hồ sơ khách (chưa login) lưu theo localStorage
    const [guestProfile, setGuestProfile] = useState(() => getGuestProfile());
    const [isNameModalOpen, setIsNameModalOpen] = useState(false);

    const handleSaveGuestName = (newName) => {
        const saved = setGuestName(newName);
        if (saved) {
            setGuestProfile(getGuestProfile());
        }
    };

    const checkPasswordAndNavigate = async (targetRoomId) => {
        try {
            const roomData = await getWatchPartyRoom(targetRoomId);
            if (roomData?.hasPassword && roomData.hostId !== currentUser?.uid) {
                setSelectedTargetRoomId(targetRoomId);
                setPasswordModalError("");
                setIsPasswordModalOpen(true);
                return;
            }
            navigate(getWatchPartyRoomPath(targetRoomId));
        } catch {
            navigate(getWatchPartyRoomPath(targetRoomId));
        }
    };

    const handleJoin = (e) => {
        e?.preventDefault();
        const code = parseRoomCodeFromText(roomCodeInput);
        if (!code) {
            setJoinError(t("watchParty.lobby.enterRoomCodeError"));
            return;
        }
        checkPasswordAndNavigate(code);
    };

    const handleSelectActiveRoom = (targetRoomId) => {
        checkPasswordAndNavigate(targetRoomId);
    };

    const handleVerifyPasswordAndJoin = async (enteredPassword) => {
        try {
            const roomData = await getWatchPartyRoom(selectedTargetRoomId);
            const isValid = await verifyWatchPartyPassword(roomData, enteredPassword);
            if (!isValid) {
                setPasswordModalError("Mật khẩu phòng không đúng. Vui lòng thử lại.");
                return;
            }

            // Mật khẩu đúng -> lưu hash vào sessionStorage cho phòng xác thực
            const passHash = await hashWatchPartyPassword(enteredPassword);
            sessionStorage.setItem(`wp_pass_${selectedTargetRoomId}`, passHash);
            setIsPasswordModalOpen(false);
            navigate(getWatchPartyRoomPath(selectedTargetRoomId));
        } catch (err) {
            console.error("Lỗi xác thực pass:", err);
            setPasswordModalError("Có lỗi xảy ra khi xác thực mật khẩu.");
        }
    };

    const handleOpenQRGenerator = () => {
        const targetCode = parseRoomCodeFromText(roomCodeInput) || generateRoomCode();
        setRoomCodeInput(targetCode);
        setQrModalRoomId(targetCode);
        setIsQROpen(true);
    };

    const handleCreateCustomRoom = async (e) => {
        e?.preventDefault();
        const hostUser = currentUser || guestProfile;
        if (!hostUser?.uid) {
            setCreateError(t("watchParty.lobby.loginRequiredError", { defaultValue: "Vui lòng nhập tên để tạo phòng xem chung." }));
            return;
        }

        const isStream = createMode === "stream";
        const targetValue = isStream ? streamUrlInput.trim() : customSlugInput.trim();
        if (!targetValue) return;

        setIsCreating(true);
        setCreateError("");
        try {
            const { movie, episode } = await resolveMovieAndEpisodePayload(
                targetValue,
                isStream ? null : prefillMovie,
                isStream ? null : prefillEpisode,
                isStream ? streamTitleInput : ""
            );

            const password = roomPasswordInput.trim();
            const roomId = await createWatchPartyRoom({
                movie,
                episode,
                hostUser,
                password,
            });

            await persistRoomSession(roomId, hostUser.uid, password);

            navigate(getWatchPartyRoomPath(roomId), {
                state: { creatorId: hostUser.uid },
            });
        } catch (err) {
            console.error("Lỗi tạo phòng:", err);
            setCreateError(getCreateRoomErrorMessage(err));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <VodLayout>
            <div className="min-h-screen bg-black px-4 py-16 text-white md:px-8">
                <div className="mx-auto max-w-5xl">
                    {/* Header Banner */}
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-red-900/60 bg-red-950/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-red-400">
                            <UsersIcon className="h-4 w-4 stroke-2" />
                            <span>{t("watchParty.badge")}</span>
                        </div>
                        <h1 className="mt-4 text-3xl font-black md:text-5xl">
                            {t("watchParty.lobby.title")}
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-xs text-zinc-400 md:text-sm">
                            {t("watchParty.lobby.subtitle")}
                        </p>

                        {/* Thanh danh tính người dùng (hỗ trợ nhập / đổi tên khách nếu chưa đăng nhập) */}
                        <GuestIdentityBanner
                            currentUser={currentUser}
                            guestName={guestProfile.displayName}
                            onOpenChangeName={() => setIsNameModalOpen(true)}
                            t={t}
                        />
                    </div>

                    {/* Khung chức năng chính: Tham gia & Tạo phòng */}
                    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* 1. Tham gia phòng đã có */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-red-500 border border-zinc-800">
                                    <ArrowRightIcon className="h-5 w-5 stroke-2" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">
                                        {t("watchParty.lobby.joinTitle")}
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        {t("watchParty.lobby.joinDesc")}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleJoin} className="mt-6 space-y-4">
                                <div>
                                    <label htmlFor="room-code-input" className="block text-xs font-semibold text-zinc-300">
                                        {t("watchParty.lobby.roomCode")}
                                    </label>
                                    <input
                                        id="room-code-input"
                                        type="text"
                                        value={roomCodeInput}
                                        onChange={(e) => {
                                            setRoomCodeInput(e.target.value);
                                            setJoinError("");
                                        }}
                                        placeholder={t("watchParty.lobby.roomCodePlaceholder")}
                                        className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                    />
                                    {joinError && (
                                        <p className="mt-1.5 text-xs text-red-500">{joinError}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1 min-w-[140px]"
                                    >
                                        <span>{t("watchParty.lobby.joinNow")}</span>
                                        <ArrowRightIcon className="h-4 w-4 stroke-2" />
                                    </Button>
                                    <Button
                                        type="button"
                                        onPress={handleOpenQRGenerator}
                                        variant="secondary"
                                        size="md"
                                        title={t("watchParty.lobby.createQr")}
                                    >
                                        <QrCodeIcon className="h-4 w-4 text-red-400 stroke-2" />
                                        <span>{t("watchParty.lobby.createQr")}</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        onPress={() => setIsScannerOpen(true)}
                                        variant="secondary"
                                        size="md"
                                        title={t("watchParty.lobby.scanQr")}
                                    >
                                        <CameraIcon className="h-4 w-4 text-emerald-400 stroke-2" />
                                        <span>{t("watchParty.lobby.scanQr")}</span>
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* 2. Tạo phòng mới kèm tuỳ chọn Mật khẩu */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white font-bold">
                                    <PlusIcon className="h-5 w-5 stroke-2" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">
                                        {t("watchParty.lobby.createTitle")}
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        {t("watchParty.lobby.createDesc")}
                                    </p>
                                </div>
                            </div>

                            <PrefillMovieBanner movie={prefillMovie} episode={prefillEpisode} t={t} />
                            <CreateRoomErrorAlert error={createError} t={t} />

                            {/* Bộ chuyển đổi chế độ tạo phòng: Kho phim vs Dán link Stream */}
                            <div className="mt-4 flex rounded-xl border border-zinc-800 bg-zinc-900/80 p-1">
                                <button
                                    type="button"
                                    onClick={() => setCreateMode("movie")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                        createMode === "movie"
                                            ? "bg-zinc-800 text-white shadow-sm"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <FilmIcon className="h-3.5 w-3.5 stroke-2" />
                                    <span>Kho phim</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreateMode("stream")}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                        createMode === "stream"
                                            ? "bg-red-600 text-white shadow-sm"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <LinkIcon className="h-3.5 w-3.5 stroke-2" />
                                    <span>Dán link M3U8 / MPD</span>
                                </button>
                            </div>

                            <form onSubmit={handleCreateCustomRoom} className="mt-4 space-y-3.5">
                                {createMode === "stream" ? (
                                    <>
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="stream-url-input" className="block text-xs font-semibold text-zinc-300">
                                                    Đường dẫn luồng Stream (.m3u8 / .mpd) <span className="text-red-500">*</span>
                                                </label>
                                                <span className="text-[10px] text-zinc-500 font-medium">HLS & DASH</span>
                                            </div>
                                            <div className="relative mt-1.5 flex items-center">
                                                <div className="pointer-events-none absolute left-3 text-zinc-500">
                                                    <LinkIcon className="h-4 w-4 stroke-2" />
                                                </div>
                                                <input
                                                    id="stream-url-input"
                                                    type="url"
                                                    value={streamUrlInput}
                                                    onChange={(e) => setStreamUrlInput(e.target.value)}
                                                    placeholder="https://example.com/playlist.m3u8 hoặc manifest.mpd"
                                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="stream-title-input" className="block text-xs font-semibold text-zinc-300">
                                                Tên phòng / Tên video (tùy chọn)
                                            </label>
                                            <div className="relative mt-1.5 flex items-center">
                                                <div className="pointer-events-none absolute left-3 text-zinc-500">
                                                    <FilmIcon className="h-4 w-4 stroke-2" />
                                                </div>
                                                <input
                                                    id="stream-title-input"
                                                    type="text"
                                                    value={streamTitleInput}
                                                    onChange={(e) => setStreamTitleInput(e.target.value)}
                                                    placeholder="VD: Trực tiếp bóng đá, Video cá nhân..."
                                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label htmlFor="custom-slug-input" className="block text-xs font-semibold text-zinc-300">
                                            {t("watchParty.lobby.enterSlugOrName")}
                                        </label>
                                        <div className="relative mt-1.5 flex items-center">
                                            <div className="pointer-events-none absolute left-3 text-zinc-500">
                                                <FilmIcon className="h-4 w-4 stroke-2" />
                                            </div>
                                            <input
                                                id="custom-slug-input"
                                                type="text"
                                                value={customSlugInput}
                                                onChange={(e) => setCustomSlugInput(e.target.value)}
                                                placeholder={t("watchParty.lobby.slugPlaceholder")}
                                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="room-password-setting" className="block text-xs font-semibold text-zinc-300">
                                        {t("watchParty.lobby.passwordLabel")}
                                    </label>
                                    <div className="relative mt-1.5 flex items-center">
                                        <div className="pointer-events-none absolute left-3 text-zinc-500">
                                            <LockClosedIcon className="h-4 w-4 stroke-2" />
                                        </div>
                                        <input
                                            id="room-password-setting"
                                            type="text"
                                            value={roomPasswordInput}
                                            onChange={(e) => setRoomPasswordInput(e.target.value)}
                                            placeholder={t("watchParty.lobby.passwordPlaceholder")}
                                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                        disabled={
                                            (createMode === "stream" ? !streamUrlInput.trim() : !customSlugInput.trim()) ||
                                            isCreating
                                        }
                                    >
                                        <PlusIcon className="h-4 w-4 stroke-2" />
                                        <span>{isCreating ? t("watchParty.lobby.creating") : t("watchParty.lobby.createNow")}</span>
                                    </Button>

                                    <Button
                                        type="button"
                                        onPress={() => navigate(ROUTES.VOD.ROOT)}
                                        variant="secondary"
                                        size="md"
                                        title={t("navbar.movies") || "Kho phim"}
                                    >
                                        <span>{t("navbar.movies") || "Kho phim"}</span>
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Danh sách các phòng xem chung đang mở có sẵn */}
                    <WatchPartyActiveRooms onSelectRoom={handleSelectActiveRoom} />

                    {/* Điểm nổi bật của hệ thống Xem Chung */}
                    <div className="mt-16">
                        <h3 className="text-center text-lg font-black uppercase tracking-wider text-zinc-300">
                            {t("watchParty.lobby.features.title")}
                        </h3>
                        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                <ArrowPathIcon className="h-6 w-6 text-red-500 stroke-2" />
                                <h4 className="mt-3 text-sm font-bold text-white">
                                    {t("watchParty.lobby.features.syncTitle")}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-400">
                                    {t("watchParty.lobby.features.syncDesc")}
                                </p>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400 stroke-2" />
                                <h4 className="mt-3 text-sm font-bold text-white">
                                    {t("watchParty.lobby.features.chatTitle")}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-400">
                                    {t("watchParty.lobby.features.chatDesc")}
                                </p>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                <VideoCameraIcon className="h-6 w-6 text-emerald-400 stroke-2" />
                                <h4 className="mt-3 text-sm font-bold text-white">
                                    {t("watchParty.lobby.features.camTitle")}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-400">
                                    {t("watchParty.lobby.features.camDesc")}
                                </p>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                <TrashIcon className="h-6 w-6 text-amber-500 stroke-2" />
                                <h4 className="mt-3 text-sm font-bold text-white">
                                    {t("watchParty.lobby.features.autoDeleteTitle")}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-400">
                                    {t("watchParty.lobby.features.autoDeleteDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Quét mã QR phòng */}
            <WatchPartyScannerModal
                isOpen={isScannerOpen}
                onOpenChange={setIsScannerOpen}
                onCodeScanned={(scannedCode) => {
                    handleSelectActiveRoom(scannedCode);
                }}
            />

            {/* Modal Tạo/Hiển thị mã QR phòng để chia sẻ */}
            <WatchPartyQRModal
                isOpen={isQROpen}
                onOpenChange={setIsQROpen}
                roomId={qrModalRoomId}
                roomName={`Phòng ${qrModalRoomId}`}
            />

            {/* Modal Nhập mật khẩu phòng */}
            <WatchPartyPasswordModal
                isOpen={isPasswordModalOpen}
                onOpenChange={setIsPasswordModalOpen}
                roomId={selectedTargetRoomId}
                onSubmitPassword={handleVerifyPasswordAndJoin}
                errorMessage={passwordModalError}
            />

            {/* Modal Đổi tên hiển thị cho khách */}
            <WatchPartyNameModal
                isOpen={isNameModalOpen}
                onOpenChange={setIsNameModalOpen}
                currentName={guestProfile.displayName}
                onSaveName={handleSaveGuestName}
            />
        </VodLayout>
    );
}
