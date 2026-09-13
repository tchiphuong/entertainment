import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TvPage from "./pages/TV";
import Schedule from "./pages/Schedule";

// New VOD System Components
import VodLanding from "./pages/vod/Landing";
import Play from "./pages/vod/Play";
import Listing from "./pages/vod/Listing";
import VodsRedirect from "./components/vod/VodsRedirect";
import { VodProvider } from "./contexts/VodContext";

export default function App() {
    return (
        <VodProvider>
            <Routes>
                <Route path="/" element={<Home />} />

                {/* Tự động chuyển hướng từ các route cũ /vods/* về /vod/* */}
                <Route path="/vods" element={<VodsRedirect />} />
                <Route path="/vods/*" element={<VodsRedirect />} />

                {/* New VOD System Routes */}
                <Route path="/vod" element={<VodLanding />} />
                <Route path="/vod/play/:slug" element={<Play />} />
                <Route path="/vod/play/:slug/*" element={<Play />} />
                <Route path="/vod/search" element={<Listing />} />
                <Route path="/vod/country/:country" element={<Listing />} />
                <Route path="/vod/category/:category" element={<Listing />} />
                <Route path="/vod/actor/:actor" element={<Listing />} />

                <Route path="/tv" element={<TvPage />} />
                <Route path="/schedule" element={<Schedule />} />
            </Routes>
        </VodProvider>
    );
}
