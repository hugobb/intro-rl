import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { BanditExample } from "./examples/multi-armed-bandit/BanditExample";
import { GridWorldExample } from "./examples/grid-world/GridWorldExample";
import "./styles.css";

const router = createBrowserRouter(
  [
    { path: "/", element: <Landing /> },
    { path: "/multi-armed-bandit", element: <BanditExample /> },
    { path: "/grid-world", element: <GridWorldExample /> },
  ],
  // Matches Vite's base so routing works under the GitHub Pages subpath.
  { basename: import.meta.env.BASE_URL },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
