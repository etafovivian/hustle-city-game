import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import { rememberCrew } from "./components/Crew.js";
import { installErrorReporter } from "./beta.js";

rememberCrew();
installErrorReporter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
