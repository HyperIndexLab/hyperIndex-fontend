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

interface StockOrderHistoryProps {
  selectedStock?: string;
}

const StockOrderHistory: React.FC<StockOrderHistoryProps> = ({ selectedStock }) => {
  const { address, isConnected } = useAccount();
  const { tradeServiceAddress, usdtAddress, stocks } = useSelector((state: RootState) => state.orderBook);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());


  // 创建地址到名称的映射
  const tokenNames: { [key: string]: string } = {
    [usdtAddress]: 'USDT',
    ...Object.fromEntries(
      stocks.map(stock => [stock.address, stock.symbol])
    )
  };


  // // 获取用户订单
  const fetchUserOrders = async () => {
    if (!isConnected || !address || !tradeServiceAddress) return;

    try {
      setLoading(true);
      const provider = new ethers.JsonRpcProvider('https://testnet.hsk.xyz');
      const contract = new ethers.Contract(tradeServiceAddress, TradeServiceABI.abi, provider);

      // 获取用户订单数量
      const ordersLength = await contract.userOrdersLength(address);
      console.log('StockOrderHistory - Orders length:', ordersLength);
      if (ordersLength === BigInt(0)) {
        setOrders([]);
        return;
      }

      // 获取最近50个订单
      const num = Math.min(Number(ordersLength), 50);
      const userOrders = await contract.getUserOrders(address, 0, num);
      console.log(`stock address: ${selectedStock} StockOrderHistory - User orders:${JSON.stringify(userOrders)}`, );
      // 首先处理异步的 decimals 获取
      const ordersWithDecimals = await Promise.all(
        userOrders
          .filter((order: any) => order[0] !== BigInt(0)) // 过滤掉index为0的订单
          .map(async (order: any) => {
            const tokenInAddr = order[2];
            const tokenOutAddr = order[3];
            
            // 判断是买单还是卖单 - 直接检查地址而不是名称
            const isBuy = tokenInAddr.toLowerCase() === usdtAddress.toLowerCase();
            
            // 获取股票代币的 decimals（非USDT的那个代币）
            const stockTokenAddr = isBuy ? tokenOutAddr : tokenInAddr;
            let stockDecimals = 18; // 默认值
            
            try {
              if (stockTokenAddr.toLowerCase() !== usdtAddress.toLowerCase() && ethers.isAddress(stockTokenAddr)) {
                const stockContract = new ethers.Contract(stockTokenAddr, erc20Abi, provider);
                stockDecimals = await stockContract.decimals();
                console.log(`StockOrderHistory - Got decimals for ${stockTokenAddr}:`, stockDecimals);
              }
            } catch (error) {
              console.warn('Failed to get decimals for', stockTokenAddr, 'using default 18', error);
            }
            
            return { ...order, stockDecimals, isBuy, tokenInAddr, tokenOutAddr };
          })
      );
      
      const formattedOrders: UserOrder[] = ordersWithDecimals.map((orderData: any) => {
        const { stockDecimals, isBuy, tokenInAddr, tokenOutAddr } = orderData;
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
          console.log(`StockOrderHistory Buy - USDT: ${usdtAmount}, Stock: ${stockAmount}, Decimals: ${stockDecimals}, Price: ${price}`);
        } else {
          // 卖单：Stock -> USDT，价格 = amountOut / amountIn
          const stockAmount = parseFloat(ethers.formatUnits(amountIn, stockDecimals));
          const usdtAmount = parseFloat(ethers.formatUnits(amountOut, 6));
          price = stockAmount > 0 ? (usdtAmount / stockAmount).toFixed(6) : '0';
          console.log(`StockOrderHistory Sell - Stock: ${stockAmount}, USDT: ${usdtAmount}, Decimals: ${stockDecimals}, Price: ${price}`);
        }
        
        return {
          index: order[0].toString(),
          trade: order[1],
          tokenIn: tokenNames[tokenInAddr] || tokenInAddr,
          tokenOut: tokenNames[tokenOutAddr] || tokenOutAddr,
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
            return order.tokenIn === selectedStock || order.tokenOut === selectedStock;
          }
          return true;
        });

      setOrders(formattedOrders);
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

  return (
    <div className="bg-base-100/80 backdrop-blur border border-white/10 rounded-lg">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-content">
            Order History {selectedStock && `- ${selectedStock}`}
          </h3>
          <button
            // onClick={fetchUserOrders}
            disabled={loading}
            className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-base-200/50">
            <tr>
              <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-base-content/70 hidden md:table-cell">Time</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-base-content/70">Pair</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-base-content/70">Type</th>
              <th className="px-2 md:px-4 py-3 text-right text-xs font-medium text-base-content/70">Price</th>
              <th className="px-2 md:px-4 py-3 text-right text-xs font-medium text-base-content/70 hidden sm:table-cell">Amount</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-base-content/70 hidden sm:table-cell">Status</th>
              <th className="px-2 md:px-4 py-3 text-center text-xs font-medium text-base-content/70">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 md:px-4 py-8 text-center text-base-content/70 text-sm">
                  {loading ? 'Loading orders...' : 'No orders found'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.index} className="border-b border-white/10 hover:bg-base-200/60">
                  <td className="px-2 md:px-4 py-3 text-xs text-base-content hidden md:table-cell">
                    {order.createTime}
                  </td>
                  <td className="px-2 md:px-4 py-3">
                    <div className="text-xs md:text-sm font-medium text-base-content">
                      {order.tokenIn}/{order.tokenOut}
                    </div>
                    <div className="block md:hidden text-xs text-base-content/70">
                      {order.createTime}
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-3">
                    <span className={`text-xs font-medium ${
                      order.type === 'buy' ? 'text-success' : 'text-error'
                    }`}>
                      {order.type.toUpperCase()}
                    </span>
                    <div className="block sm:hidden text-xs text-base-content/70 mt-1">
                      {parseFloat(order.amountOut).toFixed(4)}
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-3 text-right">
                    <div className="text-xs md:text-sm font-medium text-base-content">
                      ${order.price}
                    </div>
                    <div className="block sm:hidden text-xs">
                      <span className={`font-medium ${getStatusColor(order)}`}>
                        {getOrderStatus(order)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-3 text-right text-xs md:text-sm text-base-content hidden sm:table-cell">
                    {parseFloat(order.amountOut).toFixed(4)}
                  </td>
                  <td className="px-2 md:px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs font-medium ${getStatusColor(order)}`}>
                      {getOrderStatus(order)}
                    </span>
                  </td>
                  <td className="px-2 md:px-4 py-3 text-center">
                    {!order.isRemoved && order.orderId !== '0' && (
                      <button
                        onClick={() => cancelOrder(order)}
                        disabled={cancellingOrders.has(order.index)}
                        className="text-error hover:text-error/80 text-xs font-medium disabled:opacity-50 py-1 px-2"
                      >
                        {cancellingOrders.has(order.index) ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockOrderHistory;
