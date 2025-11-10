import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '.';

export type Market = 'US' | 'HK' | 'CN' | 'CRYPTO';

export interface Stock {
  symbol: string;
  name: string;
  price: string;
  change24h: string;
  changePercent24h: string;
  volume24h: string;
  address: string;
  market: Market;
  exchange?: string;
  high24h?: string;
  low24h?: string;
  timestamp?: number;
}

interface OrderBookState {
  stocks: Stock[];
  stocksLoading: boolean;
  stocksError: string | null;
  stockAddresses: Record<string, string>;
  tradeServiceAddress: string;
  usdtAddress: string;
}

const DEFAULT_TRADE_SERVICE_ADDRESS = '0x4e40FdBBee16fa4f3291be211fc4103F57F7c493';
const DEFAULT_USDT_ADDRESS = '0x60EFCa24B785391C6063ba37fF917Ff0edEb9f4a';

const initialStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    price: '175.43',
    change24h: '+2.15',
    changePercent24h: '+1.24%',
    volume24h: '45,678,901',
    address: '0x9F89DeaaeFee69638E20bcb9c6B8Df94302c6c3D',
    market: 'US',
    exchange: 'NASDAQ',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    price: '245.67',
    change24h: '-5.23',
    changePercent24h: '-2.08%',
    volume24h: '23,456,789',
    address: '0x94fD50f8dE39d411f2ab3743B5Fa980b128A5D4E',
    market: 'US',
    exchange: 'NASDAQ',
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc',
    price: '135.89',
    change24h: '+1.45',
    changePercent24h: '+1.08%',
    volume24h: '12,345,678',
    address: '0x6F384d63b728E56243114090d267504e7f993C80',
    market: 'US',
    exchange: 'NASDAQ',
  },
  {
    symbol: 'Alibaba',
    name: 'Alibaba',
    price: '95.75',
    change24h: '-2.15',
    changePercent24h: '-2.20%',
    volume24h: '12,456,789',
    address: '0xF781f73f899c7E84f3ca4Ab0902046f09feF5bbA',
    market: 'HK',
    exchange: 'HKEX',
  },
];

const initialState: OrderBookState = {
  stocks: initialStocks,
  stocksLoading: false,
  stocksError: null,
  stockAddresses: Object.fromEntries(initialStocks.map((stock) => [stock.symbol, stock.address])),
  tradeServiceAddress: DEFAULT_TRADE_SERVICE_ADDRESS,
  usdtAddress: DEFAULT_USDT_ADDRESS,
};

const formatChange = (value: number, fractionDigits = 2) => {
  const fixed = value.toFixed(fractionDigits);
  return value >= 0 ? `+${fixed}` : fixed;
};

const recalculateStocks = (stocks: Stock[]): Stock[] => {
  return stocks.map((stock) => {
    const currentPrice = parseFloat(stock.price) || 1;
    const change = (Math.random() - 0.5) * 4; // +/-2 range
    const nextPrice = Math.max(0.01, currentPrice + change);
    const changePercent = currentPrice === 0 ? 0 : (change / currentPrice) * 100;

    return {
      ...stock,
      price: nextPrice.toFixed(2),
      change24h: formatChange(change),
      changePercent24h: `${formatChange(changePercent)}%`,
      high24h: (nextPrice * 1.02).toFixed(2),
      low24h: (nextPrice * 0.98).toFixed(2),
      timestamp: Date.now(),
    };
  });
};

export const fetchStockPrices = createAsyncThunk<Stock[], void, { state: RootState }>(
  'orderBook/fetchStockPrices',
  async (_, { getState }) => {
    const { stocks } = getState().orderBook;
    return recalculateStocks(stocks);
  }
);

const orderBookSlice = createSlice({
  name: 'orderBook',
  initialState,
  reducers: {
    setStocks(state, action: PayloadAction<Stock[]>) {
      state.stocks = action.payload;
      state.stockAddresses = Object.fromEntries(action.payload.map((stock) => [stock.symbol, stock.address]));
    },
    setTradeServiceAddress(state, action: PayloadAction<string>) {
      state.tradeServiceAddress = action.payload;
    },
    setUsdtAddress(state, action: PayloadAction<string>) {
      state.usdtAddress = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStockPrices.pending, (state) => {
        state.stocksLoading = true;
        state.stocksError = null;
      })
      .addCase(fetchStockPrices.fulfilled, (state, action) => {
        state.stocksLoading = false;
        state.stocks = action.payload;
        state.stockAddresses = Object.fromEntries(action.payload.map((stock) => [stock.symbol, stock.address]));
      })
      .addCase(fetchStockPrices.rejected, (state, action) => {
        state.stocksLoading = false;
        state.stocksError = action.error.message || 'Failed to fetch stock prices';
      });
  },
});

export const { setStocks, setTradeServiceAddress, setUsdtAddress } = orderBookSlice.actions;

export const selectOrderBookState = (state: RootState) => state.orderBook;
export const selectStocks = (state: RootState) => state.orderBook.stocks;
export const selectStockAddresses = (state: RootState) => state.orderBook.stockAddresses;
export const selectTradeServiceAddress = (state: RootState) => state.orderBook.tradeServiceAddress;
export const selectUsdtAddress = (state: RootState) => state.orderBook.usdtAddress;

export default orderBookSlice.reducer;
