'use client';
import LiquidityContainer from '@/components/LiquidityContainer';
import { useSearchParams } from 'next/navigation';

export default function LiquidityPage() {
  const searchParams = useSearchParams();

  // inputCurrency 为token1  传入address地址
  const inputCurrency = searchParams?.get('inputCurrency') ?? undefined;

  // outputCurrency 为token2  传入address地址
  const outputCurrency = searchParams?.get('outputCurrency') ?? undefined;
  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <LiquidityContainer token1={inputCurrency} token2={outputCurrency} />
    </main>
  );
} 