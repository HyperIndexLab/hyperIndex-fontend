import {  useReadContract, useReadContracts } from 'wagmi'
import { Abi, Address, erc20Abi, formatUnits } from 'viem'
import { useMemo } from 'react'
import { NONFUNGIBLE_POSITION_MANAGER_ABI, NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from '../constant/ABI/NonfungiblePositionManager'
import { Token } from '@uniswap/sdk-core'
import { Pool, Position, TickMath } from '@uniswap/v3-sdk'
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from '@/constant/ABI/HyperIndexFactoryV3'
import { SWAP_V3_POOL_ABI as POOL_ABI } from '@/constant/ABI/HyperIndexSwapV3Pool'
import JSBI from 'jsbi'
import { hashkeyTestnet } from 'viem/chains'

interface PoolData {
  token0Symbol: string
  token1Symbol: string
  token0Amount: string
  token1Amount: string
  poolShare: string
  tokenId: bigint
  userLPBalance: string
  fee: number
  token0Address: Address
  token1Address: Address
  poolAddr: Address
  tickLower: number
  tickUpper: number
  liquidity: bigint
  userAddress: Address
  token0: Token
  token1: Token
  pool: Pool
}

interface PositionInfo {
  tokenId: bigint
  token0: Address
  token1: Address
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
  totalLiquidity: bigint
  token0Decimals: number
  token1Decimals: number
}

interface PositionResult {
  [0]: bigint // nonce
  [1]: bigint // operator
  [2]: bigint // token0
  [3]: bigint // token1
  [4]: bigint // fee
  [5]: bigint // tickLower
  [6]: bigint // tickUpper
  [7]: bigint // liquidity
  [8]: bigint // feeGrowthInside0LastX128
  [9]: bigint // feeGrowthInside1LastX128
  [10]: bigint // tokensOwed0
  [11]: bigint // tokensOwed1
}

function getTokenAmountsFromPosition(
  positionInfo: PositionInfo, 
  poolSqrtPriceX96: bigint,
  token0Symbol: string,
  token1Symbol: string
) {
  const token0 = new Token(hashkeyTestnet.id, positionInfo.token0, positionInfo.token0Decimals, token0Symbol, token0Symbol)
  const token1 = new Token(hashkeyTestnet.id, positionInfo.token1, positionInfo.token1Decimals, token1Symbol, token1Symbol)

  let sqrtPriceX96 = poolSqrtPriceX96
  if (sqrtPriceX96 <= 0n) {
    sqrtPriceX96 = 1n
  }

  const pool = new Pool(
    token0,
    token1,
    positionInfo.fee,
    sqrtPriceX96.toString(),
    positionInfo.totalLiquidity.toString(),
    TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString()))
  )

  const position = new Position({
    pool,
    liquidity: positionInfo.liquidity.toString(),
    tickLower: positionInfo.tickLower,
    tickUpper: positionInfo.tickUpper,
  })

  return {
    token0: token0,
    token1: token1,
    pool: pool,
    amount0: position.amount0.toSignificant(6), // Token0 数量
    amount1: position.amount1.toSignificant(6)  // Token1 数量
  }
}

function calculatePoolShare(positionLiquidity: bigint, totalLiquidity: bigint): string {
  if (totalLiquidity === 0n) return '0'
  
  // 使用 JSBI 处理大数计算
  const position = JSBI.BigInt(positionLiquidity.toString())
  const total = JSBI.BigInt(totalLiquidity.toString())
  const hundred = JSBI.BigInt(10000) // 使用10000来保留2位小数
  
  // 计算: (position * 10000 / total) / 100 以得到百分比
  const share = JSBI.divide(JSBI.multiply(position, hundred), total)
  return (Number(share.toString()) / 100).toFixed(2)
}

