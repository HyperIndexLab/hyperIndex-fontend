import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { NONFUNGIBLE_POSITION_MANAGER_ABI, NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "../constant/ABI/NonfungiblePositionManager";
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from "../constant/ABI/HyperIndexFactoryV3";

export async function getV3Positions(address: string, poolAddress: string, publicClient: any) {
  if (!address || !poolAddress) {
    return {
      hasPosition: false,
      positionId: null,
      tickLower: null,
      tickUpper: null,
    };
  }

  try {
    // 查询用户的 NFT 头寸数量
    const balance: bigint = await publicClient?.readContract({
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: "balanceOf",
      args: [address],
    }) as bigint;


    const userBalance = Number(balance);

    // 遍历 NFT 头寸，检查是否属于该池子
    for (let i = 0; i < userBalance; i++) {
      const tokenId: bigint = await publicClient?.readContract({
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address, BigInt(i)],
      }) as bigint;

      const position = await publicClient?.readContract({
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "positions",
        args: [tokenId],
      });

      // 获取 position 中的 token0 和 token1，构建池子地址
      const positionPool = await publicClient?.readContract({
        address: FACTORY_CONTRACT_ADDRESS_V3,
        abi: FACTORY_ABI_V3,
        functionName: "getPool",
        args: [position[2], position[3], position[4]], // token0, token1, fee
      });

      if (positionPool?.toLowerCase() === poolAddress.toLowerCase()) {
        return {
          hasPosition: true,
          positionId: tokenId.toString(),
          tickLower: position[5],
          tickUpper: position[6],
        };
      }
    }

    return {
      hasPosition: false,
      positionId: null,
      tickLower: null,
      tickUpper: null,
    };
  } catch (error) {
    console.error("Error checking positions:", error);
    return {
      hasPosition: false,
      positionId: null,
      tickLower: null,
      tickUpper: null,
    };
  }
}

export function useV3Positions(poolAddress: string) {
  const { address, isConnected } = useAccount();
  const [hasPosition, setHasPosition] = useState(false);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!isConnected || !address || !poolAddress) {
      setHasPosition(false);
      setLoading(false);
      return;
    }

    const fetchPositions = async () => {
      const result = await getV3Positions(address, poolAddress, publicClient);
      setHasPosition(result.hasPosition);
      setPositionId(result.positionId);
      setLoading(false);
    };

    fetchPositions();
  }, [address, isConnected, poolAddress, publicClient]);

  return { hasPosition, positionId, loading };
}
