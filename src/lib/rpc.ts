import { DrawingRPC } from '@/bun/drawingRpc';
import Electrobun, { Electroview } from 'electrobun/view';

// 1. 定义 RPC 结构
export const rpc = Electroview.defineRPC<DrawingRPC>({
  maxRequestTime: 5000, // 给 CAD 留够 15 秒启动时间
  handlers: {
    requests: {},
    messages: {
    
    }
  },
});

// 2. 创建单例对象
let viewInstance: any = null;

export const getElectroview = () => {
  if (!viewInstance) {
    viewInstance = new Electrobun.Electroview({ rpc });
    console.log("✅ Electroview RPC 单例已初始化");
  }
  return viewInstance;
};