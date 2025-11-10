"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchStockPrices, type Stock } from '@/store/orderBookSlice';

interface StockListProps {
  selectedStock: string;
  onStockSelect: (symbol: string, price: string) => void;
}

type SortField = 'price' | 'change24h' | null;
type SortDirection = 'asc' | 'desc';

const StockListComponent: React.FC<StockListProps> = ({ selectedStock, onStockSelect }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { stocks, stocksLoading, stocksError } = useSelector((state: RootState) => state.orderBook);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<'ALL' | 'US' | 'HK' | 'CN' | 'CRYPTO'>('ALL');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 排序功能
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // 如果点击同一字段，切换排序方向
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // 如果点击不同字段，设置新字段并默认降序
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 排序图标组件
  const SortIcon: React.FC<{ field: SortField; currentField: SortField; direction: SortDirection }> = ({ 
    field, 
    currentField, 
    direction 
  }) => {
    const isActive = field === currentField;
    
    return (
      <div className="inline-flex flex-col ml-1">
        <svg
          width="8"
          height="4"
          viewBox="0 0 8 4"
          className={`${
            isActive && direction === 'asc' 
              ? 'fill-primary' 
              : 'fill-base-content/50 hover:fill-base-content/70'
          } transition-colors`}
        >
          <path d="M4 0L0 4h8L4 0z" />
        </svg>
        <svg
          width="8"
          height="4"
          viewBox="0 0 8 4"
          className={`${
            isActive && direction === 'desc' 
              ? 'fill-primary' 
              : 'fill-base-content/50 hover:fill-base-content/70'
          } transition-colors`}
        >
          <path d="M4 4L8 0H0L4 4z" />
        </svg>
      </div>
    );
  };

  const refreshStocks = useCallback(() => {
    dispatch(fetchStockPrices());
  }, [dispatch]);

  // 获取股票价格数据
  useEffect(() => {
    refreshStocks();
    
    // 增加更新间隔到60秒，减少API调用频率
    const interval = setInterval(() => {
      // 只有在页面可见时才更新股票价格
      if (!document.hidden) {
        refreshStocks();
      }
    }, 60000);

    // 页面从不可见变为可见时立即更新
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshStocks();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStocks]);

  // 使用useMemo优化过滤和排序性能
  const filteredStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           stock.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMarket = selectedMarket === 'ALL' || stock.market === selectedMarket;
      return matchesSearch && matchesMarket;
    });

    // 应用排序
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortField === 'price') {
          aValue = parseFloat(a.price);
          bValue = parseFloat(b.price);
        } else if (sortField === 'change24h') {
          // 移除%符号并转换为数字
          aValue = parseFloat(a.changePercent24h.replace('%', '').replace('+', ''));
          bValue = parseFloat(b.changePercent24h.replace('%', '').replace('+', ''));
        } else {
          return 0;
        }

        if (sortDirection === 'desc') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });
    }

    return filtered;
  }, [searchTerm, selectedMarket, stocks, sortField, sortDirection]);

  const isPositiveChange = (change: string) => change.startsWith('+');

  // 获取市场标识颜色和标签
  const getMarketInfo = (market: string) => {
    switch (market) {
      case 'US':
        return { label: 'US', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'HK':
        return { label: 'HK', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'CN':
        return { label: 'CN', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'CRYPTO':
        return { label: 'CRYPTO', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      default:
        return { label: 'OTHER', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  // 获取显示名称和副标题
  const getDisplayInfo = (stock: Stock) => {
    if (stock.market === 'HK' || stock.market === 'CN') {
      // HK和CN市场：公司名称为主，代码为辅
      return {
        primary: stock.name,
        secondary: stock.symbol + (stock.exchange ? ` • ${stock.exchange}` : '')
      };
    } else {
      // US和CRYPTO市场：代码为主，公司名称为辅
      return {
        primary: stock.symbol,
        secondary: stock.name + (stock.exchange ? ` • ${stock.exchange}` : '')
      };
    }
  };

  // 生成模拟K线数据
  const generateMiniChartData = (symbol: string) => {
    const basePrice = parseFloat(stocks.find(s => s.symbol === symbol)?.price || '100');
    const points: number[] = [];
    
    // 生成8个数据点用于迷你图表
    for (let i = 0; i < 8; i++) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% 变化
      const price = basePrice * (1 + variation);
      points.push(price);
    }
    
    return points;
  };

  // 迷你K线图组件
  const MiniChart: React.FC<{ symbol: string; isPositive: boolean }> = ({ symbol, isPositive }) => {
    const data = generateMiniChartData(symbol);
    const minPrice = Math.min(...data);
    const maxPrice = Math.max(...data);
    const priceRange = maxPrice - minPrice || 1;
    
    // 将价格数据转换为SVG坐标
    const points = data.map((price, index) => {
      const x = (index / (data.length - 1)) * 64; // 64px宽度（再增加33%）
      const y = 12 - ((price - minPrice) / priceRange) * 12; // 12px高度，翻转Y轴
      return { x, y };
    });

    const pathData = points.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `${path} L ${point.x} ${point.y}`;
    }, '');

    return (
      <svg width="64" height="12" className="ml-1 hidden sm:block">
        <path
          d={pathData}
          stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="bg-base-100/80 backdrop-blur border border-white/10 rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-base-content">Stock Tokens</h2>
            {stocksLoading && filteredStocks.length > 0 && (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <button 
            onClick={refreshStocks}
            disabled={stocksLoading}
            className="p-2 rounded-lg hover:bg-base-200/50 transition-colors disabled:opacity-50"
            title="Refresh stock prices"
          >
            <svg
              className={`w-4 h-4 text-base-content/70 ${stocksLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        {/* 搜索框 */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-base-200/50 border border-white/5 rounded-lg text-base-content placeholder:text-base-content/60 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* 市场过滤器 */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'US', 'HK', 'CN', 'CRYPTO'] as const).map((market) => (
            <button
              key={market}
              onClick={() => setSelectedMarket(market)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedMarket === market
                  ? 'bg-primary text-white'
                  : 'bg-base-200/50 text-base-content/70 hover:text-base-content border border-white/5'
              }`}
            >
              {market}
            </button>
          ))}
        </div>
      </div>

      {/* 表头 */}
      <div className="px-4 py-2 border-b border-white/10 bg-base-200/50">
        {/* 桌面端表头 */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-base-content/70 font-medium">
          <div className="col-span-4">Symbol</div>
          <div className="col-span-3"></div>
          <div 
            className="col-span-3 text-right flex items-center justify-end cursor-pointer hover:text-base-content transition-colors"
            onClick={() => handleSort('price')}
          >
            Price
            <SortIcon field="price" currentField={sortField} direction={sortDirection} />
          </div>
          <div 
            className="col-span-2 text-right flex items-center justify-end cursor-pointer hover:text-base-content transition-colors"
            onClick={() => handleSort('change24h')}
          >
            24h%
            <SortIcon field="change24h" currentField={sortField} direction={sortDirection} />
          </div>
        </div>
        
        {/* 移动端表头 */}
        <div className="sm:hidden grid grid-cols-12 gap-2 text-xs text-base-content/70 font-medium">
          <div className="col-span-6">Symbol</div>
          <div 
            className="col-span-3 text-right flex items-center justify-end cursor-pointer hover:text-base-content transition-colors"
            onClick={() => handleSort('price')}
          >
            Price
            <SortIcon field="price" currentField={sortField} direction={sortDirection} />
          </div>
          <div 
            className="col-span-3 text-right flex items-center justify-end cursor-pointer hover:text-base-content transition-colors"
            onClick={() => handleSort('change24h')}
          >
            24h%
            <SortIcon field="change24h" currentField={sortField} direction={sortDirection} />
          </div>
        </div>
      </div>

      {/* 股票列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {stocksError && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-error mb-2">Failed to load stock prices</div>
              <div className="text-base-content/70 text-sm mb-3">{stocksError}</div>
              <button 
                onClick={refreshStocks}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {(!stocksError && (filteredStocks.length > 0 || stocksLoading)) && (
          <>
            {stocksLoading && filteredStocks.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-base-content/70">Loading stock prices...</span>
              </div>
            )}
            
            {filteredStocks.map((stock) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1,
                  backgroundColor: selectedStock === stock.symbol 
                    ? 'rgba(59, 130, 246, 0.1)' 
                    : 'transparent'
                }}
                whileHover={{ 
                  backgroundColor: selectedStock === stock.symbol 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : 'rgba(59, 130, 246, 0.05)' 
                }}
                className={`px-4 py-3 border-b border-white/10 cursor-pointer transition-colors ${
                  selectedStock === stock.symbol ? 'border-l-2 border-l-primary' : ''
                }`}
                onClick={() => onStockSelect(stock.symbol, stock.price)}
              >
                {/* 桌面端布局 */}
                <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                  {/* 股票符号和名称 */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      {/* 涨跌幅三角形图标 */}
                      <div className={`w-0 h-0 flex-shrink-0 ${
                        isPositiveChange(stock.changePercent24h)
                          ? 'border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-success'
                          : 'border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-error'
                      }`}></div>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-sm font-medium text-base-content">
                          {getDisplayInfo(stock).primary}
                        </div>
                        {/* 市场标识 */}
                        <div className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getMarketInfo(stock.market).color}`}>
                          {getMarketInfo(stock.market).label}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-base-content/70 truncate">
                      {getDisplayInfo(stock).secondary}
                    </div>
                  </div>

                  {/* 迷你K线图独立列 */}
                  <div className="col-span-3 flex justify-center items-center">
                    <MiniChart 
                      symbol={stock.symbol} 
                      isPositive={isPositiveChange(stock.changePercent24h)} 
                    />
                  </div>

                  {/* 价格 */}
                  <div className="col-span-3 text-right">
                    <div className="text-sm font-medium text-base-content">
                      ${stock.price}
                    </div>
                  </div>

                  {/* 24小时变化 */}
                  <div className="col-span-2 text-right">
                    <div className={`text-sm font-medium ${
                      isPositiveChange(stock.changePercent24h) 
                        ? 'text-success' 
                        : 'text-error'
                    }`}>
                      {stock.changePercent24h}
                    </div>
                    <div className={`text-xs ${
                      isPositiveChange(stock.change24h) 
                        ? 'text-success' 
                        : 'text-error'
                    }`}>
                      {stock.change24h}
                    </div>
                  </div>
                </div>

                {/* 移动端布局 */}
                <div className="sm:hidden grid grid-cols-12 gap-2 items-center">
                  {/* 股票符号和名称 */}
                  <div className="col-span-6">
                    <div className="flex items-center gap-2">
                      {/* 涨跌幅三角形图标 */}
                      <div className={`w-0 h-0 flex-shrink-0 ${
                        isPositiveChange(stock.changePercent24h)
                          ? 'border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-success'
                          : 'border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-error'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-base-content">
                            {getDisplayInfo(stock).primary}
                          </div>
                          {/* 市场标识 */}
                          <div className={`px-1 py-0.5 rounded text-xs font-medium border ${getMarketInfo(stock.market).color}`}>
                            {getMarketInfo(stock.market).label}
                          </div>
                        </div>
                        <div className="text-xs text-base-content/70 truncate">
                          {getDisplayInfo(stock).secondary}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 价格 */}
                  <div className="col-span-3 text-right">
                    <div className="text-sm font-medium text-base-content">
                      ${stock.price}
                    </div>
                  </div>

                  {/* 24小时变化 */}
                  <div className="col-span-3 text-right">
                    <div className={`text-sm font-medium ${
                      isPositiveChange(stock.changePercent24h) 
                        ? 'text-success' 
                        : 'text-error'
                    }`}>
                      {stock.changePercent24h}
                    </div>
                    <div className={`text-xs ${
                      isPositiveChange(stock.change24h) 
                        ? 'text-success' 
                        : 'text-error'
                    }`}>
                      {stock.change24h}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// 使用 React.memo 优化渲染性能
const StockList = React.memo(StockListComponent);

export default StockList;
