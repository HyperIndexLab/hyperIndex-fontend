export const getApiBaseUrl = () => {
  return process.env.BUILD_ENV === 'test' 
    ? 'https://hashkeychain-testnet-explorer.alt.technology'
    : 'https://hashkey.blockscout.com';
}; 

export const getNewApiBaseUrl = () => {
  return process.env.BUILD_ENV === 'test' 
    ? 'https://hashkeychain-testnet-explorer.alt.technology'
    : 'https://hashkey.blockscout.com';
};

export const getMyApiBaseUrl = () => {
  return process.env.BUILD_ENV === 'test' 
    ? 'https://api.hyperindex.trade'
    : 'https://api.hyperindex.trade';
};