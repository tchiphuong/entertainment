import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Vods from "./pages/Vods";
import VodPlay from "./pages/VodPlay";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vods" element={<Vods />} />
            <Route path="/vods/play/:slug" element={<VodPlay />} />
            <Route path="/vods/play" element={<VodPlay />} />
        </Routes>
    );
}
