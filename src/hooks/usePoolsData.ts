import { useState, useEffect } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { erc20Abi, type Abi, formatUnits } from "viem";
import {
  FACTORY_ABI,
  FACTORY_CONTRACT_ADDRESS,
} from "../constant/ABI/HyperIndexFactory";
import { PAIR_ABI } from "../constant/ABI/HyperIndexPair";

export interface PoolInfo {
  pairAddress: string;
  token0Address: string;
  token1Address: string;
  token0Symbol: string;
  token1Symbol: string;
  userLPBalance: string;
  poolShare: string;
  token0Amount: string;
  token1Amount: string;
  liquidityRevenue: string;
  token0Price?: string;
  token1Price?: string;
  userAddress: string;
}

export const usePoolsData = () => {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const { address: userAddress } = useAccount();

  // 获取所有交易对地址和基本信息
  const { data: pairLength, refetch: refetchPairLength } = useReadContract({
    address: FACTORY_CONTRACT_ADDRESS as `0x${string}`,
    abi: FACTORY_ABI as Abi,
    functionName: "allPairsLength",
  });

  // 获取所有交易对地址
  const { data: pairAddresses, refetch: refetchPairAddresses } = useReadContracts({
    contracts: Array.from({ length: Number(pairLength || 0) }, (_, i) => ({
      address: FACTORY_CONTRACT_ADDRESS as `0x${string}`,
      abi: FACTORY_ABI as Abi,
      functionName: "allPairs",
      args: [BigInt(i)] as const,
    })),
  });

  // 获取所有交易对的详细信息
  const { data: pairsInfo, refetch: refetchPairsInfo } = useReadContracts({
    contracts: pairAddresses?.flatMap((pairData) => {
      const pairAddress = pairData.result as `0x${string}`;
      return [
        {
          address: pairAddress,
          abi: PAIR_ABI as Abi,
          functionName: "balanceOf",
          args: [userAddress as `0x${string}`],
        },
        {
          address: pairAddress,
          abi: PAIR_ABI as Abi,
          functionName: "token0",
        },
        {
          address: pairAddress,
          abi: PAIR_ABI as Abi,
          functionName: "token1",
        },
        {
          address: pairAddress,
          abi: PAIR_ABI as Abi,
          functionName: "getReserves",
        },
        {
          address: pairAddress,
          abi: PAIR_ABI as Abi,
          functionName: "totalSupply",
        },
      ];
    }) || [],
  });

  // 获取代币符号
  const { data: tokenSymbols, refetch: refetchTokenSymbols } = useReadContracts({
    contracts: pools.flatMap((pool) => [
      {
        address: pool.token0Address as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: pool.token1Address as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ]),
  });

  // 添加 USDT 地址常量
  const USDT_ADDRESS = "0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029".toLowerCase();
 
  // 处理基本池子数据
  useEffect(() => {
    if (!pairsInfo || !pairAddresses || !userAddress) return;

    const processedPools: PoolInfo[] = [];

    for (let i = 0; i < pairsInfo.length; i += 5) {
      const [lpBalance, token0Address, token1Address, reserves, totalSupply] =
        pairsInfo.slice(i, i + 5).map((d) => d.result);

      // 检查是否是 USDT 池子
      const isToken0USDT = (token0Address as string).toLowerCase() === USDT_ADDRESS;
      const isToken1USDT = (token1Address as string).toLowerCase() === USDT_ADDRESS;
      // const isUSDTPair = isToken0USDT || isToken1USDT;

      // 获取 LP 精度
      const lpDecimals = 18;
      const lpBalanceBigInt = BigInt(String(lpBalance));
    

      if (lpBalanceBigInt > 0n) {
        const reservesTyped = reserves as readonly [bigint, bigint, number];
        const totalSupplyBigInt = BigInt(String(totalSupply));
        

        const poolShare = (lpBalanceBigInt * 10000n) / totalSupplyBigInt;
        const token0Amount = (reservesTyped[0] * lpBalanceBigInt) / totalSupplyBigInt;
        const token1Amount = (reservesTyped[1] * lpBalanceBigInt) / totalSupplyBigInt;

        const formatPercent = (value: bigint) => (Number(value) / 100).toFixed(2);
        const formatToken0Amount = (value: bigint) => 
          Number(formatUnits(value, isToken0USDT ? 6 : 18)).toFixed(4);
        const formatToken1Amount = (value: bigint) => 
          Number(formatUnits(value, isToken1USDT ? 6 : 18)).toFixed(4);

        // 显示时使用原始的 lpBalanceBigInt（未转换的）
        const originalLPBalance = BigInt(String(lpBalance));

        processedPools.push({
          pairAddress: pairAddresses[i / 5].result as string,
          token0Address: token0Address as string,
          token1Address: token1Address as string,
          token0Symbol: "Loading...",
          token1Symbol: "Loading...",
          userLPBalance: Number(formatUnits(originalLPBalance, lpDecimals)).toFixed(6),
          poolShare: `${formatPercent(poolShare)}%`,
          token0Amount: formatToken0Amount(token0Amount),
          token1Amount: formatToken1Amount(token1Amount),
          liquidityRevenue: "计算中...",
          userAddress: userAddress,
        });
      }
    }

    setPools(processedPools);
  }, [pairsInfo, pairAddresses, userAddress]);

  // 处理代币符号
  useEffect(() => {
    if (!tokenSymbols || !pools.length) return;

    const updatedPools = pools.map((pool, index) => {
      const symbols = {
        token0Symbol: tokenSymbols[index * 2]?.result as string || 'Unknown',
        token1Symbol: tokenSymbols[index * 2 + 1]?.result as string || 'Unknown',
      };
      return { ...pool, ...symbols };
    });

    // 只有当符号真正发生变化时才更新
    const hasSymbolsChanged = updatedPools.some((pool, index) => 
      pool.token0Symbol !== pools[index].token0Symbol || 
      pool.token1Symbol !== pools[index].token1Symbol
    );

    if (hasSymbolsChanged) {
      setPools(updatedPools);
    }
  }, [tokenSymbols]); // 移除 pools 依赖

  // 添加 refetch 方法
  const refetch = async () => {
    await Promise.all([
      refetchPairLength(),
      refetchPairAddresses(),
      refetchPairsInfo(),
      refetchTokenSymbols()
    ]);
  };

  return {
    pools,
    isLoading: !pairsInfo || !pairAddresses,
    userAddress,
    refetch, // 导出 refetch 方法
  };
};
