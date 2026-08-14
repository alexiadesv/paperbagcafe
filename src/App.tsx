import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ActivityPage, MakePage } from "./pages/MakePage";
import { LandingPage } from "./pages/LandingPage";
import { OpenPage } from "./pages/OpenPage";
import { SealPage } from "./pages/SealPage";
import { SentPage } from "./pages/SentPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/make" element={<MakePage />} />
        <Route path="/make/:activity" element={<ActivityPage />} />
        <Route path="/seal" element={<SealPage />} />
        <Route path="/sent" element={<SentPage />} />
        <Route path="/open/:slug" element={<OpenPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
