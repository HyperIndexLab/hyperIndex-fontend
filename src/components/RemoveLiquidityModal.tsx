import React, { useState, useMemo, useEffect } from 'react';
import { usePoolData } from '../hooks/usePoolData';
import { useRemoveLiquidity } from '../hooks/useRemoveLiquidity';
import { useToast } from '@/components/ToastContext';

import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { ROUTER_CONTRACT_ADDRESS } from '../constant/ABI/HyperIndexRouter';
import { Pool, Position } from '@uniswap/v3-sdk';
import { Token, Percent } from '@uniswap/sdk-core';
import JSBI from 'jsbi';
import { formatTokenBalance } from '@/utils/formatTokenBalance';
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NONFUNGIBLE_POSITION_MANAGER_ABI } from '@/constant/ABI/NonfungiblePositionManager';
import BigNumber from 'bignumber.js';

export interface PoolInfo {  
  token0Symbol: string;
  token1Symbol: string;
  userLPBalance: string;
  token0Amount: string;
  token1Amount: string;
  token0Price?: string;
  token1Price?: string;
  pairAddress: string;
  userAddress: string;
  token0Address: string;
  token1Address: string;
  poolShare: string;
  isV3?: boolean;
  fee?: number;
  tickLower?: number;
  tickUpper?: number;
  liquidity?: bigint;
  tokenId?: bigint;
  token0?: Token;
  token1?: Token;
  pool?: Pool;
}

interface RemoveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: PoolInfo;
  onSuccess?: () => void;
}

