import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// @ts-ignore
import "./index.css";
import App from "./App";
import { ThemeProvider } from "@/components/ThemeContext";
import { ConfigProvider } from "@/components/useConfig";
import { ToastProvider } from "@/components/useToast";
// import { Analytics } from '@vercel/analytics/next'
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      {/* <Analytics /> */}
      <ConfigProvider>
        <ToastProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ToastProvider>
      </ConfigProvider>
    </>
  </StrictMode>,
);
