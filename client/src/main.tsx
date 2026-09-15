import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker, setupInstallPrompt } from "./lib/pwa";
import { reportColdLoadMetrics } from "./lib/perf-metrics";

registerServiceWorker();
setupInstallPrompt();
reportColdLoadMetrics();

createRoot(document.getElementById("root")!).render(<App />);
