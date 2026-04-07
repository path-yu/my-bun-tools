import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// @ts-ignore
import "./index.css";
import App from "./App";
import { ThemeProvider } from "@/components/ThemeContext";
import { ConfigProvider } from "@/components/useConfig";
// import { Analytics } from '@vercel/analytics/next'
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      {/* <Analytics /> */}
      <ConfigProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ConfigProvider>
    </>
  </StrictMode>,
);
