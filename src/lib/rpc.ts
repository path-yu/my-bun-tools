import Electrobun, { Electroview } from "electrobun/view";
import { DrawingRPC } from "./types";

// 1. 定义 RPC 结构
export const rpc = Electroview.defineRPC<DrawingRPC >({
  maxRequestTime: 30000,
  handlers: {
    requests: {
      fileChange(data) {
        console.log("Received file change event:", data);
        eventBus.emit('fileChanged', data);
        // 这里可以添加处理逻辑，例如更新 UI 或者通知其他部分
      },
      // 接受webViewId
      responseWebViewId(params) {
        console.log(3);
        
        sessionStorage.setItem("webViewId", params.webViewId);
        return {};
      },
    },
    messages: {},
  },
});
// 2. 这里的类型应该是 Electroview 实例，并传入你的 RPC 类型
// 注意：Electrobun 的实例类型通常可以通过 typeof 推导，或者直接使用泛型
let viewInstance: Electroview<typeof rpc> | null = null;

export const getElectroView = (): Electroview<typeof rpc> => {
  if (!viewInstance) {
    // 初始化单例
    viewInstance = new Electrobun.Electroview({ rpc });
  }
  return viewInstance;
};


class EventBus {
  private events: Map<string, Set<Function>>;

  constructor() {
    this.events = new Map();
  }

  // 订阅事件
  on(event: string, listener: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
  }

  // 取消订阅
  off(event: string, listener: Function) {
    if (this.events.has(event)) {
      this.events.get(event)!.delete(listener);
    }
  }

  // 触发事件
  emit(event: string, payload?: any) {
    if (this.events.has(event)) {
      for (const listener of this.events.get(event)!) {
        listener(payload);
      }
    }
  }
}
// 创建一个事件发布订阅器
export  const eventBus = new EventBus();