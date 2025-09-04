export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  icon_url: string | null;
  balance?: string;
  decimals?: string | null;
}

export interface PoolInfo {
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  pairAddress?: string;
} 