import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
// Import Inter font từ npm
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./assets/styles/tailwind.css";
// Import i18n config - phải import trước khi render
import "./i18n";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
    <BrowserRouter
        basename="/entertainment"
        future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
        }}
    >
        <AuthProvider>
            <App />
        </AuthProvider>
    </BrowserRouter>,
);
