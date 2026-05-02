import {
  BrowserWindow,
  Updater,
} from "electrobun/bun";
import { drawingRPC } from "./drawingRpc";
import { startCadServer } from "./server";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

 let webView = new BrowserWindow({
  title: "Tools for drawing management",
  url,
   frame: {
    width: 1200,
    height: 700,
    x: 200,
    y: 200,
  },
  
  rpc: drawingRPC,
});
export function omitFileChange(data: { fileName: string; isLocalChange: boolean }) {
  // 检查 webView 是否存在，以及 rpc 是否已经初始化
  if (!webView || !webView.webview || !webView.webview.rpc) {
    console.warn("WebView 尚未就绪，忽略文件变更请求");
    return;
  }

  try {
    // 确保在主线程或安全的生命周期内调用
    webView.webview.rpc.request.fileChange(data);
  } catch (err) {
    console.error("RPC 调用失败:", err);
  }
}
// 启动后台监听服务
startCadServer();
console.log("React Tailwind Vite app started!");
