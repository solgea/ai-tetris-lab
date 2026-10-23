import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/theme.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Kök element (#root) bulunamadı — index.html bozuk");
}
createRoot(rootElement).render(<App />);
