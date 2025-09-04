"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import TokenModal from "./TokenModal";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import { useAccount, useBalance, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { WHSK } from "@/constant/value";
import {
  ROUTER_CONTRACT_ADDRESS,
  ROUTER_ABI,
} from "@/constant/ABI/HyperIndexRouter";
import { useLiquidityPool } from "@/hooks/useLiquidityPool";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { StepIndicator } from "./StepIndicator";

import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { fetchTokenList, selectTokens } from "@/store/tokenListSlice";
import { AppDispatch } from "@/store";
import { getPools, Pool } from "@/request/explore";
import { formatTokenBalance } from "@/utils/formatTokenBalance";
import { estimateAndCheckGas } from "@/utils";
import { useToast } from "@/components/ToastContext";
import { readContract, simulateContract } from "wagmi/actions";
import { wagmiConfig } from "./RainbowKitProvider";
import BigNumber from "bignumber.js";
import { PAIR_ABI } from "@/constant/ABI/HyperIndexPair";
import { erc20Abi } from "viem";

interface LiquidityContainerProps {
  token1?: string;
  token2?: string;
}

interface TokenData {
  symbol: string;
  name: string;
  address: string;
  icon_url: string | null;
  balance?: string;
  decimals?: string | null;
}

// 判断是否为原生 HSK 的函数 - 只有真正的原生 HSK 地址为 0x0000000000000000000000000000000000000000
const isNativeHSK = (token: TokenData | null): boolean => {
  return token?.symbol === "HSK" && token?.address === "0x0000000000000000000000000000000000000000";
};
// 用户选择hsk的时候，需要模拟成whsk使用
const DEFAULT_HSK_TOKEN: TokenData = {
  symbol: "HSK",
  name: "HyperSwap Token",
  address: '0x0000000000000000000000000000000000000000',
  icon_url: "/img/HSK-LOGO.png",
  decimals: "18",
};

const getDefaultTokenIcon = (tokenData: TokenData | null) => {
  if (!tokenData) return "/img/HSK-LOGO.png";
  
  // 如果是 HSK，使用 HSK 图标
  if (tokenData.symbol === "HSK") {
    return "/img/HSK-LOGO.png";
  }
  
  // 其他 ERC20 代币使用通用图标
      return "/img/index-coin.jpg";
};

