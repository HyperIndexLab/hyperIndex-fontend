import { Currency, ETHER, Token } from 'hypherin-sdk';
import { useSelector } from 'react-redux';
import { selectTokens } from '../store/tokenListSlice';
import { useMemo } from 'react';
import { isAddress } from '@/utils';
import { useChainId, useReadContracts } from 'wagmi';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
] as const;

export function useAllTokens(): { [address: string]: Token } {
  const tokens = useSelector(selectTokens);
  
  return useMemo(() => 
    tokens.reduce<{ [address: string]: Token }>((acc, token) => {
      if (token.address) {
        acc[token.address] = new Token(
          1,
          token.address,
          token.decimals ? parseInt(token.decimals) : 18,
          token.symbol || 'UNKNOWN',
          token.name || 'Unknown Token'
        );
      }
      return acc;
    }, {})
  , [tokens]);
}

export function useToken(tokenAddress?: string): Token | undefined | null {
  const chainId = useChainId();
  const tokens = useAllTokens();
  const address = isAddress(tokenAddress);
  
  const cachedToken = address ? tokens[address] : undefined;

  const { data, isLoading } = useReadContracts({
    contracts: address ? [
      {
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      },
      {
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      },
      {
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }
    ] : [],
    query: {
      enabled: Boolean(address && !cachedToken),
    }
  });

  if (isLoading) return null;
  if (!chainId || !address || !data) return undefined;

  const [name, symbol, decimals] = data;

  return decimals?.result ? new Token(
    chainId,
    address,
    Number(decimals.result),
    (symbol?.result as string) || 'UNKNOWN',
    (name?.result as string) || 'Unknown Token'
  ) : undefined;
}

export function useCurrency(currencyId: string | undefined): Currency | null | undefined {
  const isETH = currencyId?.toUpperCase() === 'HSK';
  const token = useToken(isETH ? undefined : currencyId);
  return isETH ? ETHER : token;
}