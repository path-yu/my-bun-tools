import {
  BrowserWindow,
  Updater,
  ApplicationMenu,
  BrowserView,
	Utils,
} from "electrobun/bun";
import { Electroview } from "electrobun/view";
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

const win = new BrowserWindow({
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
console.log('数据库保存路径:',Utils.paths.userData);
// 启动后台监听服务
startCadServer();
console.log("React Tailwind Vite app started!");
