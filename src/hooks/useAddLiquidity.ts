import { usePublicClient, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt, readContract } from 'wagmi/actions';
import { sendTransaction } from 'wagmi/actions';
import { wagmiConfig } from '@/components/RainbowKitProvider';
import {  parseUnits } from 'viem'; 
import { FACTORY_ABI_V3, FACTORY_CONTRACT_ADDRESS_V3 } from '@/constant/ABI/HyperIndexFactoryV3';
import { SWAP_V3_POOL_ABI as POOL_ABI } from '@/constant/ABI/HyperIndexSwapV3Pool';
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from '@/constant/ABI/NonfungiblePositionManager';
import { useToast } from '@/components/ToastContext';
import { AddLiquidityOptions, encodeSqrtRatioX96, MintOptions } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import { BigintIsh, Token } from '@uniswap/sdk-core';
import { Slot0Data } from '@/hooks/usePoolBaseInfo';
import { isValidAddress } from '@/utils';
import { WHSK } from '@/constant/value';
import { useCallback, useState } from 'react';
import { Pool, Position } from '@uniswap/v3-sdk';
import { Percent } from '@uniswap/sdk-core';
import { TickMath } from '@uniswap/v3-sdk';
import { NonfungiblePositionManager } from '@uniswap/v3-sdk';
import { hashkeyTestnet } from 'viem/chains';
import { getV3Positions } from '@/hooks/useV3Positions';

