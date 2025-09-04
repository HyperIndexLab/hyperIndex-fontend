import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { TokenData, PoolInfo } from "@/types/liquidity";
import {
  FACTORY_ABI,
  FACTORY_CONTRACT_ADDRESS,
} from "@/constant/ABI/HyperIndexFactory";
import { PAIR_ABI } from "@/constant/ABI/HyperIndexPair";
import { WHSK } from "@/constant/value";

export function useLiquidityPool(
  token1Data: TokenData | null,
  token2Data: TokenData | null
) {
  const [isFirstProvider, setIsFirstProvider] = useState(false);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  // 检查池子是否存在
  const {
    data: pairAddress,
    refetch: refetchPairAddress,
    isLoading: isPairLoading,
  } = useReadContract({
    address: FACTORY_CONTRACT_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args:
      token1Data && token2Data
        ? [
            token1Data.symbol === "HSK" ? WHSK : token1Data.address,
            token2Data.symbol === "HSK" ? WHSK : token2Data.address,
          ]
        : undefined,
  });

  
  // 获取池子信息
  const {
    data: pairInfo,
    refetch: refetchPairInfo,
    isLoading: isReservesLoading,
  } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: PAIR_ABI,
    functionName: "getReserves",
  }) as {
    data: [bigint, bigint, number] | undefined;
    refetch: () => Promise<any>;
    isLoading: boolean;
  };

  // 获取 totalSupply
  const {
    data: totalSupply,
    refetch: refetchTotalSupply,
    isLoading: isSupplyLoading,
  } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: PAIR_ABI,
    functionName: "totalSupply",
  }) as {
    data: bigint | undefined;
    refetch: () => Promise<any>;
    isLoading: boolean;
  };

  useEffect(() => {
    setIsLoading(isPairLoading || isReservesLoading || isSupplyLoading);
  }, [isPairLoading, isReservesLoading, isSupplyLoading]);

  useEffect(() => {
    if (token1Data && token2Data) {
      if (pairAddress && pairInfo && totalSupply) {
        setPoolInfo({
          reserve0: pairInfo[0],
          reserve1: pairInfo[1],
          totalSupply: totalSupply,
          pairAddress: pairAddress as string,
        });
        setIsFirstProvider(totalSupply === BigInt(0));
      } else if (
        !isLoading &&
        pairAddress === "0x0000000000000000000000000000000000000000"
      ) {
        // 只有在确认没有池子时才设置为第一个提供者
        setIsFirstProvider(true);
        setPoolInfo(null);
      } else {
        setIsFirstProvider(false);
        setPoolInfo(null);
      }
    }
  }, [token1Data, token2Data, pairAddress, pairInfo, totalSupply, isLoading]);

  const refreshPool = () => {
    Promise.all([
      refetchPairAddress(),
      refetchPairInfo(),
      refetchTotalSupply(),
    ]);
  };

  return {
    isFirstProvider,
    poolInfo,
    pairAddress,
    refreshPool,
    isLoading,
  };
}
