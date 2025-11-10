"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import TradeServiceABI from '@/constant/abi/TradeService.json';
import ERC20ABI from '@/constant/abi/ERC20.json';

interface StockTradingPanelProps {
  selectedStock: string;
  selectedOrder?: {price: string; amount: string; type: 'buy' | 'sell'} | null;
  onOrderClear?: () => void;
}

const StockTradingPanelComponent: React.FC<StockTradingPanelProps> = ({ selectedStock, selectedOrder, onOrderClear }) => {
  const { address, isConnected } = useAccount();
  const { tradeServiceAddress, stockAddresses, usdtAddress } = useSelector((state: RootState) => state.orderBook);
  
  // 交易状态
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 余额状态
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [stockBalance, setStockBalance] = useState('0');

  // 获取余额
  const fetchBalances = async () => {
    if (!isConnected || !address) return;

    try {
      const provider = new ethers.JsonRpcProvider('https://testnet.hsk.xyz');
      
      // 获取USDT余额
      const usdtContract = new ethers.Contract(usdtAddress, ERC20ABI.abi, provider);
      const usdtBal = await usdtContract.balanceOf(address);
      setUsdtBalance(ethers.formatUnits(usdtBal, 6));

      // 获取股票代币余额
      const stockAddress = stockAddresses[selectedStock];
      if (stockAddress) {
        const stockContract = new ethers.Contract(stockAddress, ERC20ABI.abi, provider);
        const stockBal = await stockContract.balanceOf(address);
        const decimals = await stockContract.decimals();
        setStockBalance(ethers.formatUnits(stockBal, decimals));
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [isConnected, address, selectedStock]);

  // 当选中订单时，填充表单
  useEffect(() => {
    if (selectedOrder) {
      setPrice(selectedOrder.price);
      setAmount(selectedOrder.amount);
      setOrderType(selectedOrder.type);
    }
  }, [selectedOrder]);


  // 计算总价
  const calculateTotal = () => {
    if (!price || !amount) return '0';
    return (parseFloat(price) * parseFloat(amount)).toFixed(6);
  };

  // 检查授权
  const checkAllowance = async (tokenAddress: string) => {
    if (!isConnected || !address) return false;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(tokenAddress, ERC20ABI.abi, provider);
      const allowance = await contract.allowance(address, tradeServiceAddress);
      return allowance > 0;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  // 授权代币
  const approveToken = async (tokenAddress: string) => {
    if (!isConnected || !address) return false;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(tokenAddress, ERC20ABI.abi, signer);
      
      toast.info('Approving token...');
      const tx = await contract.approve(tradeServiceAddress, ethers.MaxUint256);
      await tx.wait();
      
      toast.success('Token approved successfully!');
      return true;
    } catch (error) {
      console.error('Error approving token:', error);
      toast.error('Failed to approve token');
      return false;
    }
  };

  // 下单
  const placeOrder = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!price || !amount) {
      toast.error('Please enter price and amount');
      return;
    }

    const stockAddress = stockAddresses[selectedStock];
    if (!stockAddress) {
      toast.error('Invalid stock selected');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(tradeServiceAddress, TradeServiceABI.abi, signer);

      let tokenIn: string;
      let tokenOut: string;
      let amountIn: bigint;
      let amountOutForPrice: bigint;

      const stockContract = new ethers.Contract(stockAddress, ERC20ABI.abi, provider);
      const decimals = await stockContract.decimals();

      if (orderType === 'buy') {
        // 买入：USDT -> Stock
        tokenIn = usdtAddress;
        tokenOut = stockAddress;
        amountIn = ethers.parseUnits(calculateTotal(), 6); // USDT decimals
        amountOutForPrice = ethers.parseUnits(amount, decimals); // Stock decimals

        // 检查USDT授权
        const hasAllowance = await checkAllowance(usdtAddress);
        if (!hasAllowance) {
          const approved = await approveToken(usdtAddress);
          if (!approved) return;
        }
      } else {
        // 卖出：Stock -> USDT
        tokenIn = stockAddress;
        tokenOut = usdtAddress;
        amountIn = ethers.parseUnits(amount, decimals); // Stock decimals
        amountOutForPrice = ethers.parseUnits(calculateTotal(), 6); // USDT decimals

        // 检查股票代币授权
        const hasAllowance = await checkAllowance(stockAddress);
        if (!hasAllowance) {
          const approved = await approveToken(stockAddress);
          if (!approved) return;
        }
      }

      toast.info(`Placing ${orderType} order...`);
      const tx = await contract.placeOrder(tokenIn, tokenOut, amountIn, amountOutForPrice);
      
      toast.info('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      
      toast.success(`${orderType.charAt(0).toUpperCase() + orderType.slice(1)} order placed successfully!`);
      
      // 清除输入
      setPrice('');
      setAmount('');
      
      // 清除选中的订单
      onOrderClear?.();
      
      // 刷新余额
      fetchBalances();
      
    } catch (error: any) {
      console.error('Error placing order:', error);
      if (error.reason) {
        toast.error(`Transaction failed: ${error.reason}`);
      } else {
        toast.error('Failed to place order');
      }
    } finally {
      setLoading(false);
    }
  };

  // 设置最大金额
  const setMaxAmount = () => {
    if (orderType === 'buy') {
      if (price) {
        const maxAmount = (parseFloat(usdtBalance) / parseFloat(price)).toFixed(6);
        setAmount(maxAmount);
      }
    } else {
      setAmount(stockBalance);
    }
  };

  return (
    <div className="bg-base-100/80 backdrop-blur border border-white/10 rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-base-content">
            Trade {selectedStock}
          </h2>
          {selectedOrder && (
            <button
              onClick={onOrderClear}
              className="text-xs text-base-content/70 hover:text-base-content transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>
      
        {/* 买入/卖出切换 */}
        <div className="flex bg-base-200/50 rounded-lg p-1 mb-4">
          <button
            onClick={() => setOrderType('buy')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              orderType === 'buy'
                ? 'bg-success text-white'
                : 'text-base-content/70 hover:text-base-content'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setOrderType('sell')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              orderType === 'sell'
                ? 'bg-error text-white'
                : 'text-base-content/70 hover:text-base-content'
            }`}
          >
            Sell
          </button>
        </div>

        {/* 余额显示 */}
        <div className="mb-4 p-3 bg-base-200/50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs md:text-sm text-base-content/70">USDT Balance:</span>
            <span className="text-xs md:text-sm font-medium text-base-content">
              {parseFloat(usdtBalance).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs md:text-sm text-base-content/70">{selectedStock} Balance:</span>
            <span className="text-xs md:text-sm font-medium text-base-content">
              {parseFloat(stockBalance).toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 md:p-4 space-y-3 md:space-y-4">
        {/* 价格输入 */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-base-content/70 mb-2">
            Price (USDT)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-3 md:py-2 bg-base-200/50 border border-white/5 rounded-lg text-base-content placeholder:text-base-content/60 focus:outline-none focus:border-primary text-sm md:text-base"
          />
        </div>

        {/* 数量输入 */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-base-content/70 mb-2">
            Amount ({selectedStock})
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-3 md:py-2 pr-12 bg-base-200/50 border border-white/5 rounded-lg text-base-content placeholder:text-base-content/60 focus:outline-none focus:border-primary text-sm md:text-base"
            />
            <button
              onClick={setMaxAmount}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium py-1 px-2"
            >
              MAX
            </button>
          </div>
        </div>

        {/* 总价显示 */}
        <div className="p-3 bg-base-200/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-xs md:text-sm text-base-content/70">Total (USDT):</span>
            <span className="text-base md:text-lg font-semibold text-base-content">
              {calculateTotal()}
            </span>
          </div>
        </div>

        {/* 下单按钮 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={placeOrder}
          disabled={loading || !isConnected}
          className={`w-full py-4 md:py-3 rounded-lg font-semibold text-white transition-colors text-sm md:text-base ${
            orderType === 'buy'
              ? 'bg-success hover:bg-success/90 disabled:bg-success/50'
              : 'bg-error hover:bg-error/90 disabled:bg-error/50'
          } disabled:cursor-not-allowed`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-sm md:text-base">Processing...</span>
            </div>
          ) : (
            `${orderType === 'buy' ? 'Buy' : 'Sell'} ${selectedStock}`
          )}
        </motion.button>

        {!isConnected && (
          <div className="text-center text-xs md:text-sm text-base-content/70">
            Please connect your wallet to start trading
          </div>
        )}

      </div>
    </div>
  );
};

// 使用 React.memo 优化渲染性能
const StockTradingPanel = React.memo(StockTradingPanelComponent);

export default StockTradingPanel;
