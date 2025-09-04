import { parseUnits, formatUnits, Address } from 'viem';
import BigNumber from 'bignumber.js';
import { SWAP_V3_POOL_ABI as POOL_ABI } from '@/constant/ABI/HyperIndexSwapV3Pool';
import { QUOTE_CONTRACT_ADDRESS, QUOTE_ABI } from '../constant/ABI/HyperIndexV3Quote';
import { PAIR_ABI } from '@/constant/ABI/HyperIndexPair';
import { wagmiConfig } from '@/components/RainbowKitProvider';
import { readContract, simulateContract } from 'wagmi/actions';
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from '@/constant/ABI/HyperIndexFactoryV3';

interface Token {
  address: Address;
  symbol: string;
  decimals: number;
}

interface UseSwapInfoProps {
  token1: Token;
  token2: Token;
  amount1: string;
  slippage: number;
  poolVersion: 'v2' | 'v3';
  pairAddress: Address; // 池子的地址
}

interface PoolQuote {
  fee: number;
  amountOut: bigint;
  priceImpact: number;
  liquidity: bigint;
}

// 修改缓存对象结构
const poolCache = {
  key: '',
  data: null as {
    fee: number;
    poolInfo: any;
  } | null,
  timestamp: 0
};

export async function getSwapInfo({
  token1,
  token2,
  amount1,
  slippage = 0.5,
  poolVersion = 'v3',
  pairAddress,
}: UseSwapInfoProps) {
  // 初始化返回值
  const token2Amount = '0';
  const minimumReceived = '0';
  const priceImpact = '0';
  const lpFee = '0';
  const error: string | null = null;

  // 检查基本条件
  if (!token1 || !token2 || !amount1 || Number(amount1) === 0) {
    return { token2Amount, minimumReceived, priceImpact, lpFee, error };
  }
  
  // 检查是否是 HSK 和 WHSK 的交易对 1:1 兑换
  const isHskWhskPair = (
    (token1.symbol === 'HSK' && token2.symbol === 'WHSK') ||
    (token2.symbol === 'HSK' && token1.symbol === 'WHSK')
  );

  if (isHskWhskPair) {
    return {
      token2Amount: amount1,
      minimumReceived: amount1,
      priceImpact: '0',
      lpFee: '0',
      error: null,
      bestPoolFee: '0',
      poolInfo: null
    };
  }

  try {
    // 根据池子版本选择计算方法
    if (poolVersion === 'v2') {
      return await calculateV2Swap(token1, token2, amount1, slippage, pairAddress);
    } else {
      return await calculateV3Swap(token1, token2, amount1, slippage);
    }
  } catch (err) {
    console.error('Error calculating swap:', err);
    return {
      token2Amount: '0',
      minimumReceived: '0',
      priceImpact: '0',
      lpFee: '0',
      error: '计算交易失败，请稍后再试',
      bestPoolFee: '0',
      poolInfo: null
    };
  }
}

function calculatePriceImpact(
  tokenIn: Token,
  tokenOut: Token,
  poolInfo: {
    token0: Token,
    token1: Token,
    sqrtPriceX96: bigint,
    liquidity: bigint,
  }, // 包含 token0/token1 和交易前价格
  sqrtPriceX96After: bigint
): number {
  // 边界保护
  if (!poolInfo || poolInfo.liquidity === 0n) {
      return Infinity; // 无流动性的池子视为极大价格影响
  }

  // 确定价格计算方向
  const isToken0In = tokenIn.address === poolInfo.token0.address;
  const decimalsIn = isToken0In ? poolInfo.token0.decimals : poolInfo.token1.decimals;
  const decimalsOut = isToken0In ? poolInfo.token1.decimals : poolInfo.token0.decimals;

  // 转换交易前后价格为实际价格
  const [priceBefore, priceAfter] = [poolInfo.sqrtPriceX96, sqrtPriceX96After].map(v => {
      const basePrice = (Number(v) / 2 ** 96) ** 2;
      return isToken0In 
          ? basePrice * (10 ** decimalsOut / 10 ** decimalsIn)  // token1 per token0
          : (1 / basePrice) * (10 ** decimalsIn / 10 ** decimalsOut); // token0 per token1
  });

  // 计算价格变化（绝对值）
  return Math.abs((priceAfter - priceBefore) / priceBefore * 100);
}

