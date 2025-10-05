import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("DOMContentLoaded", () => {
  document.body.style.webkitUserSelect = "none";
  document.body.style.userSelect = "none";
  document.body.style.webkitTouchCallout = "none";
});

createRoot(document.getElementById("root")!).render(<App />);
