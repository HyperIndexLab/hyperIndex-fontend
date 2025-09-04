import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { 
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS, 
  NONFUNGIBLE_POSITION_MANAGER_ABI 
} from '@/constant/ABI/NonfungiblePositionManager';
import { ROUTER_CONTRACT_ADDRESS, ROUTER_ABI } from '@/constant/ABI/HyperIndexRouter';
import { Position } from '@uniswap/v3-sdk';
import { waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { wagmiConfig } from '@/components/RainbowKitProvider';
import { PAIR_ABI } from '../constant/ABI/HyperIndexPair';
import { WHSK } from '@/constant/value';

interface RemoveLiquidityParams {
  lpAmount: bigint;
  amount0: bigint;
  amount1: bigint;
  token0Address?: string;
  token1Address?: string;
  userAddress: string;
  pairAddress?: string;
  isV3?: boolean;
  tokenId?: bigint;
  position?: Position;
  percentage?: number;
}

interface ApproveParams {
  isV3: boolean;
  tokenId?: bigint;
  operator?: `0x${string}`;
  positionManager?: `0x${string}`;
  pairAddress?: `0x${string}`;
  amount?: bigint;
}

export function useRemoveLiquidity() {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { writeContractAsync: writeV2Router } = useWriteContract();
  const { writeContractAsync: writeERC20 } = useWriteContract();
  
  const { isLoading: isWaiting } = useWaitForTransactionReceipt();

  const approve = async (params: ApproveParams) => {
    setIsApproving(true);
    try {
      let hash;
      
      if (params.isV3) {
        if (!params.tokenId || !params.operator || !params.positionManager) {
          throw new Error('Missing required parameters for V3 approval');
        }
      } else {
        if (!params.pairAddress || !params.amount) {
          throw new Error('Missing required parameters for V2 approval');
        }
        
        // V2: 调用 ERC20 的 approve 方法
        hash = await writeERC20({
          address: params.pairAddress,
          abi: PAIR_ABI,
          functionName: 'approve',
          args: [ROUTER_CONTRACT_ADDRESS, params.amount]
        });
      }

      return { success: true, hash };
    } catch (error) {
      console.error('Approval failed:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      setIsApproving(false);
    }
  };

  const remove = async (params: RemoveLiquidityParams) => {
    setIsRemoving(true);
    try {
      let hash;

      if (params.isV3) {
        if (!params.tokenId || !params.position || !params.percentage) {
          throw new Error('TokenId and position are required for V3 removal');
        }
  
        // 首先调用 decreaseLiquidity
        const decreaseTx = await writeContract(wagmiConfig, {
          address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: 'decreaseLiquidity',
          args: [{
            tokenId: params.tokenId,
            liquidity: params.lpAmount,
            amount0Min: 0,  // 可以根据需要设置最小接收数量
            amount1Min: 0,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1800)
          }]
        });
        
        await waitForTransactionReceipt(wagmiConfig, { hash: decreaseTx });

        // 然后调用 collect 收取代币
        const collectTx = await writeContract(wagmiConfig, {
          address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId: params.tokenId,
            recipient: params.userAddress,
            amount0Max: 2n ** 128n - 1n,  // uint128 最大值
            amount1Max: 2n ** 128n - 1n
          }]
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: collectTx });

        setIsSuccess(true);
        return { success: true, hash };
      } else {
        const isToken0WHSK = params.token0Address === WHSK;
        const isToken1WHSK = params.token1Address === WHSK;

        const token0Address = params.token0Address;
        const token1Address = params.token1Address;
        const lpAmount = params.lpAmount;
        const amountAMin = (params.amount0 * 99n) / 100n;
        const amountBMin = (params.amount1 * 99n) / 100n;
        const userAddress = params.userAddress;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        // V2: 调用 Router 的 removeLiquidity 方法
        hash = await writeV2Router({
          address: ROUTER_CONTRACT_ADDRESS as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: isToken0WHSK || isToken1WHSK ? 'removeLiquidityETH' : 'removeLiquidity',
          args: isToken0WHSK || isToken1WHSK ? [
            isToken0WHSK ? token1Address : token0Address as `0x${string}`,  
            lpAmount.toString(),                                          
            isToken0WHSK ? amountBMin : amountAMin.toString(),             
            isToken0WHSK ? amountAMin : amountBMin.toString(),             
            userAddress as `0x${string}`,                                 
            deadline.toString(),                                           
          ] : [
            token0Address as `0x${string}`,
            token1Address as `0x${string}`,
            lpAmount.toString(),
            amountAMin.toString(),
            amountBMin.toString(),
            userAddress as `0x${string}`,
            deadline.toString(),
          ],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: hash as `0x${string}` });
        setIsSuccess(true)
      }

      setIsSuccess(true);
      return { success: true, hash };
    } catch (error) {
      console.error('Remove liquidity failed:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    remove,
    approve,
    isRemoving,
    isApproving,
    isWaiting,
    isSuccess
  };
}