import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { VodProvider } from "./contexts/VodContext";
import { ROUTES } from "./constants";
import Spinner from "./components/ui/Spinner";

// Lazy loading các trang chính nhằm giảm tải dung lượng bundle ban đầu
const Home = lazy(() => import("./pages/Home"));
const TvPage = lazy(() => import("./pages/TV"));
const Schedule = lazy(() => import("./pages/Schedule"));

// Lazy loading các trang VOD
const VodLanding = lazy(() => import("./pages/vod/Landing"));
const Play = lazy(() => import("./pages/vod/Play"));
const Listing = lazy(() => import("./pages/vod/Listing"));
const VodsRedirect = lazy(() => import("./components/vod/VodsRedirect"));

// Lazy loading Watch Party
const WatchPartyLobby = lazy(() => import("./pages/vod/WatchPartyLobby"));
const WatchPartyRoom = lazy(() => import("./pages/vod/WatchPartyRoom"));

// Component hiển thị trạng thái chờ tải trang
const RouteFallback = () => (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
            <Spinner color="danger" size="lg" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Đang tải trang...
            </span>
        </div>
    </div>
);

export default function App() {
    return (
        <VodProvider>
            <Suspense fallback={<RouteFallback />}>
                <Routes>
                    <Route path={ROUTES.HOME} element={<Home />} />

                    {/* Mở trực tiếp trang xem phim từ các link cũ hoặc alias */}
                    <Route path="/vods/play/:slug" element={<Play />} />
                    <Route path="/vods/play/:slug/*" element={<Play />} />
                    <Route path="/vodplay/:slug" element={<Play />} />
                    <Route path="/vodplay/:slug/*" element={<Play />} />
                    <Route path="/vodplay" element={<Navigate to={ROUTES.VOD.ROOT} replace />} />
                    <Route path="/vod/play" element={<Navigate to={ROUTES.VOD.ROOT} replace />} />

                    {/* Tự động chuyển hướng từ các route cũ /vods/* về /vod/* */}
                    <Route path={ROUTES.VODS_REDIRECT} element={<VodsRedirect />} />
                    <Route path={ROUTES.VODS_REDIRECT_WILD} element={<VodsRedirect />} />

                    {/* New VOD System Routes */}
                    <Route path={ROUTES.VOD.ROOT} element={<VodLanding />} />
                    <Route path={ROUTES.VOD.PLAY} element={<Play />} />
                    <Route path={ROUTES.VOD.PLAY_WILDCARD} element={<Play />} />
                    <Route path={ROUTES.VOD.SEARCH} element={<Listing />} />
                    <Route path={ROUTES.VOD.COUNTRY} element={<Listing />} />
                    <Route path={ROUTES.VOD.CATEGORY} element={<Listing />} />
                    <Route path={ROUTES.VOD.ACTOR} element={<Listing />} />

                    {/* Watch Party Routes */}
                    <Route path={ROUTES.VOD.WATCH_PARTY} element={<WatchPartyLobby />} />
                    <Route path={ROUTES.VOD.WATCH_PARTY_ROOM} element={<WatchPartyRoom />} />

                    <Route path={ROUTES.TV} element={<TvPage />} />
                    <Route path={ROUTES.SCHEDULE} element={<Schedule />} />

                    {/* Fallback cho các đường dẫn không tồn tại */}
                    <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
                </Routes>
            </Suspense>
        </VodProvider>
    );
}
