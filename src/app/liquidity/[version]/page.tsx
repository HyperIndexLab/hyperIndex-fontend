'use client';
import LiquidityContainerV3 from '@/components/LiquidityContainerV3';
import { useSearchParams } from 'next/navigation';

export default function LiquidityPage() {
  const searchParams = useSearchParams();

  // inputCurrency 为token1  传入address地址
  const inputCurrency = searchParams?.get('inputCurrency') ?? undefined;

  // outputCurrency 为token2  传入address地址
  const outputCurrency = searchParams?.get('outputCurrency') ?? undefined;

  // fee 为fee  传入fee 
  const fee = searchParams?.get('fee') ?? undefined;
  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <LiquidityContainerV3 token1={inputCurrency} token2={outputCurrency} fee={fee ? parseInt(fee) : undefined} />
    </main>
  );
} 