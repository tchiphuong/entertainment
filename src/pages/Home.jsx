import { Navigate } from "react-router-dom";
import { ROUTES } from "../constants";

export default function Home() {
    return <Navigate to={ROUTES.SCHEDULE} replace />;
}
