import { configureStore } from '@reduxjs/toolkit';
import tokenListReducer from './tokenListSlice';
import userTokensReducer from './userTokensSlice';
import orderBookReducer from './orderBookSlice';

const store = configureStore({
  reducer: {
    tokenList: tokenListReducer,
    userTokens: userTokensReducer,
    orderBook: orderBookReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; 