const LiquidityContainer: React.FC<LiquidityContainerProps> = ({
  token1 = "HSK",
  token2 = "Select token",
}) => {
  const tokens = useSelector(selectTokens);
  const dispatch = useDispatch<AppDispatch>();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"token1" | "token2">("token1");
  const { address: userAddress } = useAccount();
  const [token1Data, setToken1Data] = useState<TokenData | null>(null);
  const [token2Data, setToken2Data] = useState<TokenData | null>(null);
  const [step, setStep] = useState(1);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSuccessHandled, setIsSuccessHandled] = useState(false);
  const {
    writeContract,
    isPending: isWritePending,
    isSuccess: isWriteSuccess,
    isError: isWriteError,
    error: writeError,
    data: transactionHash,
  } = useWriteContract();
  
  // 等待交易确认
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });
  
  const { toast } = useToast();
  
  const [poolShare, setPoolShare] = useState("0.00");
  const [calculationTimeout, setCalculationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const { 
    data: hskBalance,
  } = useBalance({
    address: userAddress,
    query: {
      enabled: !!userAddress,
    },
  });

  const { 
    data: token1Balance, 
  } = useBalance({
    address: userAddress,
    token: !isNativeHSK(token1Data) ? token1Data?.address as `0x${string}` : undefined,
    query: {
      enabled: !!userAddress && !!token1Data && !isNativeHSK(token1Data),
    },
  });


  const { data: token2Balance } = useBalance({
    address: userAddress,
    token: !isNativeHSK(token2Data) ? token2Data?.address as `0x${string}` : undefined,
    query: {
      enabled: !!userAddress && !!token2Data && !isNativeHSK(token2Data),
    },
  });

  const [poolData, setPoolData] = useState<Pool[]>([]);
  const { isFirstProvider, poolInfo, refreshPool, isLoading } =
    useLiquidityPool(token1Data, token2Data);

  const { needApprove, handleApprove, isApproving, isApproveSuccess } = useTokenApproval(
    token1Data,
    token2Data,
    amount1,
    amount2,
    userAddress
  );


  useEffect(() => {
    if (!token1Data && token1 === "HSK") {
      setToken1Data(DEFAULT_HSK_TOKEN);
    }
  }, [token1, token1Data]);

  // 必须要获取一下池子的详细数据，池子中token0，token1是什么。
  // 合约拿到的数据是[0,1]
  // 用户前端是可以切换token的，所以当token0，1的数据改变的时候。需要判断合约返回的数据哪一个是0，哪一个是1
  useEffect(() => {
    getPools().then(res => {
      setPoolData(res);
    });
  }, []);

  // 需要拉取一下tokenList，才能获取到token1和token2的详细数据
  useEffect(() => {
    dispatch(fetchTokenList());
  }, [dispatch]);

  useEffect(() => {
    if (tokens.length === 0) {
      return;
    }

    tokens.forEach(token => {
      if (token.address === token1) {
        const tokenData: TokenData = {
          symbol: token.symbol || '',
          name: token.name || '',
          address: token.address,
          icon_url: token.icon_url,
          decimals: token.decimals,
        };
        setToken1Data(tokenData);
      }
      if (token.address === token2) {
        const tokenData: TokenData = {
          symbol: token.symbol || '',
          name: token.name || '',
          address: token.address,
          icon_url: token.icon_url,
          decimals: token.decimals,
        };
        setToken2Data(tokenData);
      }
    });
  }, [tokens, token1, token2]);

  const canContinue = token1Data && token2Data;

  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAmountChange = async (value: string, isToken1: boolean) => {
    // 立即更新输入值，不被计算状态阻塞
    if (isToken1) {
      setAmount1(value);
    } else {
      setAmount2(value);
    }

    // 如果是首次提供流动性，不需要计算比例
    if (isFirstProvider) {
      return;
    }

    // 如果没有池子信息，直接返回
    if (!poolInfo) {
      return;
    }

    // 清除之前的计算定时器
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }

    // 防抖延迟计算
    calculationTimeoutRef.current = setTimeout(async () => {
      const amount = parseFloat(value);
      if (!amount || amount <= 0) {
        // 如果输入为空或0，清空另一个输入框
        if (isToken1) {
          setAmount2("");
        } else {
          setAmount1("");
        }
        return;
      }

      setIsCalculating(true);

      try {
        const token0Address = await readContract(wagmiConfig, {
          address: poolInfo.pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "token0"
        });
        
        const isOrderMatched = token1Data?.symbol === "HSK" ? true : token1Data?.address === token0Address;
        const token1Decimals = Number(token1Data?.decimals || '18');
        const token2Decimals = Number(token2Data?.decimals || '18');
        
        const reserve0 = Number(poolInfo.reserve0) / Math.pow(10, isOrderMatched ? token1Decimals : token2Decimals);
        const reserve1 = Number(poolInfo.reserve1) / Math.pow(10, isOrderMatched ? token2Decimals : token1Decimals);

        if (isToken1) {
          const ratio = isOrderMatched ? reserve1 / reserve0 : reserve0 / reserve1;
          const adjustedAmount = amount * ratio;
          const formattedAmount = adjustedAmount.toFixed(Number(token2Data?.decimals || 18));
          setAmount2(formattedAmount);
        } else {
          const ratio = isOrderMatched ? reserve0 / reserve1 : reserve1 / reserve0;
          const adjustedAmount = amount * ratio;
          const formattedAmount = adjustedAmount.toFixed(Number(token1Data?.decimals || 18));
          setAmount1(formattedAmount);
        }
      } catch (error) {
        console.error("Error calculating amount:", error);
      } finally {
        setIsCalculating(false);
      }
    }, 300); // 300ms 防抖延迟
  };

  useEffect(() => {
    if (calculationTimeout) {
      clearTimeout(calculationTimeout);
    }

    const timeoutId = setTimeout(() => {
      calculatePoolShare();
    }, 800); // 增加防抖延迟，减少计算频率

    setCalculationTimeout(timeoutId);

    return () => {
      if (calculationTimeout) {
        clearTimeout(calculationTimeout);
      }
    };
  }, [amount1, amount2]);

  const calculatePoolShare = useCallback(async () => {
    let share = "0.00";
    let result: any = {};

    if (!amount1 || !amount2) {
      setPoolShare(share);
      return;
    }


    if (isFirstProvider) {
      share = "100.00";
    }
    
    if (poolInfo && poolInfo.totalSupply) {
      if (!token1Data || !token2Data) {
        setPoolShare(share);
        return;
      }

      const token1Decimals = Number(token1Data.decimals || '18');
      const token2Decimals = Number(token2Data.decimals || '18');
      
      const amount1Big = BigInt(Math.floor(parseFloat(amount1) * Math.pow(10, token1Decimals)));
      const amount2Big = BigInt(Math.floor(parseFloat(amount2) * Math.pow(10, token2Decimals)));
      // 计算最小接收数量
      const minAmount1 = (amount1Big * BigInt(99)) / BigInt(100);
      const minAmount2 = (amount2Big * BigInt(99)) / BigInt(100);
      // 判断是否包含 HSK
      const isToken1HSK = token1Data.symbol === "HSK";
      const isToken2HSK = token2Data.symbol === "HSK";

      if (isToken1HSK || isToken2HSK) {
        const tokenAddress = isToken1HSK
          ? token2Data.address
          : token1Data.address;
        const tokenAmount = isToken1HSK ? amount2Big : amount1Big;
        const ethAmount = isToken1HSK ? amount1Big : amount2Big;
        const minTokenAmount = isToken1HSK ? minAmount2 : minAmount1;
        const minEthAmount = isToken1HSK ? minAmount1 : minAmount2;
       
        try { 
           // 如果其中一个是 HSK，使用 addLiquidityETH
          result = await simulateContract(wagmiConfig, {
              address: ROUTER_CONTRACT_ADDRESS,
              abi: ROUTER_ABI,
              functionName: "addLiquidityETH",
              args: [
              tokenAddress,
              tokenAmount,
              minTokenAmount,
              minEthAmount,
              userAddress,
              BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
            ],
            value: ethAmount,
          });
        } catch (error) {
          console.error("addLiquidityETH failed:", error);
          setPoolShare('99.99');
          return;
        }
      } else {
        try {
           // 如果都不是 HSK，使用 addLiquidity
          result = await simulateContract(wagmiConfig, {
            address: ROUTER_CONTRACT_ADDRESS,
            abi: ROUTER_ABI,
            functionName: "addLiquidity",
            args: [
              token1Data.address,
              token2Data.address,
              amount1Big,
              amount2Big,
              minAmount1,
              minAmount2,
              userAddress,
              BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
            ],
          });
        } catch (error) {
          console.error("addLiquidity failed:", error);
          setPoolShare('99.99');
          return;
        }
      }

      const totalSupply: bigint = poolInfo.totalSupply;
      const tokenShareAmount: bigint = result.result[2];
      if (totalSupply === BigInt(0)) {
        share = "0.00"  ;
      } else {

        share = BigNumber(tokenShareAmount.toString())
          .div(BigNumber(totalSupply.toString()).plus(tokenShareAmount.toString()))
          .multipliedBy(100)
          .toFixed(2)
          .toString();
      }
     
    }
    setPoolShare(share);
  }, [amount1, amount2, token1Data, token2Data, poolInfo, isFirstProvider]);
  

  const handleSupply = async () => {
    if (!token1Data || !token2Data || !amount1 || !amount2 || !userAddress)
      return;

    try {
      setIsPending(true);
      setIsSuccessHandled(false);
       // 根据代币的小数位数计算金额
      const token1Decimals = Number(token1Data.decimals || '18');
      const token2Decimals = Number(token2Data.decimals || '18');
      
      const amount1Big = BigInt(Math.floor(parseFloat(amount1) * Math.pow(10, token1Decimals)));
      const amount2Big = BigInt(Math.floor(parseFloat(amount2) * Math.pow(10, token2Decimals)));
      // 计算最小接收数量
      const minAmount1 = (amount1Big * BigInt(85)) / BigInt(100);
      const minAmount2 = (amount2Big * BigInt(85)) / BigInt(100);
      // 判断是否包含 HSK
      const isToken1HSK = token1Data.symbol === "HSK";
      const isToken2HSK = token2Data.symbol === "HSK";

      if (isToken1HSK || isToken2HSK) {
        const tokenAddress = isToken1HSK
          ? token2Data.address
          : token1Data.address;
        const tokenAmount = isToken1HSK ? amount2Big : amount1Big;
        const ethAmount = isToken1HSK ? amount1Big : amount2Big;
        const minTokenAmount = isToken1HSK ? minAmount2 : minAmount1;
        const minEthAmount = isToken1HSK ? minAmount1 : minAmount2;

        await writeContract({
          address: ROUTER_CONTRACT_ADDRESS,
          abi: ROUTER_ABI,
          functionName: "addLiquidityETH",
          args: [
            tokenAddress,
            tokenAmount,
            minTokenAmount,
            minEthAmount,
            userAddress,
            BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
          ],
          value: ethAmount,
        });
      } else {
        await writeContract({
          address: ROUTER_CONTRACT_ADDRESS,
          abi: ROUTER_ABI,
          functionName: "addLiquidity",
          args: [
            token1Data.address,
            token2Data.address,
            amount1Big,
            amount2Big,
            minAmount1,
            minAmount2,
            userAddress,
            BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
          ],
        });
      }
    } catch (error) {
      console.error("Supply failed:", error);
      setIsPending(false);
      toast({
        type: 'error',
        message: 'Failed to add liquidity. Please try again.',
        isAutoClose: true
      });
    }
  };

  useEffect(() => {
    if (isConfirmed && !isSuccessHandled) {
      setIsSuccessHandled(true);
      refreshPool();
      setAmount1("");
      setAmount2("");
      setStep(1);
      setIsPending(false);
      toast({
        type: 'success',
        message: 'Liquidity added successfully!',
        isAutoClose: true
      });   
    }
  }, [isConfirmed, isSuccessHandled, refreshPool, toast]);

  useEffect(() => {
    if (isWriteError && writeError) {
      setIsPending(false);
      let errorMessage = "add liquidity failed, please try again.";
      
      if (typeof writeError === 'object' && writeError !== null) {
        if ('message' in writeError) {
          const message = (writeError as any).message?.toLowerCase();
          errorMessage = `error: ${message}`; 

          if (message.includes("insufficient funds")) {
            errorMessage = "insufficient funds, please ensure you have enough tokens and gas fees.";
          } else if (message.includes("user rejected")) {
            errorMessage = "user rejected the transaction.";
          } else if (message.includes("deadline")) {
            errorMessage = "transaction deadline, please try again.";
          } else if (message.includes("slippage")) {
            errorMessage = "slippage too high, please adjust the slippage tolerance or reduce the transaction amount.";
          } else if (message.includes("transfer_from_failed")) {
            errorMessage = "transfer failed. please check your token balance and allowance.";
          }
        }
      }
      
      toast({
        type: 'error',
        message: errorMessage,
        isAutoClose: false
      });
    }
  }, [isWriteError, writeError]);

  const clearStep2Data = () => {
    setAmount1("");
    setAmount2("");
    setIsPending(false);
  };

  useEffect(() => {
    if (isApproveSuccess) {
      toast({
        type: 'success',
        message: 'Token approved successfully!',
        isAutoClose: true
      });
    }
  }, [isApproveSuccess]);

  const renderStep2 = () => {
    let price1 = "0", price2 = "0";
    let token0Symbol = token1Data?.symbol || "";
    let token1Symbol = token2Data?.symbol || "";

    if (isFirstProvider) {
      if (amount1 && amount2 && new BigNumber(amount1).gt(0) && new BigNumber(amount2).gt(0)) {
        price1 = new BigNumber(amount2).div(amount1).toFixed(6);
        price2 = new BigNumber(amount1).div(amount2).toFixed(6);
      }
    } else if (poolInfo) {
      const pool = poolData.find(pool => pool.pairsAddress === poolInfo.pairAddress);
     
      if (pool) {
        if (token1Data?.address === pool.token0 || token1Data?.address === '0x0000000000000000000000000000000000000000') {
          token0Symbol = token1Data.symbol || "";
          token1Symbol = token2Data?.symbol || "";
          const token0Decimals = Number(token1Data?.decimals || '18');
          const token1Decimals = Number(token2Data?.decimals || '18');
          
          const reserve0 = new BigNumber(poolInfo.reserve0.toString()).div(new BigNumber(10).pow(token0Decimals));
          const reserve1 = new BigNumber(poolInfo.reserve1.toString()).div(new BigNumber(10).pow(token1Decimals));

          
          price1 = reserve1.div(reserve0).toFixed(6);
          price2 = reserve0.div(reserve1).toFixed(6);
        } else {
          token0Symbol = token2Data?.symbol || "";
          token1Symbol = token1Data?.symbol || "";
         
          const token0Decimals = Number(token2Data?.decimals || '18');
          const token1Decimals = Number(token1Data?.decimals || '18');
          
          const reserve0 = new BigNumber(poolInfo.reserve0.toString()).div(new BigNumber(10).pow(token0Decimals));
          const reserve1 = new BigNumber(poolInfo.reserve1.toString()).div(new BigNumber(10).pow(token1Decimals));
;
          
          price1 = reserve0.div(reserve1).toFixed(6);
          price2 = reserve1.div(reserve0).toFixed(6);
        }
      }
    }

    const formatPrice = (price: string) => {
      return parseFloat(price).toString();
    };

    const needsApproval = needApprove.token1 || needApprove.token2;
    const isButtonDisabled = !amount1 || !amount2 || isPending || isWritePending || isApproving || isConfirming;

    const getButtonText = () => {
      if (isConfirming) return "Confirming...";
      if (isPending || isWritePending) return "Processing...";
      if (isApproving) return "Approving...";
      if (needApprove.token1) return `Approve ${token1Data?.symbol}`;
      if (needApprove.token2) return `Approve ${token2Data?.symbol}`;
      return "Supply";
    };

    const handleButtonClick = async () => {
      const canProceed = await estimateAndCheckGas(hskBalance);
      if (!canProceed) {
        toast({
          type: 'error',
          message: 'Insufficient gas, please deposit HSK first',
          isAutoClose: true
        });
        return;
      }
      
      // 检查余额
      if (token1Data && token2Data && amount1 && amount2) {
        const token1Decimals = Number(token1Data.decimals || '18');
        const token2Decimals = Number(token2Data.decimals || '18');
        
        const amount1Required = BigInt(Math.floor(parseFloat(amount1) * Math.pow(10, token1Decimals)));
        const amount2Required = BigInt(Math.floor(parseFloat(amount2) * Math.pow(10, token2Decimals)));

        // 检查 token1 余额
        if (!isNativeHSK(token1Data)) {
          const token1Bal = token1Balance?.value || BigInt(0);
          if (token1Bal < amount1Required) {
            toast({
              type: 'error',
              message: `Insufficient ${token1Data.symbol} balance. Required: ${amount1}, Available: ${formatTokenBalance(token1Bal.toString(), token1Data.decimals || '18')}`,
              isAutoClose: true
            });
            return;
          }
        } else {
          // 原生 HSK 使用 hskBalance
          const hskBal = hskBalance?.value || BigInt(0);
          if (hskBal < amount1Required) {
            toast({
              type: 'error',
              message: `Insufficient HSK balance. Required: ${amount1}, Available: ${formatTokenBalance(hskBal.toString(), '18')}`,
              isAutoClose: true
            });
            return;
          }
        }

        // 检查 token2 余额
        if (!isNativeHSK(token2Data)) {
          const token2Bal = token2Balance?.value || BigInt(0);
          if (token2Bal < amount2Required) {
            toast({
              type: 'error',
              message: `Insufficient ${token2Data.symbol} balance. Required: ${amount2}, Available: ${formatTokenBalance(token2Bal.toString(), token2Data.decimals || '18')}`,
              isAutoClose: true
            });
            return;
          }
        } else {
          // 原生 HSK 使用 hskBalance
          const hskBal = hskBalance?.value || BigInt(0);
          if (hskBal < amount2Required) {
            toast({
              type: 'error',
              message: `Insufficient HSK balance. Required: ${amount2}, Available: ${formatTokenBalance(hskBal.toString(), '18')}`,
              isAutoClose: true
            });
            return;
          }
        }
      }
      
      if (needsApproval) {
        await handleApprove(needApprove.token1);
      } else {
        await handleSupply();
      }
    };

    return (
      <div className="bg-base-200/30 backdrop-blur-sm rounded-3xl p-6">
        <div className="flex items-center justify-between mb-8">
          <button
            className="p-2 hover:bg-base-300/50 rounded-full"
            onClick={() => {
              setStep(1);
              clearStep2Data();
            }}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <h2 className="text-md font-normal">Add Liquidity</h2>
          <div className="w-10 h-10 rounded-full bg-base-300/50"></div>
        </div>

        <div className="space-y-4">
          <div className="bg-base-200 rounded-3xl p-6">
            <div className="text-md mb-2">Input</div>
            <div className="flex justify-between items-center">
              <div className="flex items-center w-[60%]">
                <div className="relative w-[90%]">
                  <input
                    type="number"
                    min="0"
                    className="input input-ghost w-full text-2xl focus:outline-none px-4 
                      [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
                      [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100
                      [&::-webkit-inner-spin-button]:bg-base-300 [&::-webkit-outer-spin-button]:bg-base-300
                      [&::-webkit-inner-spin-button]:h-full [&::-webkit-outer-spin-button]:h-full
                      [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0
                      [&::-webkit-inner-spin-button]:rounded-r-lg [&::-webkit-outer-spin-button]:rounded-r-lg"
                    placeholder="0"
                    value={amount1}
                    onChange={(e) => handleAmountChange(e.target.value, true)}
                  />
                  {isCalculating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="loading loading-spinner loading-xs"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-300">
                <Image
                  src={token1Data?.icon_url || getDefaultTokenIcon(token1Data)}
                  alt={token1Data?.symbol || "Token"}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full"
                  unoptimized
                />
                <span className="text-md">{token1Data?.symbol}</span>
              </div>
            </div>
            <div className="flex justify-end items-center mt-2">
              <span className="text-sm text-base-content/60">
                Balance: {
                  isNativeHSK(token1Data) && hskBalance 
                    ? formatTokenBalance(hskBalance.value.toString(), '18')
                    : token1Balance 
                      ? formatTokenBalance(token1Balance.value.toString(), token1Data?.decimals || '18') 
                      : '0'
                } {token1Data ? token1Data.symbol : token1}
              </span>
            </div>
          </div>

          <div className="flex justify-center py-2">
            <PlusIcon className="w-5 h-5 text-base-content/60" />
          </div>

          <div className="bg-base-200 rounded-3xl p-6">
            <div className="text-md mb-2">Input</div>
            <div className="flex justify-between items-center">
              <div className="flex items-center w-[60%]">
                <div className="relative w-[90%]">
                  <input
                    type="number"
                    min="0"
                    className="input input-ghost w-full text-2xl focus:outline-none px-4 
                      [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
                      [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100
                      [&::-webkit-inner-spin-button]:bg-base-300 [&::-webkit-outer-spin-button]:bg-base-300
                      [&::-webkit-inner-spin-button]:h-full [&::-webkit-outer-spin-button]:h-full
                      [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0
                      [&::-webkit-inner-spin-button]:rounded-r-lg [&::-webkit-outer-spin-button]:rounded-r-lg"
                    placeholder="0"
                    value={amount2}
                    onChange={(e) => handleAmountChange(e.target.value, false)}
                  />
                  {isCalculating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="loading loading-spinner loading-xs"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-300">
                <Image
                  src={token2Data?.icon_url || getDefaultTokenIcon(token2Data)}
                  alt={token2Data?.symbol || "Token"}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full"
                  unoptimized
                />
                <span className="text-md">{token2Data?.symbol}</span>
              </div>
            </div>
            <div className="flex justify-end items-center mt-2">
            <span className="text-sm text-base-content/60">
              Balance: {
                isNativeHSK(token2Data) && hskBalance 
                  ? formatTokenBalance(hskBalance.value.toString(), '18')
                  : token2Balance 
                    ? formatTokenBalance(token2Balance.value.toString(), token2Data?.decimals || '18') 
                    : '0'
              } {token2Data ? token2Data.symbol : token2}
            </span>
          </div>
          </div>
        </div>

        <div className="mt-6 bg-base-200 rounded-3xl p-6">
          <h3 className="text-lg mb-4">Prices and pool share</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg mb-2">{formatPrice(price1)}</div>
              <div className="text-sm text-base-content/60">
                {token1Symbol} per {token0Symbol}
              </div>
            </div>
            <div>
              <div className="text-lg mb-2">{formatPrice(price2)}</div>
              <div className="text-sm text-base-content/60">
                {token0Symbol} per {token1Symbol}
              </div>
            </div>
            <div>
              <div className="text-lg mb-2">{isCalculating ? "Calculating..." : `${poolShare}%`}</div>
              <div className="text-sm text-base-content/60">Share of Pool</div>
            </div>
          </div>
        </div>

        <button
          className={`w-full rounded-lg py-4 text-xl mt-6 ${
            isButtonDisabled
              ? "bg-primary/50 cursor-not-allowed"
              : "bg-primary/90 hover:bg-primary"
          } text-primary-content`}
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
        >
          {getButtonText()}
        </button>
      </div>
    );
  };

  const renderTokenButton = (type: "token1" | "token2") => {
    const tokenData = type === "token1" ? token1Data : token2Data;
    const defaultText = type === "token1" ? token1 : token2;

    return (
      <button
        className="w-full bg-base-content/30 hover:bg-base-300/70 rounded-full py-4 px-6 
          flex justify-between items-center transition-all border border-transparent 
          hover:border-base-content/10"
        onClick={() => {
          setModalType(type);
          setShowModal(true);
        }}
      >
        {tokenData ? (
          <div className="flex items-center gap-3">
            <Image
              src={tokenData.icon_url || getDefaultTokenIcon(tokenData)}
              alt={tokenData.name}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full"
              unoptimized
            />
            <span className="text-lg font-normal">{tokenData.symbol}</span>
          </div>
        ) : (
          <span className="text-lg font-normal">{defaultText}</span>
        )}
        <ChevronDownIcon className="w-6 h-6 text-base-content/60" />
      </button>
    );
  };

  return (
    <div className="w-full max-w-[960px] px-4 sm:px-6 lg:px-0">
      <div className="flex w-full flex-col lg:flex-row gap-8">
        <div className="hidden lg:block w-[360px] flex-shrink-0">
          <StepIndicator currentStep={step} />
        </div>
        <div className="flex-1">
          {step === 1 ? (
            <div className="bg-base-200/30 backdrop-blur-sm rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold mb-3">Select Pair</h2>

                <div className="dropdown dropdown-end">
                  <div tabIndex={0} role="button" className="btn btn-sm rounded-xl bg-[#1c1d22] hover:bg-[#2c2d33] border border-white/5">
                    <span>V2 Position</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1" />
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-[#1c1d22] rounded-xl w-40 border border-white/5">
                    <li><a href={`/liquidity/v3?inputCurrency=${token1Data?.address}&outputCurrency=${token2Data?.address}`} className="text-base-content/60 hover:bg-[#2c2d33] rounded-lg">V3 Position</a></li>
                  </ul>
                </div>
              </div>
              <p className="text-md text-base-content/60 mb-8">
                Select a pair of tokens you want to provide liquidity for.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {renderTokenButton("token1")}
                {renderTokenButton("token2")}
              </div>

              <div>
                <h3 className="text-xl font-bold text-base-content/60 mb-3">
                  Fee Tier
                </h3>
                <p className="text-md mb-8">
                  The pool earns 0.3% of all trades proportional to their share
                  of the pool.
                </p>

                {canContinue && (isLoading || isFirstProvider) && (
                  <div className="mb-8 bg-base-100 px-4 py-2 rounded-lg">
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="loading loading-spinner loading-md"></div>
                        <span className="ml-2">Checking pool status...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[#98E5CE] text-lg font-normal mb-2">
                          You are the first liquidity provider.
                        </p>
                        <p className="text-[#E5E7EB] text-md font-normal mb-4">
                          The ratio of tokens you add will set the price of this
                          pool.Once you are happy with the rate click supply to
                          review.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <button
                  className={`w-full rounded-full py-4 text-lg font-normal transition-all
                    ${
                      canContinue && !isLoading
                        ? "bg-primary/90 hover:bg-primary text-primary-content"
                        : "bg-base-300/50 text-base-content/40 cursor-not-allowed"
                    }`}
                  disabled={!canContinue || isLoading}
                  onClick={() => canContinue && !isLoading && setStep(2)}
                >
                  {isLoading ? "Checking..." : "Continue"}
                </button>
              </div>
            </div>
          ) : (
            renderStep2()
          )}
        </div>
      </div>

      {showModal && (
        <TokenModal
          address={userAddress || ""}
          onClose={() => setShowModal(false)}
          onSelectToken={(token) => {
            if (modalType === "token1") {
              setToken1Data(token);
            } else {
              setToken2Data(token);
            }
            setShowModal(false);
          }}
          type={modalType}
          selectedToken={modalType === "token2" ? token1Data : token2Data}
        />
      )}
    </div>
  );
};

export default LiquidityContainer;