// 修改 V3 计算函数
async function calculateV3Swap(
  token1: Token,
  token2: Token,
  amount1: string,
  slippage: number,
) {
  try {
    const amountIn = parseUnits(amount1, token1.decimals);
    const cacheKey = `${token1.address}-${token2.address}`;
    
    let bestPool;
    
    // 检查缓存是否有效（20秒内）
    if (
      poolCache.key === cacheKey && 
      poolCache.data && 
      Date.now() - poolCache.timestamp < 20000
    ) {
      // 使用缓存的池子数据，但仍需计算具体的输出值
      const params = {
        tokenIn: token1.address,
        tokenOut: token2.address,
        amountIn: amountIn,
        fee: poolCache.data.fee,
        sqrtPriceLimitX96: 0
      };

      const { result } = await simulateContract(wagmiConfig, {
        address: QUOTE_CONTRACT_ADDRESS,
        abi: QUOTE_ABI,
        functionName: 'quoteExactInputSingle',
        args: [params]
      });

      const amountOut = result[0];
      const sqrtPriceX96After = result[1];

      const priceImpact = calculatePriceImpact(
        token1,
        token2,
        poolCache.data.poolInfo,
        sqrtPriceX96After as bigint
      );

      bestPool = {
        fee: poolCache.data.fee,
        amountOut: amountOut as bigint,
        priceImpact,
        liquidity: poolCache.data.poolInfo?.liquidity || 0n,
        poolInfo: poolCache.data.poolInfo
      };
    } else {
      // 如果缓存无效，执行完整的池子查找逻辑
      const possibleFees = [100, 500, 3000, 10000];
      const poolQuotes: (PoolQuote & { poolInfo: any })[] = [];
      
      for (const fee of possibleFees) {
        try {
          const poolInfo = await getPoolInfo(token1, token2, fee);
          if (!poolInfo) continue;  // 如果没有池子信息，跳过当前费率

          const params = {
            tokenIn: token1.address,
            tokenOut: token2.address,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
          };

          const { result } = await simulateContract(wagmiConfig, {
            address: QUOTE_CONTRACT_ADDRESS,
            abi: QUOTE_ABI,
            functionName: 'quoteExactInputSingle',
            args: [params]
          });

          const amountOut = result[0];
          const sqrtPriceX96After = result[1];

          const priceImpact = calculatePriceImpact(
            token1,
            token2,
            poolInfo,
            sqrtPriceX96After as bigint
          );

          poolQuotes.push({
            fee,
            amountOut: amountOut as bigint,
            priceImpact,
            liquidity: poolInfo?.liquidity || 0n,
            poolInfo: poolInfo || null
          });
        } catch (e) {
          continue;
        }
      }

      bestPool = findBestPool(poolQuotes);
      if (!bestPool) {
        throw new Error('没有找到合适的流动性池');
      }

      // 更新缓存，只存储费率和池子信息
      poolCache.key = cacheKey;
      poolCache.data = {
        fee: bestPool.fee,
        poolInfo: bestPool.poolInfo
      };
      poolCache.timestamp = Date.now();
    }

    return formatSwapResult(
      bestPool.amountOut,
      bestPool.fee,
      amountIn,
      token1.decimals,
      token2.decimals,
      slippage,
      bestPool.priceImpact,
      bestPool.poolInfo
    );
  } catch (err) {
    console.error('Error calculating V3 swap:', err);
    throw err;
  }
}

// 找到最优池子
function findBestPool(quotes: (PoolQuote & { poolInfo: any })[]): (PoolQuote & { poolInfo: any }) | null {
  if (quotes.length === 0) return null;

  // 按以下优先级排序：
  // 1. 价格影响小于 1% 的池子
  // 2. 优先选择较低费率的池子（费率 <= 0.3%）
  // 3. 在满足条件的池子中，选择输出金额最大的

  // 首先筛选价格影响小于 1% 的池子
  let validPools = quotes.filter(quote => quote.priceImpact < 1);

  if (validPools.length > 0) {
    // 尝试在价格影响可接受的池子中筛选低费率的池子（费率 <= 0.3%）
    const lowFeePools = validPools.filter(quote => quote.fee <= 3000);
    
    // 如果有低费率的池子，优先使用
    if (lowFeePools.length > 0) {
      validPools = lowFeePools;
    }

    // 在筛选后的池子中选择输出最大的
    return validPools.sort((a, b) => {
      if (a.amountOut > b.amountOut) return -1;
      if (a.amountOut < b.amountOut) return 1;
      return 0;
    })[0];
  }

  // 如果没有满足价格影响条件的池子，选择价格影响最小且费率较低的
  const sortedByImpact = quotes.sort((a, b) => a.priceImpact - b.priceImpact);
  const lowFeePools = sortedByImpact.filter(quote => quote.fee <= 3000);
  
  return lowFeePools.length > 0 ? lowFeePools[0] : sortedByImpact[0];
}

