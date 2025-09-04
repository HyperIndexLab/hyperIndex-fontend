import { useState, useEffect } from 'react';
import { useReadContracts } from 'wagmi';
import { type Abi } from 'viem';
import { PAIR_ABI } from '../constant/ABI/HyperIndexPair';

export const usePoolData = (pairAddress: string, userAddress: string) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    reserves: readonly [bigint, bigint, number];
    totalSupply: bigint;
    userBalance: bigint;
  } | null>(null);

  const { data: poolData, isLoading: contractsLoading } = useReadContracts({
    contracts: [
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI as Abi,
        functionName: 'getReserves',
      },
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI as Abi,
        functionName: 'totalSupply',
      },
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI as Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      },
    ],
  });

  useEffect(() => {
    if (poolData && poolData.every(result => result.status === 'success')) {
      setData({
        reserves: poolData[0].result as readonly [bigint, bigint, number],
        totalSupply: poolData[1].result as bigint,
        userBalance: poolData[2].result as bigint,
      });
      setLoading(false);
    }
  }, [poolData]);

  useEffect(() => {
    setLoading(contractsLoading);
  }, [contractsLoading]);

  return { data, loading };
}; 