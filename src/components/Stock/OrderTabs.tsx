"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import TradeServiceABI from '@/constant/abi/TradeService.json';
import MonoTradeABI from '@/constant/abi/MonoTrade.json';
import { erc20Abi } from 'viem';

interface UserOrder {
  index: string;
  trade: string;
  tokenIn: string;
  tokenOut: string;
  orderId: string;
  createTime: string;
  amountIn: string;
  amountOut: string;
  progress: string;
  isRemoved: boolean;
  type: 'buy' | 'sell';
  price: string;
}

interface OrderTabsProps {
  selectedStock?: string;
}

const OrderTabs: React.FC<OrderTabsProps> = ({ selectedStock }) => {
  const { address, isConnected } = useAccount();
  const { tradeServiceAddress, usdtAddress, stocks } = useSelector((state: RootState) => state.orderBook);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [allOrders, setAllOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());
  
  // 缓存 decimals 以避免重复调用
  const [decimalsCache, setDecimalsCache] = useState<{ [address: string]: number }>({});

  // 创建地址到名称的映射
  const tokenNames: { [key: string]: string } = {
    [usdtAddress]: 'USDT',
    ...Object.fromEntries(
      stocks.map(stock => [stock.address, stock.symbol])
    )
  };
  
  // 创建名称到地址的映射（反向映射）
  const symbolToAddress: { [key: string]: string } = {
    'USDT': usdtAddress,
    // 合约可能返回的符号映射
    'APPL': '0x9F89DeaaeFee69638E20bcb9c6B8Df94302c6c3D', // AAPL 的兼容性映射
    ...Object.fromEntries(
      stocks.map(stock => [stock.symbol, stock.address])
    )
  };
  
  console.log('Token mappings:', { tokenNames, symbolToAddress, usdtAddress });

  // 获取用户订单
  const fetchUserOrders = async () => {
    if (!isConnected || !address || !tradeServiceAddress) return;

    try {
      setLoading(true);
      const provider = new ethers.JsonRpcProvider('https://testnet.hsk.xyz');
      const contract = new ethers.Contract(tradeServiceAddress, TradeServiceABI.abi, provider);

      // 获取用户订单数量
      const ordersLength = await contract.userOrdersLength(address);
      if (ordersLength === BigInt(0)) {
        setAllOrders([]);
        return;
      }

      // 获取最近50个订单
      const num = Math.min(Number(ordersLength), 50);
      const userOrders = await contract.getUserOrders(address, 0, num);
      

      // 首先处理异步的 decimals 获取
      const ordersWithDecimals = await Promise.all(
        userOrders
          .filter((order: any) => order[0] !== BigInt(0)) // 过滤掉index为0的订单
          .map(async (order: any) => {
            const tokenInSymbol = order[2];  // 合约返回的是符号
            const tokenOutSymbol = order[3]; // 合约返回的是符号
            
            // 将符号转换为实际地址
            const tokenInAddr = symbolToAddress[tokenInSymbol] || tokenInSymbol;
            const tokenOutAddr = symbolToAddress[tokenOutSymbol] || tokenOutSymbol;
            
          
            // 判断是买单还是卖单 - 检查符号更简单准确
            const isBuy = tokenInSymbol === 'USDT';
            
            // 获取股票代币的 decimals（非USDT的那个代币）
            const stockTokenAddr = isBuy ? tokenOutAddr : tokenInAddr;
            let stockDecimals = 18; // 默认值
            
            try {
              if (stockTokenAddr.toLowerCase() !== usdtAddress.toLowerCase() && ethers.isAddress(stockTokenAddr)) {
                // 检查缓存
                if (decimalsCache[stockTokenAddr]) {
                  stockDecimals = decimalsCache[stockTokenAddr];
                } else {
                  const stockContract = new ethers.Contract(stockTokenAddr, erc20Abi, provider);
                  stockDecimals = await stockContract.decimals();
                  
                  // 更新缓存
                  setDecimalsCache(prev => ({
                    ...prev,
                    [stockTokenAddr]: stockDecimals
                  }));
                }
              }
            } catch (error) {
              console.warn('Failed to get decimals for', stockTokenAddr, 'using default 18', error);
            }
            
            return { ...order, stockDecimals, isBuy, tokenInAddr, tokenOutAddr, tokenInSymbol, tokenOutSymbol };
          })
      );
      
      const formattedOrders: UserOrder[] = ordersWithDecimals.map((orderData: any) => {
        const { stockDecimals, isBuy, tokenInSymbol, tokenOutSymbol } = orderData;
        const order = orderData;
        const amountIn = order[6];
        const amountOut = order[7];
        
        // 计算价格
        let price = '0';
        if (isBuy) {
          // 买单：USDT -> Stock，价格 = amountIn / amountOut
          const usdtAmount = parseFloat(ethers.formatUnits(amountIn, 6));
          const stockAmount = parseFloat(ethers.formatUnits(amountOut, stockDecimals));
          price = stockAmount > 0 ? (usdtAmount / stockAmount).toFixed(6) : '0';
        } else {
          // 卖单：Stock -> USDT，价格 = amountOut / amountIn
          const stockAmount = parseFloat(ethers.formatUnits(amountIn, stockDecimals));
          const usdtAmount = parseFloat(ethers.formatUnits(amountOut, 6));
          price = stockAmount > 0 ? (usdtAmount / stockAmount).toFixed(6) : '0';
        }
        
        return {
          index: order[0].toString(),
          trade: order[1],
          tokenIn: tokenInSymbol,   // 直接使用符号
          tokenOut: tokenOutSymbol, // 直接使用符号
          orderId: order[4].toString(),
          createTime: new Date(Number(order[5]) * 1000).toLocaleString(),
          amountIn: isBuy ? ethers.formatUnits(amountIn, 6) : ethers.formatUnits(amountIn, stockDecimals),
          amountOut: isBuy ? ethers.formatUnits(amountOut, stockDecimals) : ethers.formatUnits(amountOut, 6),
          progress: order[8].toString(),
          isRemoved: order[9],
          type: (isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
          price
        };
      })
        .filter((order: UserOrder) => {
          // 如果指定了特定股票，只显示该股票的订单
          if (selectedStock) {
            // 处理符号兼容性问题 (AAPL vs APPL)
            const normalizeSymbol = (symbol: string) => {
              return symbol;
            };
            
            const normalizedTokenIn = normalizeSymbol(order.tokenIn);
            const normalizedTokenOut = normalizeSymbol(order.tokenOut);
            
            console.log('Filtering order:', {
              selectedStock,
              orderTokenIn: order.tokenIn,
              orderTokenOut: order.tokenOut,
              normalizedTokenIn,
              normalizedTokenOut,
              matches: normalizedTokenIn === selectedStock || normalizedTokenOut === selectedStock
            });
            
            return normalizedTokenIn === selectedStock || normalizedTokenOut === selectedStock;
          }
          return true;
        });

      setAllOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching user orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // 取消订单
  const cancelOrder = async (order: UserOrder) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (order.isRemoved || order.orderId === '0') {
      toast.error('This order cannot be cancelled');
      return;
    }

    try {
      setCancellingOrders(prev => new Set(prev).add(order.index));
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(order.trade, MonoTradeABI.abi, signer);

      toast.info('Cancelling order...');
      const tx = await contract.cancelOrder(order.orderId);
      
      toast.info('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      
      toast.success('Order cancelled successfully!');
      
      // 刷新订单列表
      fetchUserOrders();
      
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      if (error.reason) {
        toast.error(`Failed to cancel order: ${error.reason}`);
      } else {
        toast.error('Failed to cancel order');
      }
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.index);
        return newSet;
      });
    }
  };

  useEffect(() => {
    fetchUserOrders();
    
    // 定时刷新订单
    const interval = setInterval(fetchUserOrders, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address, tradeServiceAddress, selectedStock]);

  // 获取订单状态
  const getOrderStatus = (order: UserOrder) => {
    if (order.isRemoved) return 'Cancelled/Filled';
    if (order.orderId === '0') return 'Market Order';
    
    const progressPercent = (parseInt(order.progress) / 4294967295) * 100;
    if (progressPercent === 0) return 'Open';
    if (progressPercent >= 99.9) return 'Filled';
    return `${progressPercent.toFixed(1)}% Filled`;
  };

  const getStatusColor = (order: UserOrder) => {
    if (order.isRemoved) return 'text-base-content/70';
    if (order.orderId === '0') return 'text-primary';
    
    const progressPercent = (parseInt(order.progress) / 4294967295) * 100;
    if (progressPercent === 0) return 'text-success';
    if (progressPercent >= 99.9) return 'text-primary';
    return 'text-yellow-500';
  };

  // 过滤活跃订单（未取消且未完成的订单）
  const activeOrders = allOrders.filter(order => !order.isRemoved && order.orderId !== '0');
  
  // 历史订单包括所有订单
  const historyOrders = allOrders;

  return (
    <div className="bg-base-100/80 backdrop-blur border border-white/10 rounded-lg h-80 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex bg-base-200/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-primary text-white'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              Active Orders
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-primary text-white'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              Order History
            </button>
          </div>
          <div className="flex items-center gap-2">
            {selectedStock && (
              <span className="text-sm text-base-content/70">
                {selectedStock}
              </span>
            )}
            <button
              onClick={fetchUserOrders}
              disabled={loading}
              className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* 表头 - 固定位置 */}
      <div className="bg-base-200/50">
        <div className={`grid gap-2 px-2 md:px-4 py-3 text-xs font-medium text-base-content/70 ${
          activeTab === 'active' ? 'grid-cols-12' : 'grid-cols-12'
        }`}>
          <div className="col-span-2 hidden md:block">Time</div>
          <div className="col-span-2 md:col-span-2">Pair</div>
          <div className="col-span-2 md:col-span-1">Type</div>
          <div className="col-span-2 md:col-span-2 text-right">Price</div>
          <div className="col-span-2 md:col-span-2 text-right hidden sm:block">Amount</div>
          <div className="col-span-2 md:col-span-2 hidden sm:block">Status</div>
          {activeTab === 'active' && (
            <div className="col-span-2 md:col-span-1 text-center">Action</div>
          )}
        </div>
      </div>

      {/* 表格内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {(activeTab === 'active' ? activeOrders : historyOrders).length === 0 ? (
          <div className="px-2 md:px-4 py-8 text-center text-base-content/70 text-sm">
            {loading ? 'Loading orders...' : `No ${activeTab} orders found`}
          </div>
        ) : (
          (activeTab === 'active' ? activeOrders : historyOrders).map((order) => (
            <div key={order.index} className="border-b border-white/10 hover:bg-base-200/60">
              <div className={`grid gap-2 px-2 md:px-4 py-3 items-center ${
                activeTab === 'active' ? 'grid-cols-12' : 'grid-cols-12'
              }`}>
                {/* Time */}
                <div className="col-span-2 hidden md:block text-xs text-base-content">
                  {order.createTime}
                </div>
                
                {/* Pair */}
                <div className="col-span-2 md:col-span-2">
                  <div className="text-xs md:text-sm font-medium text-base-content">
                    {order.tokenIn}/{order.tokenOut}
                  </div>
                  <div className="block md:hidden text-xs text-base-content/70">
                    {order.createTime}
                  </div>
                </div>
                
                {/* Type */}
                <div className="col-span-2 md:col-span-1">
                  <span className={`text-xs font-medium ${
                    order.type === 'buy' ? 'text-success' : 'text-error'
                  }`}>
                    {order.type.toUpperCase()}
                  </span>
                  <div className="block sm:hidden text-xs text-base-content/70 mt-1">
                    {parseFloat(order.amountOut).toFixed(4)}
                  </div>
                </div>
                
                {/* Price */}
                <div className="col-span-2 md:col-span-2 text-right">
                  <div className="text-xs md:text-sm font-medium text-base-content">
                    ${order.price}
                  </div>
                  <div className="block sm:hidden text-xs">
                    <span className={`font-medium ${getStatusColor(order)}`}>
                      {getOrderStatus(order)}
                    </span>
                  </div>
                </div>
                
                {/* Amount */}
                <div className="col-span-2 md:col-span-2 text-right text-xs md:text-sm text-base-content hidden sm:block">
                  {parseFloat(order.amountOut).toFixed(4)}
                </div>
                
                {/* Status */}
                <div className="col-span-2 md:col-span-2 hidden sm:block">
                  <span className={`text-xs font-medium ${getStatusColor(order)}`}>
                    {getOrderStatus(order)}
                  </span>
                </div>
                
                {/* Action */}
                {activeTab === 'active' && (
                  <div className="col-span-2 md:col-span-1 text-center">
                    {!order.isRemoved && order.orderId !== '0' && (
                      <button
                        onClick={() => cancelOrder(order)}
                        disabled={cancellingOrders.has(order.index)}
                        className="text-error hover:text-error/80 text-xs font-medium disabled:opacity-50 py-1 px-2"
                      >
                        {cancellingOrders.has(order.index) ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderTabs;