// 新增获取池子信息的函数
async function getPoolInfo(token0: Token, token1: Token, fee: number) {
  try {
    // 对代币地址进行排序，确保顺序正确
    const [sortedToken0, sortedToken1] = [token0, token1].sort((a, b) => 
      a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1
    );

    const { result } = await simulateContract(wagmiConfig, {
      address: FACTORY_CONTRACT_ADDRESS_V3,
      abi: FACTORY_ABI_V3,
      functionName: 'getPool',
      args: [sortedToken0.address, sortedToken1.address, fee]
    });

    const poolAddress = result as Address;
    
    // 检查池子地址是否为空
    if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    // 获取池子的流动性和价格信息
    const { result: poolState } = await simulateContract(wagmiConfig, {
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "slot0"
    });

    const { result: liquidityResult } = await simulateContract(wagmiConfig, {
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'liquidity'
    });

    return {
      poolAddress,
      sqrtPriceX96: poolState[0],
      liquidity: liquidityResult,
      tick: poolState[1],
      token0: sortedToken0,
      token1: sortedToken1
    };
  } catch (err) {
    console.error('Error getting pool info:', err);
    throw err;
  }
}

// 更新格式化函数的参数
function formatSwapResult(
  amountOut: bigint,
  fee: number,
  amountIn: bigint,
  decimalsIn: number,
  decimalsOut: number,
  slippage: number,
  priceImpact: number,
  poolInfo?: any  // 添加池子信息参数
) {
  const minReceived = amountOut * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000);
  const feeAmount = (amountIn * BigInt(fee)) / BigInt(1000000);

  return {
    token2Amount: formatUnits(amountOut, decimalsOut),
    minimumReceived: formatUnits(minReceived, decimalsOut),
    priceImpact: priceImpact.toFixed(2),
    lpFee: feeAmount,
    bestPoolFee: fee,
    error: null,
    poolInfo  // 添加池子信息到返回结果中
  };
}

// V2 计算函数
async function calculateV2Swap(
  token1: Token,
  token2: Token,
  amount1: string,
  slippage: number,
  pairAddress: Address,
) {
  try {
    const reserves = await readContract(wagmiConfig, {
      address: pairAddress as `0x${string}`,
      abi: PAIR_ABI,
      functionName: 'getReserves',
      args: [],
    });

    const [reserve0, reserve1] = reserves as [bigint, bigint];

    const data = await readContract(wagmiConfig, {
      address: pairAddress as `0x${string}`,
      abi: PAIR_ABI,
      functionName: 'token0',
      args: [],
    });
    const token0Address = data as Address;
    
    // 确定输入和输出代币的储备金
    const isToken1Token0 = token1.address.toLowerCase() === token0Address.toLowerCase();
    const [tokenInReserve, tokenOutReserve] = isToken1Token0 
      ? [reserve0, reserve1] 
      : [reserve1, reserve0];

    // 计算输出金额
    const amountIn = parseUnits(amount1, token1.decimals);
    const amountInWithFee = amountIn * BigInt(997);
    const numerator = amountInWithFee * tokenOutReserve;
    const denominator = (tokenInReserve * BigInt(1000)) + amountInWithFee;
    const amountOut = numerator / denominator;

    // 计算最小接收数量 (根据滑点设置)
    const minReceived = amountOut * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000);
    
    // 计算 LP 费用 (V2 固定为 0.3%)
    const feeAmount = (amountIn * BigInt(3)) / BigInt(1000);
    
    // 计算价格影响
    let priceImpactValue = '0';
    if (tokenInReserve > BigInt(0) && tokenOutReserve > BigInt(0) && amountOut > BigInt(0)) {
      // 使用BigNumber进行精确计算
      const currentPriceBN = new BigNumber(formatUnits(tokenInReserve, token1.decimals))
                             .dividedBy(new BigNumber(formatUnits(tokenOutReserve, token2.decimals)));
      const executionPriceBN = new BigNumber(formatUnits(amountIn, token1.decimals))
                               .dividedBy(new BigNumber(formatUnits(amountOut, token2.decimals)));
      
      // 计算价格影响百分比
      if (currentPriceBN.gt(0) && executionPriceBN.gt(0)) {
        const priceImpactPercent = executionPriceBN.minus(currentPriceBN)
                                   .dividedBy(currentPriceBN)
                                   .multipliedBy(100)
                                   .abs();
        priceImpactValue = priceImpactPercent.toFixed(2);
      }
    }

    return {
      token2Amount: formatUnits(amountOut, token2.decimals),
      minimumReceived: formatUnits(minReceived, token2.decimals),
      priceImpact: priceImpactValue,
      lpFee: formatUnits(feeAmount, token1.decimals),
      error: null
    };
  } catch (err) {
    console.error('Error calculating V2 swap:', err);
    throw err;
  }
}