const RemoveLiquidityModal: React.FC<RemoveLiquidityModalProps> = ({
  isOpen,
  onClose,
  pool,
  onSuccess,
}) => {
  const [percentage, setPercentage] = useState(0);
  const networkFee = "0.0001";
  const { toast } = useToast();
  const dataV2 = usePoolData(pool.pairAddress, pool.userAddress);

  let poolData: any, loading: any;
  if (pool.isV3) { 
    loading = false;
    poolData = pool;
  } else {
    poolData = dataV2.data;
    loading = dataV2.loading;
  }
 
  const { remove, approve, isRemoving, isApproving, isWaiting } = useRemoveLiquidity();
  const [needsApproval, setNeedsApproval] = useState(true);

    // 根据不同代币的精度来格式化数值
  const formatTokenAmount = (amount: BigNumber, decimals: number) => {
    return amount.dividedBy(new BigNumber(10).pow(decimals));
  };

  const amounts = useMemo(() => {
    if (!poolData) return null;
    if (pool.isV3 && pool.pool && pool.tickLower && pool.tickUpper && pool.liquidity) {  
      const position = new Position({
        pool: pool.pool,
        tickLower: pool.tickLower,
        tickUpper: pool.tickUpper,
        liquidity: JSBI.BigInt(pool.liquidity.toString()),
      });

      if (percentage === 0) {
        return {
          token0Amount: 0n,
          token1Amount: 0n,
          token0Price: pool.pool.token1Price.toSignificant(4),
          token1Price: pool.pool.token0Price.toSignificant(4),
        };
      }

      // 当百分比为 0 时，不应该移除任何流动性
      const liquidityPercentage = new Percent(JSBI.BigInt(100 - percentage), JSBI.BigInt(100));
     
      // 获取移除后能收到的代币数量
      const { amount0: token0Amount, amount1: token1Amount } = position.burnAmountsWithSlippage(liquidityPercentage);
   
      // 计算代币价格
      const token0Price = pool.pool.token1Price;
      const token1Price = pool.pool.token0Price;

      return {
        token0Amount: BigInt(token0Amount.toString()),
        token1Amount: BigInt(token1Amount.toString()),
        token0Price: token0Price.toSignificant(4),
        token1Price: token1Price.toSignificant(4),
        constructPosition: position
      };
    } else {
      const userBalance = new BigNumber(poolData.userBalance.toString());
      const totalSupply = new BigNumber(poolData.totalSupply.toString());
      const reserve0 = new BigNumber(poolData.reserves[0].toString());
      const reserve1 = new BigNumber(poolData.reserves[1].toString());
      const token0Decimals = pool.token0Symbol === "USDT" ? 6 : 18;
      const token1Decimals = pool.token1Symbol === "USDT" ? 6 : 18;
  
      const token0Amount = reserve0.multipliedBy(userBalance).dividedBy(totalSupply).toFixed(0);
      const token1Amount = reserve1.multipliedBy(userBalance).dividedBy(totalSupply).toFixed(0);

      
      const token0Formatted = formatTokenAmount(reserve0, token0Decimals);
      const token1Formatted = formatTokenAmount(reserve1, token1Decimals);
    
      
      const token0Price = token1Formatted.dividedBy(token0Formatted);
      const token1Price = token0Formatted.dividedBy(token1Formatted);

      return {
        token0Amount,
        token1Amount,
        token0Price: token0Price.toFixed(4),
        token1Price: token1Price.toFixed(4),
      };
    }
  }, [pool.token0Symbol, pool.token1Symbol, poolData, pool.isV3, percentage, pool.pool, pool.tickLower, pool.tickUpper, pool.liquidity]);

  const calculateTokenAmount = (amount: string, percentage: number, decimals: number) => {
    const amountBN = new BigNumber(amount);
    const percentageBN = new BigNumber(percentage).dividedBy(100);
    const rawAmount = amountBN.multipliedBy(percentageBN);
    return rawAmount.dividedBy(new BigNumber(10).pow(decimals)).toFixed(4);
  };

  const { data: allowance } = useReadContract({
    address: pool.pairAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: pool.userAddress ? [
      pool.userAddress as `0x${string}`,
      ROUTER_CONTRACT_ADDRESS as `0x${string}`
    ] : undefined,
    query: {
      enabled: !!pool.userAddress && !pool.isV3,
    },
  });

  const { data: isApprovedForAll } = useReadContract({
    address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: 'isApprovedForAll',
    args: pool.userAddress ? [
      pool.userAddress as `0x${string}`,
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`
    ] : undefined,
    query: {
      enabled: !!pool.userAddress && pool.isV3,
    },
  });

  useEffect(() => {
    if (pool.isV3) {
      setNeedsApproval(false);
    } else {
      if (!amounts || !poolData || percentage === 0 || !allowance) return;
      const lpAmount = (poolData.userBalance * BigInt(percentage)) / 100n;
      setNeedsApproval(BigInt(allowance) < lpAmount);
    }
  }, [amounts, poolData, percentage, allowance, isApprovedForAll, pool.isV3]);
  
  

  const handleApprove = async () => {
    if (!amounts || !poolData) return;
    
   
    toast({
      type: 'info',
      message: 'Approving...',
      isAutoClose: true
    });

    try {
      if (pool.isV3) {
        // V3 的授权是设置 NFT Position Manager 的 Approval For All
        const result = await approve({
          isV3: true,
          tokenId: pool.tokenId,
          operator: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,  // operator 是被授权的地址
          positionManager: NONFUNGIBLE_POSITION_MANAGER_ADDRESS
        });
        
        if (result.success) {
          toast({
            type: 'success',
            message: 'Successfully approved position manager',
            isAutoClose: true
          });
          setNeedsApproval(false);
        } else {
          toast({
            type: 'error',
            message: result.error || "Failed to approve position manager",
            isAutoClose: true
          });
        }
      } else {
        const lpAmount = (poolData.userBalance * BigInt(percentage)) / 100n;
        const result = await approve({
          isV3: false,
          pairAddress: pool.pairAddress as `0x${string}`,
          amount: lpAmount
        });
        if (result.success) {
          toast({
            type: 'success',
            message: 'Successfully approved',
            isAutoClose: true
          });
          setNeedsApproval(false);
        } else {
          toast({
            type: 'error',
            message: result.error || "Failed to approve",
            isAutoClose: true
          });
        }
      }
    } catch (error) {
      toast({
        type: 'error',
        message: "Failed to approve",
        isAutoClose: true
      });
      console.error(error);
    }
  };

  if (!isOpen) return null;

  const handlePercentageClick = (value: number) => {
    setPercentage(value);
  };


  const handleRemove = async () => {
    if (!amounts || !poolData) return;
    
    const lpAmount = (poolData.userBalance * BigInt(percentage)) / 100n;
    const amount0 = BigNumber(amounts.token0Amount.toString()).multipliedBy(percentage).dividedBy(100).toFixed(0);
    const amount1 = BigNumber(amounts.token1Amount.toString()).multipliedBy(percentage).dividedBy(100).toFixed(0);

    // 设置滑点
    const slippage = 0.005; // 0.5%


    let removeParams;
    if (pool.isV3) {
      removeParams = {
        isV3: true,
        tokenId: pool.tokenId,
        lpAmount: (pool.liquidity! * BigInt(percentage)) / 100n,
        amount0: BigInt(amount0.toString()),
        amount1: BigInt(amount1.toString()),
        userAddress: pool.userAddress,
        position: amounts.constructPosition,
        percentage: percentage,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
      };
    } else {
      const lpAmount = (poolData.userBalance * BigInt(percentage)) / 100n;
     // 原始数量（无滑点）
      const rawAmount0 = new BigNumber(amounts.token0Amount.toString())
      .multipliedBy(percentage)
      .dividedBy(100);

      const rawAmount1 = new BigNumber(amounts.token1Amount.toString())
      .multipliedBy(percentage)
      .dividedBy(100);

      // 加入滑点后再转 BigInt（向下取整）
      const amount0 = rawAmount0
      .multipliedBy(1 - slippage)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed();

      const amount1 = rawAmount1
      .multipliedBy(1 - slippage)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed();

      removeParams = {
        isV3: false,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
        userAddress: pool.userAddress,
        lpAmount,
        amount0: BigInt(amount0.toString()),
        amount1: BigInt(amount1.toString()),
        pairAddress: pool.pairAddress,
      }
    }

    toast({
      type: 'info',
      message: 'Removing liquidity...',
      isAutoClose: true
    });

    try {
      const result = await remove(removeParams);

      if (result.success) {
        toast({
          type: 'success',
          message: 'Successfully removed liquidity',
          isAutoClose: true
        });
        onClose();
      } else {
        toast({
          type: 'error',
          message: result.error || "Failed to remove liquidity",
          isAutoClose: true
        });
      }
    } catch (error) {
      toast({ 
        type: 'error',
        message: "Failed to remove liquidity",
        isAutoClose: true
      });
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-100 rounded-3xl w-full max-w-md p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold">Remove liquidity</h2>
        </div>

        {loading ? (
          // 骨架屏
          <div className="space-y-4 animate-pulse">
            <div className="bg-base-200 rounded-2xl p-4">
              <div className="h-12 bg-base-300 rounded-lg mb-4"></div>
              <div className="h-8 bg-base-300 rounded-lg mb-2"></div>
              <div className="h-12 bg-base-300 rounded-lg"></div>
            </div>
            <div className="bg-base-200 rounded-2xl p-4 space-y-2">
              <div className="h-6 bg-base-300 rounded-lg"></div>
              <div className="h-6 bg-base-300 rounded-lg"></div>
            </div>
          </div>
        ) : amounts ? (
          <>
            {/* Pool Info */}
            <div className="bg-base-200 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative w-12 h-6">
                  <img 
                    src="/img/index-coin.jpg" 
                    alt={pool.token0Symbol}
                    className="w-6 h-6 rounded-full absolute left-0"
                  />
                  <img 
                    src="/img/index-coin.jpg" 
                    alt={pool.token1Symbol}
                    className="w-6 h-6 rounded-full absolute left-4"
                  />
                </div>
                <div>
                  <div className="font-bold text-lg">
                    {pool.token0Symbol}/{pool.token1Symbol}
                  </div>
                  <div className="text-xs opacity-70">
                    Available: {pool.userLPBalance} LP Tokens
                  </div>
                </div>
              </div>

              {/* Percentage Slider */}
              <div className="space-y-3">
                <div className="text-3xl font-bold text-center">
                  {percentage}%
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={percentage} 
                  onChange={(e) => setPercentage(Number(e.target.value))}
                  className="range range-primary"
                />
                <div className="flex justify-between gap-2">
                  {[25, 50, 75, 100].map((value) => (
                    <button
                      key={value}
                      onClick={() => handlePercentageClick(value)}
                      className="btn btn-sm btn-outline flex-1 rounded-full"
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Token Amounts */}
            <div>
              <div className="text-sm opacity-70 mb-2">You will receive:</div>
              <div className="bg-base-200 rounded-2xl p-4 space-y-4">
                {/* 第一个代币 */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-3xl">
                      {pool.isV3 
                        ? formatTokenBalance(amounts.token0Amount.toString(), pool.token0?.decimals?.toString() ?? "18") 
                        :calculateTokenAmount(amounts.token0Amount.toString(), percentage, pool.token0Symbol === "USDT" ? 6 : 18)}
                    </div>
                    <div className="text-sm text-base-content">
                      1 {pool.token0Symbol} = {amounts.token0Price} {pool.token1Symbol}
                    </div>
                  </div>
                  <div className="text-xl">{pool.token0Symbol}</div>
                </div>

                {/* 第二个代币 */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-3xl">
                      {pool.isV3 
                        ? formatTokenBalance(amounts.token1Amount.toString(), pool.token1?.decimals?.toString() ?? "18") 
                        : calculateTokenAmount(amounts.token1Amount.toString(), percentage, pool.token1Symbol === "USDT" ? 6 : 18)}</div>
                    <div className="text-sm text-base-content">
                      1 {pool.token1Symbol} = {amounts.token1Price} {pool.token0Symbol}
                    </div>
                  </div>
                  <div className="text-xl">{pool.token1Symbol}</div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Network Fee */}
        <div className="flex justify-between text-sm opacity-70">
          <span>Network fee:</span>
          <span>{networkFee} HSK</span>
        </div>

        {/* Confirm Button */}
        <button 
          className="btn btn-primary w-full rounded-full btn-md"
          disabled={percentage === 0 || isRemoving || isWaiting || isApproving}
          onClick={needsApproval ? handleApprove : handleRemove}
        >
          {isRemoving || isWaiting || isApproving ? (
            <span className="loading loading-spinner"></span>
          ) : needsApproval ? (
            'Approve'
          ) : (
            'Confirm'
          )}
        </button>
      </div>
    </div>
  );
};

export default RemoveLiquidityModal; 