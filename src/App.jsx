import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Vods from "./pages/Vods";
import VodPlay from "./pages/VodPlay";
import TV from "./pages/TV";
import Schedule from "./pages/Schedule";

// New VOD System Components
import VodLanding from "./pages/vod/Landing";
import Play from "./pages/vod/Play";
import Listing from "./pages/vod/Listing";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vods" element={<Vods />} />
            <Route path="/vods/browse" element={<Vods />} />
            <Route path="/vods/play/:slug" element={<VodPlay />} />
            <Route path="/vod" element={<VodLanding />} />
            <Route path="/vod/play/:slug" element={<Play />} />
            <Route path="/vod/search" element={<Listing />} />
            <Route path="/vod/country/:country" element={<Listing />} />
            <Route path="/vod/category/:category" element={<Listing />} />
            <Route path="/tv" element={<TV />} />
            <Route path="/schedule" element={<Schedule />} />
        </Routes>
    );
}