export const useAddLiquidity = (
  token1Data: any,
  token2Data: any,
  userAddress: string | undefined,
  poolAddress: `0x${string}` | null,
  existingPool: any,
  tickRange: { minTick: number; maxTick: number },
  token1Amount: string,
  token2Amount: string,
  feeTier: number,
  needApprove: { token1: boolean; token2: boolean },
  handleApprove: (isToken1: boolean) => Promise<void>
) => {
  const { writeContractAsync } = useWriteContract();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const publicClient = usePublicClient();

   // 创建Token对象
   const getTokens = useCallback(() => {
    if (!token1Data || !token2Data || !token1Data.decimals || !token2Data.decimals) {
      return { token0: null, token1: null };
    }
    
    // 确保地址是有效的
    const address1 = isValidAddress(token1Data.address) ? token1Data.address : WHSK;
    const address2 = isValidAddress(token2Data.address) ? token2Data.address : WHSK;

    let token0;
    let token1;
    
    if (address1.toLowerCase() < address2.toLowerCase()) {
      // 创建Token对象
     token0 = new Token(
       hashkeyTestnet.id, // chainId
       address1 as `0x${string}`,
       parseInt(token1Data.decimals),
       token1Data.symbol,
       token1Data.name
     );

     token1 = new Token(
       hashkeyTestnet.id, // chainId
       address2 as `0x${string}`,
       parseInt(token2Data.decimals),
       token2Data.symbol,
       token2Data.name
     );
   } else {
     token0 = new Token(
       hashkeyTestnet.id, // chainId
       address2 as `0x${string}`,
       parseInt(token2Data.decimals),
       token2Data.symbol,
       token2Data.name
     );

     token1 = new Token(
       hashkeyTestnet.id, // chainId
       address1 as `0x${string}`,
       parseInt(token1Data.decimals),
       token1Data.symbol,
       token1Data.name
     );
   }
    
    return { token0, token1 };
  }, [token1Data, token2Data]);
  

  const addLiquidity = async () => {
    if (!token1Data || !token2Data || !userAddress) {
      toast({
        type: "error",
        message: "缺少必要信息，无法添加流动性",
        isAutoClose: true
      });
      return;
    }

    try {
      setLoading(true);
      // 确保token0和token1按照正确的顺序排列（地址较小的在前）
      const token0Address = token1Data.address.toLowerCase() < token2Data.address.toLowerCase() 
        ? token1Data.address 
        : token2Data.address;
      const token1Address = token1Data.address.toLowerCase() < token2Data.address.toLowerCase() 
        ? token2Data.address 
        : token1Data.address;
      
      let poolAddr = poolAddress;

      if (!existingPool) {
        // 创建新池子
        toast({
          type: "info",
          message: "creating new liquidity pool...",
          isAutoClose: true
        });

        const createPoolTx = await writeContractAsync({
          address: FACTORY_CONTRACT_ADDRESS_V3 as `0x${string}`,
          abi: FACTORY_ABI_V3,
          functionName: 'createPool',
          args: [token0Address, token1Address, feeTier]
        });
        
        toast({
          type: "info",
          message: "creating liquidity pool, please wait for confirmation...",
          isAutoClose: true
        });

        // 等待交易确认
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: createPoolTx });
      
        if (receipt.status !== 'success') {
          toast({
            type: "error",
            message: "liquidity pool creation failed, please try again",
            isAutoClose: true
          });
          return;
        }
        
        // 初始化池子
        const isToken0First = token1Data.address.toLowerCase() < token2Data.address.toLowerCase();
        const amount0 = parseUnits(
          isToken0First ? token1Amount : token2Amount,
          parseInt(isToken0First ? token1Data.decimals : token2Data.decimals)
        );
        const amount1 = parseUnits(
          isToken0First ? token2Amount : token1Amount,
          parseInt(isToken0First ? token2Data.decimals : token1Data.decimals)
        );
        const sqrtPriceX96 = BigInt(encodeSqrtRatioX96(amount1.toString(), amount0.toString()).toString());


        TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString()));
        poolAddr = await readContract(wagmiConfig, {
          address: FACTORY_CONTRACT_ADDRESS_V3 as `0x${string}`,
          abi: FACTORY_ABI_V3,
          functionName: 'getPool',
          args: [token0Address, token1Address, feeTier]
        }) as `0x${string}`;
       

        try {
          const initializeTx = await writeContractAsync({
            address: poolAddr as `0x${string}`,
            abi: POOL_ABI,
            functionName: 'initialize',
            args: [sqrtPriceX96]
          });

          toast({
            type: "info",
            message: "initializing...",
            isAutoClose: true
          });

          const initializeReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: initializeTx });
          
          if (initializeReceipt.status !== 'success') {
            toast({
              type: "error",
              message: "initializing failed",
              isAutoClose: true
            });
            return;
          }

          toast({
            type: "success",
            message: "initializing success",
            isAutoClose: true
          });
        } catch (error) {
          console.error("初始化池子失败:", error);
          toast({
            type: "error",
            message: "initializing failed",
            isAutoClose: true
          });
          return;
        }
        
        toast({
          type: "success",
          message: "pool created success",
          isAutoClose: true
        });
      } else if (!poolAddr) {
        // 如果池子已存在但我们没有地址，获取池子地址
        poolAddr = await readContract(wagmiConfig, {
          address: FACTORY_CONTRACT_ADDRESS_V3 as `0x${string}`,
          abi: FACTORY_ABI_V3,
          functionName: 'getPool',
          args: [token0Address, token1Address, feeTier]
        }) as `0x${string}`;
      }


      let sqrtPriceX96: bigint;
      const slot0 = await readContract(wagmiConfig, {
        address: poolAddr as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'slot0'
      }) as Slot0Data;

      sqrtPriceX96 = slot0[0]

      if (slot0[0] === BigInt(0)) {
        try {
          const isToken0First = token1Data.address.toLowerCase() < token2Data.address.toLowerCase();
        
          const amount0 = parseUnits(
            isToken0First ? token1Amount : token2Amount,
            parseInt(isToken0First ? token1Data.decimals : token2Data.decimals)
          );
          const amount1 = parseUnits(
            isToken0First ? token2Amount : token1Amount,
            parseInt(isToken0First ? token2Data.decimals : token1Data.decimals)
          );

          sqrtPriceX96 = BigInt(encodeSqrtRatioX96(amount1.toString(), amount0.toString()).toString());
          TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString()));

          const initializeTx = await writeContractAsync({
            address: poolAddr as `0x${string}`,
            abi: POOL_ABI,
            functionName: 'initialize',
            args: [sqrtPriceX96]
          });

          toast({
            type: "info",
            message: "initializing pool...",
            isAutoClose: true
          });

          const initializeReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: initializeTx });
          
          if (initializeReceipt.status !== 'success') {
            toast({
              type: "error",
              message: "池子初始化失败，请重试",
              isAutoClose: true
            });
            return;
          }

          toast({
            type: "success",
            message: "initialize pool success",
            isAutoClose: true
          });
        } catch (error) {
          console.error("initialize pool failed:", error);
          toast({
            type: "error",
            message: "initialize pool failed, please try again",
            isAutoClose: true
          });
          return;
        }
      }
      
      if (needApprove.token1) {
        await handleApprove(true);
      }

      if (needApprove.token2) {
        await handleApprove(false);
      }

      const amount0 = parseUnits(
        token1Data.address.toLowerCase() < token2Data.address.toLowerCase() ? token1Amount : token2Amount,
        parseInt(token1Data.address.toLowerCase() < token2Data.address.toLowerCase() ? token1Data.decimals : token2Data.decimals)
      );

      const amount1 = parseUnits(
        token1Data.address.toLowerCase() < token2Data.address.toLowerCase() ? token2Amount : token1Amount,
        parseInt(token1Data.address.toLowerCase() < token2Data.address.toLowerCase() ? token2Data.decimals : token1Data.decimals)
      );
  
      // sqrtPriceX96 = BigInt(encodeSqrtRatioX96(amount1.toString(), amount0.toString()).toString());
      const tick = TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString()));
  
      const { token0, token1 } = getTokens();
      if (!token0 || !token1) return;
    
      const liquidity = await readContract(wagmiConfig, {
        address: poolAddr as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'liquidity'
      }) as BigintIsh;
    
      const configuredPool = new Pool(
        token0,
        token1,
        feeTier,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        tick
      );

      let position;
      if (amount0 === BigInt(0)) {
        // 只提供 token1
        position = Position.fromAmount1({
          pool: configuredPool,
          tickLower: tickRange.minTick,
          tickUpper: tickRange.maxTick,
          amount1: amount1.toString(),
        });
      } else if (amount1 === BigInt(0)) {
        // 只提供 token0
        position = Position.fromAmount0({
          pool: configuredPool,
          tickLower: tickRange.minTick,
          tickUpper: tickRange.maxTick,
          amount0: amount0.toString(),
          useFullPrecision: true,
        });
      } else {
        // 提供两种代币
        position = Position.fromAmounts({
          pool: configuredPool,
          tickLower: tickRange.minTick,
          tickUpper: tickRange.maxTick,
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          useFullPrecision: true,
        });
      }
    
      // 创建交易，用于mint或者increase liquidity
      let transaction;
      const { hasPosition, positionId, tickLower, tickUpper } = await getV3Positions(userAddress, poolAddr, publicClient);
      

      if (hasPosition && positionId && tickRange.minTick === tickLower && tickRange.maxTick === tickUpper) {
        // 如果存在相同参数的持仓，使用 increase liquidity 而不是 mint
        toast({
          type: "info",
          message: "found existing position, increasing liquidity instead of creating a new position",
          isAutoClose: true
        });

        const addLiquidityOptions: AddLiquidityOptions = {
          deadline: Math.floor(Date.now() / 1000) + 60 * 20,
          slippageTolerance: new Percent(50, 10_000),
          tokenId: positionId,
        };


        const { calldata, value } = NonfungiblePositionManager.addCallParameters(
          position,
          addLiquidityOptions
        )


        transaction = {
          data: calldata as `0x${string}`,
          to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
          value: BigInt(value),
        }
        
      } else {
        const mintOptions: MintOptions = {
          recipient: userAddress,
          deadline: Math.floor(Date.now() / 1000) + 60 * 20,
          slippageTolerance: new Percent(100, 10_000),
        };

        // 获取调用参数
        const { calldata, value } = NonfungiblePositionManager.addCallParameters(
          position,
          mintOptions
        );
        
        transaction = {
          data: calldata as `0x${string}`,
          to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as `0x${string}`,
          value: BigInt(value),
        }
      }

      try {
        const mintTx = await sendTransaction(wagmiConfig, transaction);
        
        toast({
          type: "info",
          message: "add liquidity transaction submitted, waiting for confirmation...",
          isAutoClose: true
        });

        const mintReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: mintTx });
        
        if (mintReceipt.status === 'success') {
          toast({
            type: "success",
            message: "add liquidity success",
            isAutoClose: true
          });
        } else {
          toast({
            type: "error",
            message: "add liquidity failed",
            isAutoClose: true
          });
        }
      } catch (error: any) {
        console.error("add liquidity failed:", error);
        // 处理特定的错误类型
        if (error.message?.includes('STF')) {
          toast({
            type: "error",
            message: "slippage too large, please adjust the amount or wait for market stability",
            isAutoClose: true
          });
        } else {
          toast({
            type: "error",
            message: "add liquidity failed, please try again",
            isAutoClose: true
          });
        }
      }
    } catch (error) {
      console.error("add liquidity failed:", error);
      toast({
        type: "error",
        message: "add liquidity failed, please try again",
        isAutoClose: true
      });
    } finally {
      setLoading(false);
    }
  };

  return { addLiquidity, loading };
};