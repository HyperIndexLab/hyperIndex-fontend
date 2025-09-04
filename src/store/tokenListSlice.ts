import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from './index';
import { getMyApiBaseUrl } from '../utils/getApiBaseUrl';
import { stHSK_DEL } from '@/constant/value';

// 定义token的类型
export interface Token {
  address: string;
  decimals: string | null;
  name: string | null;
  symbol: string | null;
  total_supply: string | null;
  type: string;
  icon_url: string | null;
  source_platform: string;
}

// State类型
interface TokenListState {
  items: Token[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

// 初始state
const initialState: TokenListState = {
  items: [],
  loading: false,
  error: null,
  lastUpdated: null
};

// 异步获取token列表
export const fetchTokenList = createAsyncThunk(
  'tokenList/fetch',
  async () => {
    try {
      const newBaseUrl = getMyApiBaseUrl();
      let allTokens: Token[] = [];
      let page = 1;
      const pageSize = 20;
      let hasMoreData = true;
      
      while (hasMoreData) {
        const response = await fetch(`${newBaseUrl}${TOKEN_PATH}?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // 过滤掉指定地址的token
        const filteredItems = data.items.filter((token: Token) => 
          token.address.toLowerCase() !== stHSK_DEL.toLowerCase()
        );
        allTokens = [...allTokens, ...filteredItems];
        
        // 检查是否还有更多数据
        if (data.items.length < pageSize || page * pageSize >= data.total) {
          hasMoreData = false;
        } else {
          page++;
        }
      }

      const jsonData = [
          {
              "token": {
                  "address": "0x60EFCa24B785391C6063ba37fF917Ff0edEb9f4a",
                  "circulating_market_cap": null,
                  "decimals": "6",
                  "exchange_rate": null,
                  "holders": "44",
                  "icon_url": null,
                  "name": "TEST USDT",
                  "symbol": "USDT",
                  "total_supply": "400001000001070280001000000",
                  "type": "ERC-20",
                  "volume_24h": null
              },
              "token_id": null,
              "token_instance": null,
              "value": "199999999999869498548041311"
          },
          {
              "token": {
                  "address": "0xB5876E245a48De8df9E3C9Bd2CD55996965eBfad",
                  "circulating_market_cap": null,
                  "decimals": "18",
                  "exchange_rate": null,
                  "holders": "5",
                  "icon_url": null,
                  "name": "StableSwap Pool (TEST DAI, TEST USDT)",
                  "symbol": "StableSwap LP: DAI-USDT",
                  "total_supply": "212349247690394177328770006",
                  "type": "ERC-20",
                  "volume_24h": null
              },
              "token_id": null,
              "token_instance": null,
              "value": "85783643057545127056170477"
          },
          {
              "token": {
                  "address": "0x15f95a11537e17024b25F5F5377c8bc03562e310",
                  "circulating_market_cap": null,
                  "decimals": "18",
                  "exchange_rate": null,
                  "holders": "4",
                  "icon_url": null,
                  "name": "StableSwap Pool (TEST HongKong Dollar A, TEST HongKong Dollar B)",
                  "symbol": "StableSwap LP: HKDA-HKDB",
                  "total_supply": "58700490534227185219425802",
                  "type": "ERC-20",
                  "volume_24h": null
              },
              "token_id": null,
              "token_instance": null,
              "value": "28764995805968466573835570"
          },
          {
              "token": {
                  "address": "0xE8bbE0E706EbDaB3Be224edf2FE6fFff16df1AC1",
                  "circulating_market_cap": null,
                  "decimals": "18",
                  "exchange_rate": null,
                  "holders": "11",
                  "icon_url": null,
                  "name": "TEST HongKong Dollar A",
                  "symbol": "HKDA",
                  "total_supply": "1050000000000050000000000000",
                  "type": "ERC-20",
                  "volume_24h": null
              },
              "token_id": null,
              "token_instance": null,
              "value": "18968271712540045741956482"
          },
          {
              "token": {
                  "address": "0x779CA066b69F4B39cD77bA1a1C4d3c5c097A441e",
                  "circulating_market_cap": null,
                  "decimals": "18",
                  "exchange_rate": null,
                  "holders": "8",
                  "icon_url": null,
                  "name": "TEST HongKong Dollar B",
                  "symbol": "HKDB",
                  "total_supply": "1050000000000000000000000000",
                  "type": "ERC-20",
                  "volume_24h": null
              },
              "token_id": null,
              "token_instance": null,
          },
      ];


      if (process.env.BUILD_ENV === 'test') {
        // 提取所有 ERC-20 类型的 token
        const erc20Tokens = jsonData
            .filter((item: { token: { type: string } }) => item.token.type === 'ERC-20')
          .map((item: { token: any }) => item.token);

        // 将提取出的 token 添加到 allTokens
        allTokens = [...allTokens, ...erc20Tokens];
      }

      return allTokens;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取token列表失败');
    }
  }
);

const TOKEN_PATH =  process.env.BUILD_ENV === 'test'  ?  '/api/tokenlist/test-tokenlist' : '/api/tokenlist'

// 添加手动刷新action
export const refreshTokenList = createAsyncThunk(
  'tokenList/refresh',
  async () => {
    const newBaseUrl = getMyApiBaseUrl();
    let allTokens: Token[] = [];
    let page = 1;
    const pageSize = 20;
    let hasMoreData = true;
    
    while (hasMoreData) {
      const response = await fetch(`${newBaseUrl}${TOKEN_PATH}?page=${page}&pageSize=${pageSize}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // 过滤掉指定地址的token
      const filteredItems = data.items.filter((token: Token) => 
        token.address.toLowerCase() !== stHSK_DEL.toLowerCase()
      );

      
      allTokens = [...allTokens, ...filteredItems];
      
      // 检查是否还有更多数据
      if (data.items.length < pageSize || page * pageSize >= data.total) {
        hasMoreData = false;
      } else {
        page++;
      }
    }
    
    return allTokens;
  }
);

// Slice
const tokenListSlice = createSlice({
  name: 'tokenList',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTokenList.pending, (state) => {
        if (!state.lastUpdated) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchTokenList.fulfilled, (state, action) => {
        const filteredTokens = action.payload.filter((token: Token) => 
          token.name !== null && token.type === 'ERC-20'
        ).map((token: Token) => {
          // 替换特定的 icon_url
          let iconUrl = token.icon_url;
          if (iconUrl === 'https://hyperindex.4everland.store/tether-usdt.png') {
            iconUrl = '/img/tether-usdt-logo.png';
          }
          
          // 为USDC.e和WETH设置默认本地图标
          if ((token.symbol === 'USDC.e' || token.symbol === 'WETH') && !iconUrl) {
            iconUrl = `/img/${token.symbol.toLowerCase()}.svg`;
          }
          
            return {
              ...token,
            icon_url: iconUrl
            };
        });
        
        // 对tokens进行排序，将USDT、USDC、WETH排在前面
        state.items = filteredTokens.sort((a: Token, b: Token) => {
          const prioritySymbols = ['USDT', 'USDC.e', 'WETH'];
          const aIndex = prioritySymbols.indexOf(a.symbol || '');
          const bIndex = prioritySymbols.indexOf(b.symbol || '');
          
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return 0;
        });
        
        state.loading = false;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchTokenList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? '未知错误';
      })
      .addCase(refreshTokenList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshTokenList.fulfilled, (state, action) => {
        const filteredTokens = action.payload.filter((token: Token) => 
          token.name !== null && token.type === 'ERC-20'
        ).map((token: Token) => {
          // 替换特定的 icon_url
          let iconUrl = token.icon_url;
          if (iconUrl === 'https://hyperindex.4everland.store/tether-usdt.png') {
            iconUrl = '/img/tether-usdt-logo.png';
          }
          
          // 为USDC.e和WETH设置默认本地图标
          if ((token.symbol === 'USDC.e' || token.symbol === 'WETH') && !iconUrl) {
            iconUrl = `/img/${token.symbol.toLowerCase()}.svg`;
          }
          
            return {
              ...token,
            icon_url: iconUrl
            };
        });
        
        // 对tokens进行排序，将USDT、USDC、WETH排在前面
        state.items = filteredTokens.sort((a: Token, b: Token) => {
          const prioritySymbols = ['USDT', 'USDC.e', 'WETH'];
          const aIndex = prioritySymbols.indexOf(a.symbol || '');
          const bIndex = prioritySymbols.indexOf(b.symbol || '');
          
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return 0;
        });
        
        state.loading = false;
        state.lastUpdated = Date.now();
      });
  },
});

// 选择器
export const selectTokens = (state: RootState) => state.tokenList.items;
export const selectTokensLoading = (state: RootState) => state.tokenList.loading;
export const selectTokensError = (state: RootState) => state.tokenList.error;

export default tokenListSlice.reducer; 