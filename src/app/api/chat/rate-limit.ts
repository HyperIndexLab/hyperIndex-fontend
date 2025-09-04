// 简单的内存存储，用于IP地址和查询次数
// 在生产环境中，这可以替换为Redis或其他持久化存储
interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// 获取当天的00:00作为重置时间点
const getResetTime = (): number => {
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return resetDate.getTime();
};

// 每个IP的每日请求限制
const DAILY_LIMIT = 10;

export function getRateLimitInfo(ip: string) {
  // 清理过期数据
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }

  // 如果是新IP，初始化
  if (!store[ip]) {
    store[ip] = {
      count: 0,
      resetAt: getResetTime()
    };
  }

  return {
    currentCount: store[ip].count,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - store[ip].count),
    resetAt: new Date(store[ip].resetAt)
  };
}

export function incrementRateLimit(ip: string): boolean {
  const info = getRateLimitInfo(ip);
  
  // 如果已达到限制，返回false
  if (info.remaining <= 0) {
    return false;
  }
  
  // 增加计数
  store[ip].count += 1;
  return true;
}

// 开发辅助函数 - 重置特定IP的限制
export function resetRateLimit(ip: string): void {
  if (store[ip]) {
    delete store[ip];
  }
} 