export function useUserPoolsV3Data(userAddress: Address | undefined): {
  poolsData: PoolData[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const { data: balanceOf, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI as Abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined
  });

  const tokenOfOwnerByIndexCalls = useMemo(() => {
    if (!balanceOf || !userAddress) return [];
    return Array.from({ length: Number(balanceOf) }, (_, i) => ({
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI as Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [userAddress, BigInt(i)]
    }));
  }, [balanceOf, userAddress]);

  const { data: tokenIds, isLoading: tokenIdsLoading, refetch: refetchTokenIds } = useReadContracts({
    contracts: tokenOfOwnerByIndexCalls
  });

  const positionCalls = useMemo(() => {
    if (!tokenIds) return [];
    return tokenIds.map(tokenId => ({
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI as Abi,
      functionName: 'positions',
      args: [tokenId.result]
    }));
  }, [tokenIds]);

  const { data: positionsData, isLoading: positionsLoading, refetch: refetchPositions } = useReadContracts({
    contracts: positionCalls
  });

  const tokenSymbolCalls = useMemo(() => {
    if (!positionsData) return [];
    const calls: any[] = [];
    positionsData.forEach(position => {
      if (position) {
        calls.push({
          address: (position.result as PositionResult)[2].toString() as Address,
          abi: erc20Abi,
          functionName: 'symbol'
        });
        calls.push({
          address: (position.result as PositionResult)[3].toString() as Address,
          abi: erc20Abi,
          functionName: 'symbol'
        });
      }
    });
    return calls;
  }, [positionsData]);

  const { data: tokenSymbols, isLoading: symbolsLoading, refetch: refetchSymbols } = useReadContracts({
    contracts: tokenSymbolCalls
  });

  const tokenDecimalsCalls = useMemo(() => {
    if (!positionsData) return [];
    const calls: any[] = [];
    positionsData.forEach(position => {
      if (position) {
        calls.push({
          address: (position.result as PositionResult)[2].toString() as Address,
          abi: erc20Abi,
          functionName: 'decimals'
        });
        calls.push({
          address: (position.result as PositionResult)[3].toString() as Address,
          abi: erc20Abi,
          functionName: 'decimals'
        });
      }
    });
    return calls;
  }, [positionsData]);

  const { data: tokenDecimals, isLoading: decimalsLoading, refetch: refetchDecimals } = useReadContracts({
    contracts: tokenDecimalsCalls
  });

  const poolAddressCalls = useMemo(() => {
    if (!positionsData || !tokenSymbols) return [];
    return positionsData.map((position) => {
      if (!position?.result) return null;
      const positionResult = position.result as unknown as PositionResult;
      
      // 修复token地址格式
      const token0Address = positionResult[2]
      const token1Address = positionResult[3]
      
      return {
        address: FACTORY_CONTRACT_ADDRESS_V3 as `0x${string}`,
        abi: FACTORY_ABI_V3 as Abi,
        functionName: 'getPool',
        args: [token0Address, token1Address, Number(positionResult[4])]
      };
    }).filter((call): call is NonNullable<typeof call> => call !== null);
  }, [positionsData, tokenSymbols]);

  const { data: poolAddresses, refetch: refetchPoolAddresses } = useReadContracts({
    contracts: poolAddressCalls
  });

  const slot0Calls = useMemo(() => {
    if (!poolAddresses) return [];
    return poolAddresses.map(poolData => {
      if (!poolData?.result) return null;
      const poolAddress = poolData.result as Address;
      if (poolAddress === '0x0000000000000000000000000000000000000000') return null;
      
      return {
        address: poolAddress as `0x${string}`,
        abi: POOL_ABI as Abi,
        functionName: 'slot0',
      };
    }).filter((call): call is NonNullable<typeof call> => call !== null);
  }, [poolAddresses]);

  const { data: slot0DataArray, refetch: refetchSlot0 } = useReadContracts({
    contracts: slot0Calls
  });

  const liquidityCalls = useMemo(() => {
    if (!poolAddresses) return [];
    return poolAddresses.map(poolData => {
      if (!poolData?.result) return null;
      const poolAddress = poolData.result as Address;
      if (poolAddress === '0x0000000000000000000000000000000000000000') return null;
      
      return {
        address: poolAddress as `0x${string}`,
        abi: POOL_ABI as Abi,
        functionName: 'liquidity',
      };
    }).filter((call): call is NonNullable<typeof call> => call !== null);
  }, [poolAddresses]);

  const { data: liquidityDataArray, refetch: refetchLiquidity } = useReadContracts({
    contracts: liquidityCalls
  });

  const poolsData = useMemo(() => {
    if (!positionsData || !tokenSymbols || !tokenIds || !slot0DataArray || !liquidityDataArray || !tokenDecimals || !poolAddresses) return [];
    return positionsData.map((position, index) => {
      if (!position?.result) return null;
  
      const symbol0 = tokenSymbols[index * 2]?.result;
      const symbol1 = tokenSymbols[index * 2 + 1]?.result;
      const decimals0 = tokenDecimals[index * 2]?.result ?? 18;
      const decimals1 = tokenDecimals[index * 2 + 1]?.result ?? 18;
      const positionResult = position.result as unknown as PositionResult;
      const sqrtPriceX96 = (slot0DataArray?.[index]?.result as [bigint, number, ...any[]])?.[0] ?? 0n;
  
      if (!symbol0 || !symbol1) return null;
  
      // 计算 Token 数量
      const tokenAmounts = getTokenAmountsFromPosition({
        tokenId: tokenIds[index].result as bigint,
        token0: positionResult[2].toString() as Address,
        token1: positionResult[3].toString() as Address,
        fee: Number(positionResult[4]),
        tickLower: Number(positionResult[5]),
        tickUpper: Number(positionResult[6]),
        liquidity: positionResult[7] as bigint,
        tokensOwed0: positionResult[10] as bigint,
        tokensOwed1: positionResult[11],
        token0Decimals: Number(decimals0),
        token1Decimals: Number(decimals1),
        totalLiquidity: positionResult[7],
      }, sqrtPriceX96, symbol0 as string, symbol1 as string);
  
      return {
        token0Symbol: symbol0 as string,
        token1Symbol: symbol1 as string,
        token0Amount: tokenAmounts.amount0,
        token1Amount: tokenAmounts.amount1,
        token0: tokenAmounts.token0,
        token1: tokenAmounts.token1,
        poolShare: calculatePoolShare(positionResult[7], (liquidityDataArray[index]?.result as bigint) ?? 0n),
        tokenId: tokenIds[index].result,
        token0Address: positionResult[2].toString() as Address,
        token1Address: positionResult[3].toString() as Address,
        fee: Number(positionResult[4]),
        userLPBalance: formatUnits(positionResult[7], Number(decimals0)),
        poolAddr: poolAddresses[index]?.result as Address,
        tickLower: Number(positionResult[5]),
        tickUpper: Number(positionResult[6]),
        liquidity: positionResult[7],
        userAddress: userAddress,
        pool: tokenAmounts.pool,
      };
    }).filter(Boolean) as PoolData[];
  }, [positionsData, tokenSymbols, tokenIds, slot0DataArray, liquidityDataArray, tokenDecimals, poolAddresses, userAddress]);
  

  const isLoading = balanceLoading || tokenIdsLoading || positionsLoading || symbolsLoading || decimalsLoading;

  const refetch = async () => {
    await Promise.all([
      refetchBalance(),
      refetchTokenIds(),
      refetchPositions(),
      refetchSymbols(),
      refetchDecimals(),
      refetchPoolAddresses(),
      refetchSlot0(),
      refetchLiquidity()
    ]);
  };

  return {
    poolsData,
    isLoading,
    error: null,
    refetch
  };
}
