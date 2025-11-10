"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import TradeServiceABI from '@/constant/abi/TradeService.json';
import { erc20Abi } from 'viem';

interface Order {
  orderId: string;
  price: string;
  amount: string;
  total: string;
  progress: string;
}

interface MergedOrder {
  price: string;
  amount: string;
  total: string;
  orderCount: number;
}

interface StockOrderBookProps {
  selectedStock: string;
  currentPrice?: string;
  onOrderSelect?: (order: {price: string; amount: string; type: 'buy' | 'sell'}) => void;
}

const StockOrderBookComponent: React.FC<StockOrderBookProps> = ({ selectedStock, currentPrice = '0.10', onOrderSelect }) => {
  const { tradeServiceAddress, stockAddresses, usdtAddress } = useSelector((state: RootState) => state.orderBook);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [mergedBuyOrders, setMergedBuyOrders] = useState<MergedOrder[]>([]);
  const [mergedSellOrders, setMergedSellOrders] = useState<MergedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const sellOrdersRef = useRef<HTMLDivElement>(null);
  
  // 添加简单的缓存机制
  const cacheRef = useRef<{
    [key: string]: {
      buyOrders: Order[];
      sellOrders: Order[];
      mergedBuyOrders: MergedOrder[];
      mergedSellOrders: MergedOrder[];
      timestamp: number;
    }
  }>({});
  const CACHE_DURATION = 10000; // 10秒缓存

  // 合并相同价格的订单
  const mergeOrdersByPrice = useCallback((orders: Order[]): MergedOrder[] => {
    const priceMap = new Map<string, { amount: number; total: number; count: number }>();
    
    orders.forEach(order => {
      const price = order.price;
      const amount = parseFloat(order.amount);
      const total = parseFloat(order.total);
      
      if (priceMap.has(price)) {
        const existing = priceMap.get(price)!;
        existing.amount += amount;
        existing.total += total;
        existing.count += 1;
      } else {
        priceMap.set(price, { amount, total, count: 1 });
      }
    });
    
    return Array.from(priceMap.entries())
      .map(([price, data]) => ({
        price,
        amount: data.amount.toString(),
        total: data.total.toString(),
        orderCount: data.count
      }))
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); // 按价格降序排列
  }, []);

  // 获取买单数据
  const fetchBuyOrders = useCallback(async () => {
    if (!tradeServiceAddress || !selectedStock) {
      setBuyOrders([]);
      return;
    }
    
    try {
      const provider = new ethers.JsonRpcProvider('https://testnet.hsk.xyz');
      const contract = new ethers.Contract(tradeServiceAddress, TradeServiceABI.abi, provider);
      
      const stockAddress = stockAddresses[selectedStock];
      if (!stockAddress) {
        setBuyOrders([]);
        return;
      }
      
      const stockContract = new ethers.Contract(stockAddress, erc20Abi, provider);

      // 获取买单 (USDT -> Stock)
      const topOrderId = await contract.getPendingOrdersTopId(usdtAddress, stockAddress);
      const pendingOrders = await contract.getPendingOrders(usdtAddress, stockAddress, topOrderId, 10);
      const decimals = await stockContract.decimals();
      const formattedBuyOrders: Order[] = pendingOrders
        .filter((order: any) => order[0] !== BigInt(0))
        .map((order: any) => {
          const amountIn = ethers.formatUnits(order[1], 6); // USDT decimals
          const amountWant = ethers.formatUnits(order[2], decimals); // Stock decimals
          const progress = order[3];
          
          // 计算成交进度百分比
          const progressPercent = Number(progress) / 4294967295;
          
          // 计算剩余未成交的数量
          const remainingAmountWant = parseFloat(amountWant) * (1 - progressPercent);
          const remainingAmountIn = parseFloat(amountIn) * (1 - progressPercent);
          
          const price = (parseFloat(amountIn) / parseFloat(amountWant)).toFixed(6);
          
          return {
            orderId: order[0].toString(),
            price: price,
            amount: remainingAmountWant.toString(),
            total: remainingAmountIn.toString(),
            progress: progress.toString()
          };
        });

      setBuyOrders(formattedBuyOrders);
      setMergedBuyOrders(mergeOrdersByPrice(formattedBuyOrders));
    } catch (error) {
      console.error('Error fetching buy orders:', error);
      setBuyOrders([]);
      setMergedBuyOrders([]);
    }
  }, [tradeServiceAddress, selectedStock]);

  // 获取卖单数据
  const fetchSellOrders = useCallback(async () => {
    if (!tradeServiceAddress || !selectedStock) {
      setSellOrders([]);
      return;
    }
    
    try {
      const provider = new ethers.JsonRpcProvider('https://testnet.hsk.xyz');
      const contract = new ethers.Contract(tradeServiceAddress, TradeServiceABI.abi, provider);

      const stockAddress = stockAddresses[selectedStock];
      if (!stockAddress) {
        setSellOrders([]);
        return;
      }
      
      const stockContract = new ethers.Contract(stockAddress, erc20Abi, provider);

      // 获取卖单 (Stock -> USDT)
      const topOrderId = await contract.getPendingOrdersTopId(stockAddress, usdtAddress);
      const pendingOrders = await contract.getPendingOrders(stockAddress, usdtAddress, topOrderId, 10);
      const decimals = await stockContract.decimals();
      const formattedSellOrders: Order[] = pendingOrders
        .filter((order: any) => order[0] !== BigInt(0))
        .map((order: any) => {
          const amountIn = ethers.formatUnits(order[1], decimals); // Stock decimals
          const amountWant = ethers.formatUnits(order[2], 6); // USDT decimals
          const progress = order[3];
          
          // 计算成交进度百分比
          const progressPercent = Number(progress) / 4294967295;
          
          // 计算剩余未成交的数量
          const remainingAmountIn = parseFloat(amountIn) * (1 - progressPercent);
          const remainingAmountWant = parseFloat(amountWant) * (1 - progressPercent);
          
          const price = (parseFloat(amountWant) / parseFloat(amountIn)).toFixed(6);
          
          return {
            orderId: order[0].toString(),
            price: price,
            amount: remainingAmountIn.toString(),
            total: remainingAmountWant.toString(),
            progress: progress.toString()
          };
        });

      setSellOrders(formattedSellOrders);
      setMergedSellOrders(mergeOrdersByPrice(formattedSellOrders));
    } catch (error) {
      console.error('Error fetching sell orders:', error);
      setSellOrders([]);
      setMergedSellOrders([]);
    }
  }, [tradeServiceAddress, selectedStock]);

  // 统一获取所有订单数据 - 添加缓存机制
  const fetchAllOrders = async () => {
    if (!tradeServiceAddress || !selectedStock) {
      setBuyOrders([]);
      setSellOrders([]);
      setMergedBuyOrders([]);
      setMergedSellOrders([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${selectedStock}-${tradeServiceAddress}`;
    const cached = cacheRef.current[cacheKey];
    const now = Date.now();

    // 如果有有效缓存，直接使用缓存数据
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setBuyOrders(cached.buyOrders);
      setSellOrders(cached.sellOrders);
      setMergedBuyOrders(cached.mergedBuyOrders);
      setMergedSellOrders(cached.mergedSellOrders);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([fetchBuyOrders(), fetchSellOrders()]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // 当订单数据更新时，更新缓存
  useEffect(() => {
    if (selectedStock && tradeServiceAddress && (buyOrders.length > 0 || sellOrders.length > 0)) {
      const cacheKey = `${selectedStock}-${tradeServiceAddress}`;
      cacheRef.current[cacheKey] = {
        buyOrders,
        sellOrders,
        mergedBuyOrders,
        mergedSellOrders,
        timestamp: Date.now()
      };
    }
  }, [selectedStock, tradeServiceAddress, buyOrders, sellOrders, mergedBuyOrders, mergedSellOrders]);

  useEffect(() => {
    fetchAllOrders();
    
    // 减少刷新频率从5秒改为15秒，并添加页面可见性检测
    const interval = setInterval(() => {
      // 只有在页面可见时才更新订单簿
      if (!document.hidden) {
        fetchAllOrders();
      }
    }, 15000);

    // 页面从不可见变为可见时立即更新
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAllOrders();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedStock, tradeServiceAddress]);

  // 当卖单数据更新时，滚动到底部
  useEffect(() => {
    if (sellOrdersRef.current && mergedSellOrders.length > 0) {
      sellOrdersRef.current.scrollTop = sellOrdersRef.current.scrollHeight;
    }
  }, [mergedSellOrders]);

  // 计算挂单量占比
  const { maxSellAmount, maxBuyAmount } = useMemo(() => {
    const sellAmounts = mergedSellOrders.map(order => parseFloat(order.amount));
    const buyAmounts = mergedBuyOrders.map(order => parseFloat(order.amount));
    
    return {
      maxSellAmount: Math.max(...sellAmounts, 0),
      maxBuyAmount: Math.max(...buyAmounts, 0)
    };
  }, [mergedSellOrders, mergedBuyOrders]);

  // 格式化数字显示
  const formatNumber = (value: string, decimals: number = 6) => {
    return parseFloat(value).toFixed(decimals);
  };

  // 计算挂单量占比
  const getAmountRatio = (amount: string, maxAmount: number) => {
    if (maxAmount === 0) return 0;
    return (parseFloat(amount) / maxAmount) * 100;
  };

  return (
    <div className="bg-base-100/80 backdrop-blur border border-white/10 rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-base-content">
              Order Book - {selectedStock}
            </h2>
            {loading && (mergedBuyOrders.length > 0 || mergedSellOrders.length > 0) && (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-xs text-base-content/70">
              {loading ? 'Updating' : 'Live'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* 统一表头 */}
        <div className="px-2 md:px-4 py-2 bg-base-200/50 border-b border-white/10">
          <div className="grid grid-cols-3 gap-2 md:gap-4 text-xs text-base-content/70 font-medium">
            <div className="text-left">Price (USDT)</div>
            <div className="text-center hidden sm:block">Amount ({selectedStock})</div>
            <div className="text-center block sm:hidden">Amount</div>
            <div className="text-right">Total (USDT)</div>
          </div>
        </div>

        {/* 卖单区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={sellOrdersRef} className="flex-1 overflow-y-auto scrollbar-hide flex flex-col justify-end">
            {mergedSellOrders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base-content/70 text-sm">
                No sell orders
              </div>
            ) : (
              mergedSellOrders.slice().reverse().map((order, index) => {
                const amountRatio = getAmountRatio(order.amount, maxSellAmount);
                return (
                  <motion.div
                    key={`sell-${order.price}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative px-2 md:px-4 py-1.5 hover:bg-error/10 transition-colors border-b border-white/5"
                  >
                    {/* 背景占比显示 */}
                    <div 
                      className="absolute inset-0 bg-error/5"
                      style={{ width: `${amountRatio}%` }}
                    />
                    <div 
                      className="relative grid grid-cols-3 gap-2 md:gap-4 text-sm cursor-pointer z-10"
                      onClick={() => onOrderSelect?.({
                        price: order.price,
                        amount: order.amount,
                        type: 'buy'
                      })}
                    >
                      <div className="text-error font-medium text-xs md:text-sm flex items-center gap-1">
                        {formatNumber(order.price)}
                        {order.orderCount > 1 && (
                          <span className="text-xs text-base-content/60">({order.orderCount})</span>
                        )}
                      </div>
                      <div className="text-center text-base-content text-xs md:text-sm">
                        {formatNumber(order.amount, 4)}
                      </div>
                      <div className="text-right text-base-content text-xs md:text-sm">
                        {formatNumber(order.total, 2)}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* 当前价格分割线 */}
        <div className="px-2 md:px-4 py-3 bg-base-200/70 border-y border-white/10">
          <div className="flex items-center justify-center space-x-2">
            <div className="text-lg md:text-xl font-bold text-success">
              ${currentPrice}
            </div>
            <div className="text-xs text-base-content/70">
              ≈ ${currentPrice}
            </div>
          </div>
        </div>

        {/* 买单区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {mergedBuyOrders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base-content/70 text-sm">
                No buy orders
              </div>
            ) : (
              mergedBuyOrders.map((order, index) => {
                const amountRatio = getAmountRatio(order.amount, maxBuyAmount);
                return (
                  <motion.div
                    key={`buy-${order.price}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative px-2 md:px-4 py-1.5 hover:bg-success/10 transition-colors border-b border-white/5"
                  >
                    {/* 背景占比显示 */}
                    <div 
                      className="absolute inset-0 bg-success/5"
                      style={{ width: `${amountRatio}%` }}
                    />
                    <div 
                      className="relative grid grid-cols-3 gap-2 md:gap-4 text-sm cursor-pointer z-10"
                      onClick={() => onOrderSelect?.({
                        price: order.price,
                        amount: order.amount,
                        type: 'sell'
                      })}
                    >
                      <div className="text-success font-medium text-xs md:text-sm flex items-center gap-1">
                        {formatNumber(order.price)}
                        {order.orderCount > 1 && (
                          <span className="text-xs text-base-content/60">({order.orderCount})</span>
                        )}
                      </div>
                      <div className="text-center text-base-content text-xs md:text-sm">
                        {formatNumber(order.amount, 4)}
                      </div>
                      <div className="text-right text-base-content text-xs md:text-sm">
                        {formatNumber(order.total, 2)}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 使用 React.memo 优化渲染性能
const StockOrderBook = React.memo(StockOrderBookComponent);

export default StockOrderBook;
