"use client"

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from 'react';
import TokenModal from './TokenModal';
import { formatTokenBalance } from '../utils/formatTokenBalance';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { ROUTER_ABI, ROUTER_CONTRACT_ADDRESS } from '../constant/ABI/HyperIndexRouter';
import { parseUnits } from 'viem';
import { WHSK } from '../constant/value';
import { useAccount } from 'wagmi';
import { erc20Abi } from 'viem';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTokenList, selectTokens } from '@/store/tokenListSlice';
import { AppDispatch } from '@/store';
import { ArrowsUpDownIcon, Cog6ToothIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ToastContext';
import { FACTORY_ABI, FACTORY_CONTRACT_ADDRESS } from '@/constant/ABI/HyperIndexFactory';
import { WETH_ABI } from '@/constant/ABI/weth';
import { PAIR_ABI } from "@/constant/ABI/HyperIndexPair";;
import { estimateAndCheckGas, formatNumberWithCommas } from '@/utils';
import { getTokens, Token } from '@/request/explore';

interface SwapContainerProps {
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

const DEFAULT_HSK_TOKEN: TokenData = {
  symbol: 'HSK',
  name: 'HyperSwap Token',
  address: '0x0000000000000000000000000000000000000000',
  icon_url: "/img/HSK-LOGO.png",
  decimals: '18'
};

const SwapContainer: React.FC<SwapContainerProps> = ({ token1 = 'HSK', token2 = 'Select token' }) => {
  const tokens = useSelector(selectTokens);
  const dispatch = useDispatch<AppDispatch>();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'token1' | 'token2'>('token1');
  const [token1Data, setToken1Data] = useState<TokenData | null>(null);
  const [token2Data, setToken2Data] = useState<TokenData | null>(null);
  const [token1Amount, setToken1Amount] = useState<string>('');
  const [token2Amount, setToken2Amount] = useState<string>('');
  const [priceImpact, setPriceImpact] = useState<string>('0');
  const [minimumReceived, setMinimumReceived] = useState<string>('0');
  const [, setLpFee] = useState<string>('0');
  const [slippage, setSlippage] = useState<string>('5.5');
  const [deadline, setDeadline] = useState<string>('30'); 
  const [error, setError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [txStatus, setTxStatus] = useState<'none' | 'pending' | 'success' | 'failed'>('none');
  const [currentTx, setCurrentTx] = useState<'none' | 'approve' | 'swap'>('none');
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const { toast } = useToast();

  const { address: userAddress } = useAccount();
  const { writeContract, data: hash, isPending: isWritePending, isSuccess: isWriteSuccess, isError: isWriteError, error: writeError } = useWriteContract();
  // 检查授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token1Data?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && token1Data ? [
      userAddress,                  // owner (用户地址)
      ROUTER_CONTRACT_ADDRESS       // spender (使用常量中定义的Router地址)
    ] : undefined,
    query: {
      enabled: !!(userAddress && token1Data && token1Data.symbol !== 'HSK'),
    },
  });
  const { isLoading: isWaitingTx, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}`,
  });
  // 添加一个辅助函数来获取用于查询的地址
  const getQueryAddress = (token: TokenData) => {
    return token.symbol === 'HSK' ? WHSK : token.address;
  };

  // 1. 修改 useReadContract hook 的调用，添加 enabled 条件的打印
  const { data: pairAddress } = useReadContract({
    address: FACTORY_CONTRACT_ADDRESS as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPair',
    args: token1Data && token2Data ? [
      getQueryAddress(token1Data),
      getQueryAddress(token2Data)
    ] : undefined,
    query: {
      enabled: !!(token1Data && token2Data),
    },
  });

  // 添加获取 token0 地址的调用
  const { data: token0Address } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: PAIR_ABI,
    functionName: 'token0',
    args: [],
    query: {
      enabled: !!pairAddress,
    },
  });

    
  // 在代币选择或金额变化时检查授权
  useEffect(() => {
    if (token1Data && token1Data.symbol !== 'HSK') {
      refetchAllowance();
    }
  }, [token1Data, token1Amount]);

  // 更新授权状态
  useEffect(() => {
    if (allowance && token1Amount && token1Data) {
      const amountBigInt = parseUnits(token1Amount, Number(token1Data.decimals || '18'));
      const isApprovedNow = allowance >= amountBigInt;
      setIsApproved(isApprovedNow);
    }
  }, [allowance, token1Amount, token1Data, userAddress]);


  // 修改 handleApprove 函数使用封装的 gas 检查
  const handleApprove = async () => {
    if (!token1Data || !token1Amount) return;
    
    try {
      setError(null);
      
      const amountToApprove = parseUnits(token1Amount, Number(token1Data.decimals || '18'));
      
      const params = {
        address: token1Data.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve' as const,
        args: [ROUTER_CONTRACT_ADDRESS as `0x${string}`, amountToApprove] as const,
      };

      // 使用封装的 gas 检查函数
      const canProceed = await estimateAndCheckGas(params);
      if (!canProceed) {
        toast({
          type: 'error',
          message: 'Insufficient gas, please deposit HSK first'
        });
        return;
      }
      
      writeContract(params);
      
      setCurrentTx('approve');
      setTxStatus('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setTxStatus('none');
      toast({
        type: 'error',
        message: 'Approval failed, please try again'
      });
    }
  };

  // 处理代币选择，特别处理 HSK/WHSK
  const handleTokenSelect = (tokenData: TokenData) => {
    if (modalType === 'token1') {
      // 如果选择的代币和 token2 相同，则交换位置
      if (token2Data && tokenData.address === token2Data.address) {
        setToken1Data(token2Data);
        setToken2Data(token1Data);
      } else {
        setToken1Data(tokenData);
      }
    } else {
      // 如果选择的代币和 token1 相同，则交换位置
      if (token1Data && tokenData.address === token1Data.address) {
        setToken2Data(token1Data);
        setToken1Data(token2Data);
      } else {
        setToken2Data(tokenData);
      }
    }
    
    // 清空输入金额和相关状态
    setToken1Amount('');
    setToken2Amount('');
    setMinimumReceived('0');
    setPriceImpact('0');
    setLpFee('0');
    setShowModal(false);
  };

  const formatBalance = (balance?: string, decimals?: string | null) => {
    if (!balance || !decimals) return '0';
    return formatTokenBalance(balance, decimals);
  };

  // 输入金额变化处理
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setToken1Amount(value);
      
      // 检查是否是 HSK 和 WHSK 的交易对
      const isHskWhskPair = token1Data && token2Data && (
        (token1Data.symbol === 'HSK' && token2Data.symbol === 'WHSK') ||
        (token2Data.symbol === 'HSK' && token1Data.symbol === 'WHSK')
      );

      if (isHskWhskPair) {
        // HSK 和 WHSK 的 1:1 交易，直接设置相同的金额
        setToken2Amount(value);
        setMinimumReceived(value);
        setPriceImpact('0');
        setLpFee('0');
      } else if (value === '') {
        // 如果输入为空，清空所有相关状态
        setToken2Amount('');
        setMinimumReceived('0');
        setPriceImpact('0');
        setLpFee('0');
      } 
    }
  };

  // 错误处理
  useEffect(() => {
    if (error) {
      setToken2Amount('0');
      setMinimumReceived('0');
      setPriceImpact('0');
      setLpFee('0');
    }
  }, [error, token1Data, token2Data, token1Amount]);

  // 在 SwapContainer 组件内添加 getReserves 的调用
  const { data: reserves } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: PAIR_ABI,
    functionName: 'getReserves',
    args: [],
    query: {
      enabled: !!pairAddress,
    },
  });

  // 在 SwapContainer 组件内添加价格状态
  const [token1Price, setToken1Price] = useState<string>('0');
  const [token2Price, setToken2Price] = useState<string>('0');
  const [tokenPrice, setTokenPrice] = useState<Token[]>([]);
  // 获取代币价格数据
  const fetchTokenPrices = async () => {
    try {
      const data = await getTokens();
      
      setTokenPrice(data);
    } catch (error) {
      console.error('Error fetching token prices:', error);
    }
  };

  useEffect(() => {
    fetchTokenPrices();
  }, []);


  // 修改价格计算相关的 useEffect
  useEffect(() => {
    if (token1Data && token2Data) {
      // 检查是否是 HSK 和 WHSK 的交易对 1:1 兑换
      const isHskWhskPair = (
        (token1Data.symbol === 'HSK' && token2Data.symbol === 'WHSK') ||
        (token2Data.symbol === 'HSK' && token1Data.symbol === 'WHSK')
      );

      if (isHskWhskPair) {
        setToken2Amount(token1Amount);
        setMinimumReceived(token1Amount);
        setPriceImpact('0');
        setLpFee('0');
      
        return;
      }
      if (reserves && token1Amount && pairAddress && token0Address) {
        try {
          const [reserve0, reserve1] = reserves as [bigint, bigint];
          
          // 根据实际的 token0 地址确定储备金顺序
          const token0 = getQueryAddress(token1Data);
        
          const [tokenInReserve, tokenOutReserve] = 
            token0 === token0Address ? [reserve0, reserve1] : [reserve1, reserve0];

          // 计算输出金额
          const amountIn = parseUnits(token1Amount, Number(token1Data.decimals || '18'));
          const amountInWithFee = amountIn * BigInt(997);
          const numerator = amountInWithFee * tokenOutReserve;
          const denominator = (tokenInReserve * BigInt(1000)) + amountInWithFee;
          const amountOut = numerator / denominator;

          // 设置输出金额
          const formattedOutput = formatTokenBalance(amountOut.toString(), token2Data.decimals || '18');
          setToken2Amount(formattedOutput);

          // 计算最小接收数量 (根据滑点设置)
          const slippageBps = Math.floor((100 - Number(slippage)) * 10); // 将百分比转换为基点
          const minReceived = (amountOut * BigInt(slippageBps)) / BigInt(1000);
          setMinimumReceived(formatTokenBalance(minReceived.toString(), token2Data.decimals || '18'));

          // 计算 LP 费用 (0.3%)
          const lpFeeAmount = (amountIn * BigInt(3)) / BigInt(1000);
          setLpFee(formatTokenBalance(lpFeeAmount.toString(), token1Data.decimals || '18'));

          // 修改价格影响计算
          // 只有当储备都不为零时才计算价格影响
          const tokenInDecimals = Number(token1Data.decimals || '18');
          const tokenOutDecimals = Number(token2Data.decimals || '18');

          // 将储备金额统一到18位精度
          const normalizedTokenInReserve = tokenInDecimals < 18 
            ? tokenInReserve * BigInt(10 ** (18 - tokenInDecimals))
            : tokenInReserve;

          const normalizedTokenOutReserve = tokenOutDecimals < 18
            ? tokenOutReserve * BigInt(10 ** (18 - tokenOutDecimals))
            : tokenOutReserve;

          // 同样将交易金额统一到18位精度
          const normalizedAmountIn = tokenInDecimals < 18
            ? amountIn * BigInt(10 ** (18 - tokenInDecimals))
            : amountIn;

          const normalizedAmountOut = tokenOutDecimals < 18
            ? amountOut * BigInt(10 ** (18 - tokenOutDecimals))
            : amountOut;

          if (normalizedTokenInReserve > BigInt(0) && normalizedTokenOutReserve > BigInt(0)) {
            // 使用统一精度后的数值计算价格
            const spotPrice = (normalizedTokenInReserve * BigInt(1e18)) / normalizedTokenOutReserve;
            const executionPrice = (normalizedAmountIn * BigInt(1e18)) / normalizedAmountOut;

            if (spotPrice > BigInt(0)) {
              const priceImpactBps = ((executionPrice - spotPrice) * BigInt(10000)) / spotPrice;
              setPriceImpact((Number(priceImpactBps) / 100).toFixed(2));
            } else {
              setPriceImpact('0');
            }
          } else {
            setPriceImpact('0');
          }

        } catch (error) {
          console.error('Error calculating swap:', error);
          setToken2Amount('0');
          setMinimumReceived('0');
          setPriceImpact('0');
          setLpFee('0');
          setToken1Price('0');
          setToken2Price('0');
        }
      }
    }

    
  }, [reserves, token1Amount, token1Data, token2Data, pairAddress, token0Address]);


  useEffect(() => {
    if (tokenPrice.length > 0) {
      // 修改查找逻辑，特殊处理 HSK 和 WHSK
      let token1PriceData;
      let token2PriceData;
      
      if (token1Data?.symbol === 'HSK' || token1Data?.symbol === 'WHSK') {
        // HSK 和 WHSK 共享相同的价格
        token1PriceData = tokenPrice.find(t => t.symbol === 'WHSK' || t.symbol === 'HSK');
      } else {
        token1PriceData = tokenPrice.find(t => t.address === token1Data?.address);
      }
      
      if (token2Data?.symbol === 'HSK' || token2Data?.symbol === 'WHSK') {
        // HSK 和 WHSK 共享相同的价格
        token2PriceData = tokenPrice.find(t => t.symbol === 'WHSK' || t.symbol === 'HSK');
      } else {
        token2PriceData = tokenPrice.find(t => t.address === token2Data?.address);
      }
      
      
      if (token1PriceData) {
        // 先去掉价格中的 $ 符号，然后格式化
        const priceString = token1PriceData.price.replace('$', '');
        const formattedPrice = parseFloat(priceString);
        setToken1Price((formattedPrice * parseFloat(token1Amount) || 0).toFixed(2));
      } else {
        setToken1Price('-');
      }
      
      if (token2PriceData) {
        // 先去掉价格中的 $ 符号，然后格式化
        const priceString = token2PriceData.price.replace('$', '');
        const formattedPrice = parseFloat(priceString);
        setToken2Price((formattedPrice * parseFloat(token2Amount) || 0).toFixed(2));
      } else {
        setToken2Price('-');
      }
    }
  }, [token1Amount, token2Amount, token1Data, token2Data]);
  // 根据url中的参数设置初始化的token
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

  // 需要拉取一下tokenList，才能获取到token1和token2的详细数据
  useEffect(() => {
    dispatch(fetchTokenList());
  }, [dispatch]);

  // 修改显示相关的函数
  const displaySymbol = (token: TokenData | null) => {
    if (!token) return '';
    return token.symbol; 
  };

  // 修改 LP Fee 显示
  // const displayLPFee = () => {
  //   if (!token1Data) return '0';
  //   return `${lpFee} ${displaySymbol(token1Data)}`;
  // };

  // 添加一个函数来检查是否是高滑点
  const isHighSlippage = (value: string) => Number(value) > 5.5;

  // 添加一个函数来处理价格影响的颜色
  const getPriceImpactColor = (impact: number) => {
    if (impact >= 5) {
      return 'text-error';
    }
    if (impact >= 3) {
      return 'text-warning';
    }
    return 'text-success';
  };

  // 修改 handleSwap 函数使用封装的 gas 检查
  const handleSwap = async () => {
    try {
      if (!token1Data || !token2Data || !userAddress) return;

      // 专门检查是否是 HSK -> WHSK 的情况
      if (token1Data.symbol === 'HSK' && token2Data.symbol === 'WHSK') {
        const params = {
          address: WHSK as `0x${string}`,
          abi: WETH_ABI,
          functionName: 'deposit',
          value: parseUnits(token1Amount, 18),
        };

        // 使用封装的 gas 检查函数
        const canProceed = await estimateAndCheckGas(params);
        if (!canProceed) {
          toast({
            type: 'error',
            message: 'Insufficient gas, please deposit HSK first'
          });
          return;
        }

        setCurrentTx('swap');
        setTxStatus('pending');
        
        await writeContract(params);
        return;
      }

      // 专门检查是否是 WHSK -> HSK 的情况
      if (token1Data.symbol === 'WHSK' && token2Data.symbol === 'HSK') {
        const params = {
          address: WHSK as `0x${string}`,
          abi: WETH_ABI,
          functionName: 'withdraw',
          args: [parseUnits(token1Amount, 18)],
        };

        // 使用封装的 gas 检查函数
        const canProceed = await estimateAndCheckGas(params);
        if (!canProceed) {
          toast({
            type: 'error',
            message: 'Insufficient gas, please deposit HSK first'
          });
          return;
        }

        setCurrentTx('swap');
        setTxStatus('pending');
        
        await writeContract(params);
        return;
      }

      // 其他代币对的常规 swap 逻辑
      const expectedAmount = parseUnits(token2Amount, Number(token2Data.decimals || '18'));
      const slippagePercent = Number(slippage);
      const amountOutMin = expectedAmount * BigInt(Math.floor((100 - slippagePercent) * 1000)) / BigInt(100000);
      const deadlineTime = Math.floor(Date.now() / 1000 + Number(deadline) * 60);

      let path: string[];
      if (token1Data.symbol === 'HSK') {
        path = [WHSK, token2Data.address];
      } else if (token2Data.symbol === 'HSK') {
        path = [token1Data.address, WHSK];
      } else {
        path = [token1Data.address, token2Data.address];
      }

      const params = {
        address: ROUTER_CONTRACT_ADDRESS as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: token1Data.symbol === 'HSK' ? 'swapExactETHForTokens' : token2Data.symbol === 'HSK' ? 'swapExactTokensForETH' : 'swapExactTokensForTokens',
        args: token1Data.symbol === 'HSK' ? [
          amountOutMin,              // amountOutMin
          path,                      // path
          userAddress,               // to
          deadlineTime,              // deadline
        ] : [
          parseUnits(token1Amount, Number(token1Data.decimals || '18')),  // amountIn
          amountOutMin,              // amountOutMin
          path,                      // path
          userAddress,               // to
          deadlineTime,              // deadline
        ],
        value: token1Data.symbol === 'HSK' ? parseUnits(token1Amount, 18) : undefined,
      };

      // 使用封装的 gas 检查函数
      const canProceed = await estimateAndCheckGas(params);
      if (!canProceed) {
        toast({
          type: 'error',
          message: 'Insufficient gas, please deposit HSK first'
        });
        return;
      }

      setCurrentTx('swap');
      setTxStatus('pending');
      
      await writeContract(params);
    } catch (error) {
      console.error('Swap failed:', error);
      // 显示更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      
      toast({
        type: 'error',
        message: `Swap failed: ${errorMessage}`
      });

      setTxStatus('failed');
    }
  };

  // 修改 useBalance hook 的调用,解构出 refetch 函数
  const { 
    data: hskBalance, 
    refetch: refetchHskBalance 
  } = useBalance({
    address: userAddress,
    query: {
      enabled: !!userAddress,
    },
  });



  // 同样为 token1Balance 添加 refetch
  const { 
    data: token1Balance, 
    refetch: refetchToken1Balance 
  } = useBalance({
    address: userAddress,
    token: token1Data?.symbol !== 'HSK' ? token1Data?.address as `0x${string}` : undefined,
    query: {
      enabled: !!userAddress && !!token1Data && token1Data.symbol !== 'HSK',
    },
  });


  const { data: token2Balance, refetch: refetchToken2Balance } = useBalance({
    address: userAddress,
    token: token2Data?.symbol !== 'HSK' ? token2Data?.address as `0x${string}` : undefined,
    query: {
      enabled: !!userAddress && !!token2Data && token2Data.symbol !== 'HSK',
    },
  });

  // 1. 修复 token 余额更新导致的循环
  useEffect(() => {
    if (token1Data && token1Data.symbol !== 'HSK' && token1Balance?.value) {
      // 避免直接修改 token1Data，而是使用函数式更新，并且只在值真正变化时才更新
      setToken1Data(prev => {
        if (prev?.balance === token1Balance.value.toString()) return prev;
        return {
          ...prev!,
          balance: token1Balance.value.toString()
        };
      });
    }
  }, [token1Balance?.value]);

  // 2. 修复 token2 余额更新导致的循环
  useEffect(() => {
    if (token2Data && token2Data.symbol !== 'HSK' && token2Balance?.value) {
      // 同样使用函数式更新，并且只在值真正变化时才更新
      setToken2Data(prev => {
        if (prev?.balance === token2Balance.value.toString()) return prev;
        return {
          ...prev!,
          balance: token2Balance.value.toString()
        };
      });
    }
  }, [token2Balance?.value]);

  // 修改原有的交易确认后的 useEffect
  useEffect(() => {
    if (isWritePending) {
        setTxStatus('pending');
        return;
    }

    if (isWriteSuccess && currentTx === 'swap' && hash) {
        toast({
          type: 'info',
          message: 'Transaction submitted!',
          isAutoClose: true
        });
    }

    if (isTxConfirmed && currentTx === 'swap') {
        toast({
          type: 'success',
          message: 'Swap completed successfully!',
          isAutoClose: true
        });
        
        // 重置状态
        setToken1Amount('');
        setToken2Amount('');
        setMinimumReceived('0');
        setPriceImpact('0');
        setLpFee('0');
        setTxStatus('success');
        setCurrentTx('none');

        // 重新获取余额
        setTimeout(() => {
          refetchHskBalance();
          refetchToken1Balance();
          refetchToken2Balance();
        }, 1000);
    }

    if (isTxConfirmed && currentTx === 'approve') {
      toast({
        type: 'success',
        message: 'Approve completed successfully!',
        isAutoClose: true
      });
      setCurrentTx('none');
      setTxStatus('success');
      refetchAllowance();
    }

    if (isWriteError) {
      // 显示更详细的错误信息
      let errorMessage = 'unknown error';
      
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
          }
        }
      }

      toast({
        type: 'error',
        message: `Swap failed: ${errorMessage}`,
        isAutoClose: false
      });

      setTxStatus('failed');
    }
  }, [isWriteSuccess, isWritePending, isTxConfirmed, currentTx, hash, isWriteError, writeError, refetchHskBalance, refetchToken1Balance, refetchAllowance]);


  // 2. 检查余额是否足够
  const hasInsufficientBalance = () => {
    if (!token1Data || !token1Amount) return false;
    
    const balance = token1Data.symbol === 'HSK' 
      ? hskBalance?.value?.toString() || '0'
      : token1Balance?.value?.toString() || '0';
      
    try {
      const amountBigInt = parseUnits(token1Amount, Number(token1Data.decimals || '18'));
      const balanceBigInt = BigInt(balance);
      return amountBigInt > balanceBigInt;
    } catch {
      return false;
    }
  };

  // 3. 修改 getButtonState 函数
  const getButtonState = () => {
    if (!token1Data || !token2Data) {
      return {
        text: 'Select tokens',
        disabled: true
      };
    }

    // 检查池子是否存在
    if (!pairAddress) {
      return {
        text: 'Add liquidity',
        disabled: false,
        onClick: () => {
          // 跳转到添加流动性页面
          window.location.href = `/liquidity?inputCurrency=${getQueryAddress(token1Data)}&outputCurrency=${getQueryAddress(token2Data)}`;
        }
      };
    }

    if (hasInsufficientBalance()) {
      return {
        text: 'Insufficient balance',
        disabled: true
      };
    }

    if (!token1Amount || Number(token1Amount) === 0) {
      return {
        text: 'Enter an amount',
        disabled: true
      };
    }

    if (error) {
      return {
        text: 'Insufficient liquidity',
        disabled: true
      };
    }

    if (txStatus === 'pending') {
      if (isWritePending) {
        return {
          text: 'Confirm in wallet...',
          disabled: true
        };
      }
      if (isWaitingTx) {
        return {
          text: 'Waiting for confirmation...',
          disabled: true
        };
      }
      return {
        text: 'Swapping...',
        disabled: true
      };
    }

    if (token1Data.symbol !== 'HSK' && !isApproved) {
      return {
        text: 'Approve',
        disabled: false,
        onClick: handleApprove
      };
    }

    const priceImpactNum = Number(priceImpact);
    if (priceImpactNum >= 5) {
      return {
        text: 'Swap anyway',
        disabled: false,
        onClick: handleSwap
      };
    }

    return {
      text: 'Swap',
      disabled: false,
      onClick: handleSwap
    };
  };

  const handleSwapTokens = () => {
    if (!token2Data) return;  // 只检查 token2Data
    
    if (token1Data) {
      // 正常的两个代币交换
      const tempToken = token1Data;
      setToken1Data(token2Data);
      setToken2Data(tempToken);
    } else {
      // token1 是默认的 HSK
      setToken1Data(token2Data);
      setToken2Data({
        ...DEFAULT_HSK_TOKEN,
        balance: hskBalance?.value?.toString(),
      });
    }
    
    // 清空输入金额
    setToken1Amount('');
    setToken2Amount('');
    setMinimumReceived('0');
    setPriceImpact('0');
    setLpFee('0');
  };

  useEffect(() => {
    if (token1 === 'HSK') {
      setToken1Data({
        ...DEFAULT_HSK_TOKEN,
        balance: hskBalance?.value?.toString(),
      });
    }
  }, [hskBalance, token1]);

  // 添加 ref
  const settingsRef = useRef<HTMLDivElement>(null);

  // 添加点击外部关闭弹窗的效果，并在关闭时验证slippage
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsPopup(false);
        
        // 验证slippage值，如果不合法或为空，设置为5.5
        const numValue = parseFloat(slippage);
        if (slippage === '' || isNaN(numValue) || numValue <= 0 || numValue > 50) {
          setSlippage('5.5');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [slippage]);

  // 监听弹窗状态变化，当关闭时验证slippage
  useEffect(() => {
    if (!showSettingsPopup) {
      // 当弹窗关闭时验证slippage值
      const numValue = parseFloat(slippage);
      if (slippage === '' || isNaN(numValue) || numValue <= 0 || numValue > 50) {
        setSlippage('5.5');
      }
    }
  }, [showSettingsPopup, slippage]);

  // 添加处理百分比点击的函数
  const handlePercentageClick = (percentage: number) => {
    if (!token1Data) return;
    
    const balance = token1Data.symbol === 'HSK' 
      ? hskBalance?.value?.toString() || '0'
      : token1Balance?.value?.toString() || '0';
      
    try {
      const balanceBigInt = BigInt(balance);
      const amount = (balanceBigInt * BigInt(percentage)) / BigInt(100);
      const decimals = Number(token1Data.decimals || '18');
      const formattedAmount = formatTokenBalance(amount.toString(), decimals.toString());
      setToken1Amount(formattedAmount);
    } catch (error) {
      console.error('Error calculating percentage:', error);
    }
  };

  return (
    <>
      {showModal && (
        <TokenModal 
          address={userAddress || ''}
          onClose={() => setShowModal(false)}
          onSelectToken={handleTokenSelect}
          type={modalType}
          selectedToken={modalType === 'token2' ? token1Data : token2Data}
        />
      )}
      <div className="w-[460px] mx-auto rounded-2xl bg-[#1c1d22]/30 bg-opacity-20 p-4 shadow-xl border border-white/5">
        {/* 头部操作栏 */}
        <div className="flex justify-end items-center mb-6">
          <div className="relative">
            <button 
              className="btn btn-sm btn-ghost btn-circle"
              onClick={() => setShowSettingsPopup(!showSettingsPopup)}
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>

            {/* Settings Popup */}
            {showSettingsPopup && (
              <div 
                ref={settingsRef}
                className="absolute right-0 top-10 w-[320px] bg-[#1c1d22] rounded-2xl p-4 shadow-2xl z-50 border border-gray-800/20"
              >
                {/* Slippage Settings */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-300 font-medium">Max slippage</span>
                    <div className="tooltip" data-tip="Your transaction will revert if the price changes unfavorably by more than this percentage.">
                      <InformationCircleIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  {isHighSlippage(slippage) && (
                    <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                      </svg>
                      <span>High slippage increases risk of price impact</span>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full py-2 px-3 rounded-xl bg-[#242631] text-sm text-white focus:outline-none focus:ring-1 ${
                        isHighSlippage(slippage) ? 'focus:ring-amber-400' : 'focus:ring-blue-500'
                      }`}
                      value={slippage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d.]/g, '');
                        const parts = value.split('.');
                        const sanitizedValue = parts.length > 2 ? `${parts[0]}.${parts[1]}` : value;
                        const numValue = parseFloat(sanitizedValue);
                        if (sanitizedValue === '' || (!isNaN(numValue) && numValue >= 0)) {
                          // 如果值不合法或超出范围，设置为默认值 5.5
                          if (numValue > 50 || numValue <= 0) {
                            setSlippage('5.5');
                          } else {
                            setSlippage(sanitizedValue);
                          }
                        }
                      }}
                      placeholder="Custom slippage"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        Number(slippage) === 5.5 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : isHighSlippage(slippage)
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-gray-700 text-gray-300'
                      }`}>
                        {Number(slippage) === 5.5 ? 'Auto' : 'Custom'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Deadline */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-300 font-medium">Tx. deadline</span>
                    <div className="tooltip" data-tip="Your transaction will revert if it is pending for more than this period of time.">
                      <InformationCircleIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full py-2 px-3 rounded-xl bg-[#242631] text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={deadline}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d.]/g, '');
                        const numValue = parseInt(value);
                        // 如果值不合法或超出范围，设置为默认值 30
                        if (value === '' || isNaN(numValue) || numValue <= 0 || numValue > 4320) {
                          setDeadline('30');
                        } else {
                          setDeadline(value);
                        }
                      }}
                      placeholder="Enter deadline"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">minutes</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sell 输入框 */}
        <div className="bg-[#2c2d33]/50 rounded-xl p-4 mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-base text-base-content/60">Sell</span>
            <div className="flex gap-2">
              <button 
                className="btn btn-xs btn-ghost hover:bg-base-200"
                onClick={() => handlePercentageClick(25)}
              >
                25%
              </button>
              <button 
                className="btn btn-xs btn-ghost hover:bg-base-200"
                onClick={() => handlePercentageClick(50)}
              >
                50%
              </button>
              <button 
                className="btn btn-xs btn-ghost hover:bg-base-200"
                onClick={() => handlePercentageClick(75)}
              >
                75%
              </button>
              {token1Data?.symbol === 'HSK' ? (
                <div className="tooltip" data-tip="Keep some network token balance to pay for transaction fees">
                  <button 
                    className="btn btn-xs btn-ghost hover:bg-base-200"
                    onClick={() => handlePercentageClick(100)}
                  >
                    100%
                  </button>
                </div>
              ) : (
                <button 
                  className="btn btn-xs btn-ghost hover:bg-base-200"
                  onClick={() => handlePercentageClick(100)}
                >
                  100%
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <input 
              className="bg-transparent text-4xl w-[60%] focus:outline-none"
              placeholder="0"
              value={token1Amount}
              onChange={handleAmountChange}
            />
            <button 
              className="btn btn-ghost rounded-full h-10 px-3 hover:bg-base-200"
              onClick={() => {
                setModalType('token1');
                setShowModal(true);
              }}
            >
              {token1Data ? (
                <>
                  <img src={token1Data.icon_url || "/img/HSK-LOGO.png"} alt={token1Data.name} className="w-6 h-6 rounded-full" />
                  <span className="mx-2">{displaySymbol(token1Data)}</span>
                </>
              ) : (
                <>
                  {token1 === 'HSK' ? (
                    <>
                      <img src="/img/HSK-LOGO.png" alt="HSK" className="w-6 h-6 rounded-full" />
                      <span className="mx-2">HSK</span>
                    </>
                  ) : (
                    <span>{token1}</span>
                  )}
                </>
              )}
              <ChevronDownIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className='text-base-content/60'>{token1Price !== '-' ? `$${formatNumberWithCommas(token1Price)}` : '-'}</span>
            <span className="text-sm text-base-content/60">
              Balance: {
                token1Data?.symbol === 'HSK' 
                  ? formatTokenBalance(hskBalance?.value?.toString() || '0', '18')
                  : formatTokenBalance(token1Balance?.value?.toString() || '0', token1Data?.decimals || '18')
              } {token1Data ? token1Data.symbol : token1}
            </span>
          </div>
        </div>

        {/* 交换按钮 */}
        <div className="relative h-0 flex justify-center">
          <button 
            onClick={handleSwapTokens}
            className="absolute -top-[20px] -bottom-[20px] btn btn-circle btn-sm btn-primary shadow-lg z-10"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Buy 输入框 */}
        <div className="bg-base-300 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/[0.02]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-base text-base-content/60">Buy</span>
          </div>
          <div className="flex justify-between items-center">
            <input 
              className="bg-transparent text-4xl w-[60%] focus:outline-none"
              placeholder="0"
              value={token2Amount}
              readOnly
            />
            <button 
              className="btn btn-ghost rounded-full h-10 px-3 hover:bg-base-200"
              onClick={() => {
                setModalType('token2');
                setShowModal(true);
              }}
            >
              {token2Data ? (
                <>
                  <img src={token2Data.icon_url || "/img/HSK-LOGO.png"} alt={token2Data.name} className="w-6 h-6 rounded-full" />
                  <span className="mx-2">{token2Data.symbol}</span>
                </>
              ) : (
                <span>{token2}</span>
              )}
              <ChevronDownIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className='text-base-content/60'>{token2Price !== '-' ? `$${formatNumberWithCommas(token2Price)}` : '-'}</span>
            <span className="text-sm text-base-content/60">
              Balance: {formatBalance(token2Data?.balance, token2Data?.decimals)} {displaySymbol(token2Data)}
            </span>
          </div>
        </div>

        {/* 交易详情 */}
        {token1Data && token2Data && token1Amount && (
          <>
            {!pairAddress ? (
              <div className="bg-[#2c2d33]/20 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/[0.02]">
                <div className="text-center">
                  <p className="text-base-content/60 mb-2">No liquidity pool found</p>
                  <p className="text-sm text-base-content/40 mb-4">
                    Create a new liquidity pool for this token pair
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#2c2d33]/20 backdrop-blur-md rounded-xl p-4 space-y-3 text-sm mb-4 border border-white/[0.02]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-base-content/60">
                    <span>Minimum received</span>
                    <div className="tooltip" data-tip="Your transaction will revert if there is a large, unfavorable price movement before it is confirmed.">
                      <InformationCircleIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <span>{minimumReceived} {displaySymbol(token2Data)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-base-content/60">
                    <span>Price Impact</span>
                    <div className="tooltip" data-tip="The difference between the market price and estimated price due to trade size.">
                      <InformationCircleIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <span className={getPriceImpactColor(Number(priceImpact))}>{priceImpact}%</span>
                </div>
                {/* <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-base-content/60">
                    <span>LP Fee</span>
                    <div className="tooltip" data-tip="A portion of each trade (0.30%) goes to liquidity providers as a protocol incentive.">
                      <InformationCircleIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <span>{displayLPFee()}</span>
                </div> */}
              </div>
            )}
          </>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-center">
          {(() => {
            const buttonState = getButtonState();
            return (
              <button 
                className={`btn w-full h-12 rounded-xl font-medium ${
                  buttonState.disabled ? 'btn-disabled' : 'btn-primary'
                }`}
                disabled={buttonState.disabled}
                onClick={buttonState.onClick}
              >
                {buttonState.text}
              </button>
            );
          })()}
        </div>
      </div>
    </>
  );
};

export default SwapContainer; 

