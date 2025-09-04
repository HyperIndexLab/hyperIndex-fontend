import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from './index';
import { getApiBaseUrl } from '../utils/getApiBaseUrl';

// 定义token的类型
interface Token {
  address: string;
  decimals: string | null;
  name: string | null;
  symbol: string | null;
  type: string;
  icon_url: string | null;
  source_platform: string;
}

// 定义用户token的类型
export interface UserToken {
  token: Token;
  token_id: string | null;
  token_instance: Record<string, unknown> | null;
  value: string;
}

// State类型
interface UserTokensState {
  items: UserToken[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

// 初始state
const initialState: UserTokensState = {
  items: [],
  loading: false,
  error: null,
  lastUpdated: null
};

// 异步获取用户token列表
export const fetchUserTokens = createAsyncThunk(
  'userTokens/fetch',
  async (address: string) => {
    try {
      // 先获取HSK余额
      const baseUrl = getApiBaseUrl();
      const balanceResponse = await fetch(`${baseUrl}/api/v2/addresses/${address}`);
      if (!balanceResponse.ok) {
        throw new Error(`HTTP error! status: ${balanceResponse.status}`);
      }
      const balanceData = await balanceResponse.json();
      
      // 获取其他token
      const response = await fetch(`${baseUrl}/api/v2/addresses/${address}/tokens`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // 构造HSK token数据
      const hskToken = {
        token: {
          address: "0x0000000000000000000000000000000000000000",
          decimals: "18",
          name: "HashKey Chain",
          symbol: "HSK",
          type: "NATIVE",
          icon_url: "/img/HSK-LOGO.png",
        },
        token_id: null,
        token_instance: null,
        value: balanceData.coin_balance || "0",
      };

      // 处理其他token的icon_url
      const processedItems = (data.items || []).map((item: UserToken) => {
        // 替换特定的 icon_url
        let iconUrl = item.token.icon_url;
        if (iconUrl === 'https://hyperindex.4everland.store/tether-usdt.png') {
          iconUrl = '/img/tether-usdt-logo.png';
        }
        
        return {
          ...item,
          token: {
            ...item.token,
            // @ts-ignore 忽略类型错误 因为token.address_hash是string类型  hashkey的接口变了
            address: item.token.address_hash,
            icon_url: iconUrl
          }
        };
      });

      // 将HSK放在列表第一位
      return [hskToken, ...processedItems];
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  }
);

// 添加手动刷新action
export const refreshUserTokens = createAsyncThunk(
  'userTokens/refresh',
  async (address: string) => {
    try {
      // 先获取HSK余额
      const baseUrl = getApiBaseUrl();
      const balanceResponse = await fetch(`${baseUrl}/api/v2/addresses/${address}`);
      if (!balanceResponse.ok) {
        throw new Error(`HTTP error! status: ${balanceResponse.status}`);
      }
      const balanceData = await balanceResponse.json();
      
      // 获取其他token
      const response = await fetch(`${baseUrl}/api/v2/addresses/${address}/tokens`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // 构造HSK token数据
      const hskToken = {
        token: {
          address: "0x0000000000000000000000000000000000000000",
          decimals: "18",
          name: "HashKey Chain",
          symbol: "HSK",
          type: "NATIVE",
          icon_url: "/img/HSK-LOGO.png",
        },
        token_id: null,
        token_instance: null,
        value: balanceData.coin_balance || "0",
      };

      // 处理其他token的icon_url
      const processedItems = (data.items || []).map((item: UserToken) => {
        // 替换特定的 icon_url
        let iconUrl = item.token.icon_url;
        if (iconUrl === 'https://hyperindex.4everland.store/tether-usdt.png') {
          iconUrl = '/img/tether-usdt-logo.png';
        }
        
        return {
          ...item,
          token: {
            ...item.token,
            icon_url: iconUrl
          }
        };
      });

      // 将HSK放在列表第一位
      return [hskToken, ...processedItems];
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  }
);

// Slice
const userTokensSlice = createSlice({
  name: 'userTokens',
  initialState,
  reducers: {
    clearUserTokens: (state) => {
      state.items = [];
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserTokens.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserTokens.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchUserTokens.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? '未知错误';
      })
      .addCase(refreshUserTokens.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshUserTokens.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
        state.lastUpdated = Date.now();
      })
      .addCase(refreshUserTokens.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? '未知错误';
      });
  },
});

// 选择器
export const selectUserTokens = (state: RootState) => state.userTokens.items;
export const selectUserTokensLoading = (state: RootState) => state.userTokens.loading;
export const selectUserTokensError = (state: RootState) => state.userTokens.error;

// 导出actions
export const { clearUserTokens } = userTokensSlice.actions;

export default userTokensSlice.reducer; 