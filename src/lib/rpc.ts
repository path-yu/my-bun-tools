import Electrobun, { Electroview } from 'electrobun/view';
import { DrawingRPC } from './types';

// 1. 定义 RPC 结构
export const rpc = Electroview.defineRPC<DrawingRPC>({
  maxRequestTime: 5000, 
  handlers: {
    requests: {},
    messages: {}
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