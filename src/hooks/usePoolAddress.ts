import { useCallback } from "react";
import { usePublicClient } from 'wagmi';
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from '../constant/ABI/HyperIndexFactoryV3';
import { FACTORY_ABI, FACTORY_CONTRACT_ADDRESS } from '../constant/ABI/HyperIndexFactory';
import { Address } from "viem";
import { readContract } from "wagmi/actions";
import { wagmiConfig } from "@/components/RainbowKitProvider";
import { V3_FEE_TIERS } from "@/constant/value";

interface PoolCheckResult {
  poolAddress: string | null;
  exists: boolean;
  fee?: number;
}

interface PoolAddressResult {
  v3Pool: string | null;
  v2Pool: string | null;
  poolAddress: string | null;
  useV3: boolean;
  v2Exists: boolean;
  fee: number | null;
}

export const usePoolAddress = () => {
  const publicClient = usePublicClient();
  
  // 检查池子是否存在
  const checkPoolExists = useCallback(async (address: string): Promise<boolean> => {
    try {
      const code = await publicClient?.getBytecode({
        address: address as Address,
      });
      return code !== undefined && code.length > 2;
    } catch (error) {
      console.warn('Error checking pool existence:', error);
      return false;
    }
  }, [publicClient]);

  // 检查 V3 池子
  const checkV3Pool = useCallback(async (
    token0: string,
    token1: string,
    specificFee?: number
  ): Promise<PoolCheckResult> => {
    const feesToCheck = specificFee ? [specificFee] : V3_FEE_TIERS;

    for (const fee of feesToCheck) {
      const poolAddress = await computeV3PoolAddress({
        factoryAddress: FACTORY_CONTRACT_ADDRESS_V3,
        tokenA: token0,
        tokenB: token1,
        fee
      });

      const exists = await checkPoolExists(poolAddress);
      if (exists) {
        return { poolAddress, exists, fee };
      }
    }

    return { poolAddress: null, exists: false };
  }, [checkPoolExists]);

  // 检查 V2 池子
  const checkV2Pool = useCallback(async (
    token0: string,
    token1: string
  ): Promise<PoolCheckResult> => {
    const poolAddress = await computeV2PoolAddress({
      factoryAddress: FACTORY_CONTRACT_ADDRESS,
      tokenA: token0,
      tokenB: token1
    });

    const exists = await checkPoolExists(poolAddress);
    return { poolAddress, exists };
  }, [checkPoolExists]);

  const getPoolAddress = useCallback(async (
    token0: string,
    token1: string,
    options?: {
      fee?: number,
      version?: 'v2' | 'v3'
    }
  ): Promise<PoolAddressResult> => {
    try {
      const { fee, version } = options || {};
      let v3Result: PoolCheckResult = { poolAddress: null, exists: false, fee: undefined };
      let v2Result: PoolCheckResult = { poolAddress: null, exists: false };

      // 根据版本检查对应的池子
      if (version !== 'v2') {
        v3Result = await checkV3Pool(token0, token1, fee);
      }

      if (version !== 'v3' && (!v3Result.exists || version === 'v2')) {
        v2Result = await checkV2Pool(token0, token1);
      }

      // 确定最终使用的池子
      const useV3 = version === 'v3' ? v3Result.exists : 
                    version === 'v2' ? false :
                    v3Result.exists;
      return {
        v3Pool: v3Result.poolAddress,
        v2Pool: v2Result.poolAddress,
        poolAddress: useV3 ? v3Result.poolAddress : (v2Result.exists ? v2Result.poolAddress : null),
        useV3,
        v2Exists: v2Result.exists,
        fee: v3Result.fee ?? null
      };
    } catch (error) {
      console.error('Error getting pool address:', error);
      throw error;
    }
  }, [checkV3Pool, checkV2Pool]);

  return { getPoolAddress };
};

// 计算 Uniswap V3 池子地址
async function computeV3PoolAddress({
  factoryAddress,
  tokenA,
  tokenB,
  fee
}: {
  factoryAddress: string;
  tokenA: string;
  tokenB: string;
  fee: number;
}): Promise<string> {
  // 确保 token0 和 token1 按字典序排序
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
  
  const poolAddress = await readContract(wagmiConfig, {
    address: factoryAddress as Address,
    abi: FACTORY_ABI_V3,
    functionName: 'getPool',
    args: [token0, token1, fee]
  });
  
  return poolAddress as string;
}

// 计算 Uniswap V2 池子地址
async function computeV2PoolAddress({
  factoryAddress,
  tokenA,
  tokenB
}: {
  factoryAddress: string;
  tokenA: string;
  tokenB: string;
}): Promise<string> {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
  
  const poolAddress = await readContract(wagmiConfig, {
    address: factoryAddress as Address,
    abi: FACTORY_ABI,
    functionName: 'getPair',
    args: [token0, token1]
  });
  return poolAddress as string;
}
