import { useCallback, useEffect, useState } from "react";
import { readContract } from "wagmi/actions";
import { wagmiConfig } from "@/components/RainbowKitProvider";
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from "@/constant/ABI/HyperIndexFactoryV3";
import { SWAP_V3_POOL_ABI as POOL_ABI } from "@/constant/ABI/HyperIndexSwapV3Pool";
import { isValidAddress } from "@/utils";

export interface Slot0Data {
  0: bigint; // sqrtPriceX96
  1: number; // tick
  2: number; // observationIndex
  3: number; // observationCardinality
  4: number; // observationCardinalityNext
  5: number; // feeProtocol
  6: boolean; // unlocked
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

// "outputs": [
//       {
//         "internalType": "uint160",
//         "name": "sqrtPriceX96",
//         "type": "uint160"
//       },
//       {
//         "internalType": "int24",
//         "name": "tick",
//         "type": "int24"
//       },
//       {
//         "internalType": "uint16",
//         "name": "observationIndex",
//         "type": "uint16"
//       },
//       {
//         "internalType": "uint16",
//         "name": "observationCardinality",
//         "type": "uint16"
//       },
//       {
//         "internalType": "uint16",
//         "name": "observationCardinalityNext",
//         "type": "uint16"
//       },
//       {
//         "internalType": "uint8",
//         "name": "feeProtocol",
//         "type": "uint8"
//       },
//       {
//         "internalType": "bool",
//         "name": "unlocked",
//         "type": "bool"
//       }
//     ],

export interface PoolInfoV3 {
  address: `0x${string}`;
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
}

interface TokenData {
  address: string;
  symbol?: string;
  name?: string;
  icon_url?: string | null;
  decimals?: string | null;
}

export const usePoolInfo = (token1Data: TokenData | null, token2Data: TokenData | null, feeTier: number) => {
  const [poolInfo, setPoolInfo] = useState<PoolInfoV3 | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPoolAddress = async (token0: string, token1: string, fee?: number) => {
    // 确保 token0 和 token1 按字典序排序
    const [sortedToken0, sortedToken1] = token0.toLowerCase() < token1.toLowerCase() 
      ? [token0, token1] 
      : [token1, token0];
      
    const poolAddress = await readContract(wagmiConfig, {
      address: FACTORY_CONTRACT_ADDRESS_V3,
      abi: FACTORY_ABI_V3,
      functionName: 'getPool',
      args: [sortedToken0, sortedToken1, fee]
    })

    return poolAddress as `0x${string}`
  }

  const updatePoolInfo = useCallback(async () => {
    if (!token1Data || !token2Data) {
      setPoolInfo(null);
      return;
    }

    setLoading(true);
    setRequestLoading(true);
    setError(null);

    try {
      const poolAddress = await getPoolAddress(token1Data.address, token2Data.address, feeTier);
      
      if (!isValidAddress(poolAddress)) {
        setPoolInfo(null);
        setLoading(false);
        return;
      }

      const [poolData, liquidity] = await Promise.all([
        readContract(wagmiConfig, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'slot0',
        }) as Promise<Slot0Data>,
        
        readContract(wagmiConfig, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'liquidity',
        })
      ]);
      
      if (!poolData) {
        setPoolInfo(null);
        setLoading(false);
        return;
      }

      // 获取池子中的实际 token0 和 token1
      const [token0, token1] = await Promise.all([
        readContract(wagmiConfig, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'token0',
        }),
        readContract(wagmiConfig, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'token1',
        })
      ]);

      const poolInfo = {
        address: poolAddress,
        token0: token0 as string,
        token1: token1 as string,
        fee: feeTier,
        sqrtPriceX96: poolData[0].toString(),
        tick: poolData[1],
        liquidity: liquidity?.toString() || '0',
      };
      
      setPoolInfo(poolInfo);
    } catch (error) {
      console.error('获取池子信息失败:', error);
      setError('获取池子信息失败');
      setPoolInfo(null);
    } finally {
      setLoading(false);
      setRequestLoading(false);
    }
  }, [token1Data, token2Data, feeTier]);

  useEffect(() => {
    updatePoolInfo();
  }, [updatePoolInfo]);

  return { poolInfo, loading, requestLoading, error, refreshPoolInfo: updatePoolInfo };
};