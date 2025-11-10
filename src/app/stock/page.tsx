"use client";

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import StockList from '@/components/Stock/StockList';
import StockOrderBook from '@/components/Stock/StockOrderBook';
import StockTradingPanel from '@/components/Stock/StockTradingPanel';
import OrderTabs from '@/components/Stock/OrderTabs';
import { RootState } from '@/store';

const StockTradingPage: React.FC = () => {
  const stocks = useSelector((state: RootState) => state.orderBook.stocks);
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [selectedStockPrice, setSelectedStockPrice] = useState<string>('0.10');
  const [activeMobileTab, setActiveMobileTab] = useState<'list' | 'orderbook' | 'trade'>('list');
  const [selectedOrder, setSelectedOrder] = useState<{price: string; amount: string; type: 'buy' | 'sell'} | null>(null);

  // Initialize with first stock's price only if no stock is selected yet
  useEffect(() => {
    if (stocks.length > 0 && !selectedStock) {
      const firstStock = stocks[0];
      setSelectedStock(firstStock.symbol);
      setSelectedStockPrice(firstStock.price);
    }
  }, [stocks, selectedStock]);

  const handleStockSelect = (symbol: string, price: string) => {
    setSelectedStock(symbol);
    setSelectedStockPrice(price);
  };

  return (
    <div className="min-h-screen bg-base-200/60 pt-4">
      <div className="max-w-[1600px] mx-auto px-2 md:px-4">
        {/* 移动端标签导航 */}
        <div className="block md:hidden mb-4">
          <div className="flex bg-base-100/80 backdrop-blur border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setActiveMobileTab('list')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeMobileTab === 'list'
                  ? 'bg-primary text-white'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              Stocks
            </button>
            <button
              onClick={() => setActiveMobileTab('orderbook')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeMobileTab === 'orderbook'
                  ? 'bg-primary text-white'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              Book
            </button>
            <button
              onClick={() => setActiveMobileTab('trade')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeMobileTab === 'trade'
                  ? 'bg-primary text-white'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              Trade
            </button>
          </div>
        </div>

        {/* 桌面端布局 */}
        <div className="hidden md:grid md:grid-cols-12 gap-4">
          {/* 左侧股票列表 - 增加宽度以容纳K线图 */}
          <div className="col-span-4 h-[600px]">
            <StockList 
              selectedStock={selectedStock}
              onStockSelect={handleStockSelect}
            />
          </div>

          {/* 中间订单簿 - 减少宽度 */}
          <div className="col-span-4 h-[600px]">
            <StockOrderBook 
              selectedStock={selectedStock}
              currentPrice={selectedStockPrice}
              onOrderSelect={setSelectedOrder}
            />
          </div>

          {/* 右侧交易面板 */}
          <div className="col-span-4 h-[600px]">
            <StockTradingPanel 
              selectedStock={selectedStock}
              selectedOrder={selectedOrder}
              onOrderClear={() => setSelectedOrder(null)}
            />
          </div>
        </div>

        {/* 移动端内容 */}
        <div className="block md:hidden">
          {activeMobileTab === 'list' && (
            <div className="h-[500px]">
              <StockList 
                selectedStock={selectedStock}
                onStockSelect={handleStockSelect}
              />
            </div>
          )}
          
          {activeMobileTab === 'orderbook' && (
            <div className="h-[500px]">
              <StockOrderBook 
                selectedStock={selectedStock}
                currentPrice={selectedStockPrice}
                onOrderSelect={setSelectedOrder}
              />
            </div>
          )}
          
          {activeMobileTab === 'trade' && (
            <div className="h-[500px]">
              <StockTradingPanel 
                selectedStock={selectedStock}
                selectedOrder={selectedOrder}
                onOrderClear={() => setSelectedOrder(null)}
              />
            </div>
          )}
        </div>

        {/* 桌面端底部订单标签页 */}
        <div className="hidden md:block mt-4 mb-4">
          <OrderTabs 
            selectedStock={selectedStock}
          />
        </div>

        {/* 移动端订单标签页 */}
        <div className="block md:hidden mt-4 mb-4">
          <OrderTabs 
            selectedStock={selectedStock}
          />
        </div>
      </div>
    </div>
  );
};

export default StockTradingPage;
