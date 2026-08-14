import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CafeProvider } from "./state/CafeState";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CafeProvider>
        <App />
      </CafeProvider>
    </BrowserRouter>
  </StrictMode>,
);
