import { configureStore } from '@reduxjs/toolkit';
import tokenListReducer from './tokenListSlice';
import userTokensReducer from './userTokensSlice';

const store = configureStore({
  reducer: {
    tokenList: tokenListReducer,
    userTokens: userTokensReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; 