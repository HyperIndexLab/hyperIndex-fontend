'use client'

import { getPoolDetail, getPoolPriceData, getPoolPriceHistory, getPools, getPoolSwaps, Pool, PoolPriceData } from '@/request/explore';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {  isAddress } from 'viem';
import { formatNumber, formatNumberToUnit } from '@/utils';
import Link from 'next/link';
import Image from 'next/image';
import Chart from '@/components/Chart';
import dayjs from 'dayjs';
import { useSelector, useDispatch } from 'react-redux';
import { selectTokens, fetchTokenList } from '@/store/tokenListSlice';
import { TokenData } from '@/types/liquidity';
// import SwapContainer from '@/components/SwapContainer';
import { PAIR_ABI } from '@/constant/ABI/HyperIndexPair';
import { formatTokenBalance } from '@/utils/formatTokenBalance';
import { wagmiConfig } from '@/components/RainbowKitProvider';
import { readContract } from 'wagmi/actions';
import { getNewApiBaseUrl } from '@/utils/getApiBaseUrl';
import SwapContainerV3 from '@/components/SwapContainerV3';

interface PoolWithTokens extends Pool {
	token0Info: TokenData;
	token1Info: TokenData;
}

interface Swap {
	timestamp: string;
	type: string;
	amount0: string;
	amount1: string;
	sender: string;
}

export default function Page() {
	const tokens = useSelector(selectTokens);
	const dispatch = useDispatch();
	const { hash } = useParams() || {};
	const [loading, setLoading] = useState(true);
	const [poolData, setPoolData] = useState<Pool[]>([]);
	const [pool, setPool] = useState<PoolWithTokens | null>(null);
	const [showSwap, setShowSwap] = useState(false);
	const [poolPriceData, setPoolPriceData] = useState<PoolPriceData[]>([]);
	const [isReversed, setIsReversed] = useState(false);
	const [reserves, setReserves] = useState<string[]>([]);
	const [isV3, setIsV3] = useState(false);
	const [swaps, setSwaps] = useState<Swap[]>([]);

	const fetchPools = async () => {
		setLoading(true)
		const pools = await getPools()
		try {
			
			const poolDetail = await getPoolDetail(hash as string)

			if (poolDetail) {
				setIsV3(true)
				setPoolData([poolDetail])
			} else {
				setPoolData(pools)
			}
		} catch (error) {
			setPoolData(pools)
		} finally {
			setLoading(false)
		}
	}

	const fetchPoolPriceData = useCallback(async (num: number) => {
		const poolPriceData = await getPoolPriceData(hash as string, num)
		setPoolPriceData(poolPriceData)
	}, [hash])

	const fetchPoolPriceHistory = useCallback(async (num: 7 | 30) => {
		const poolPriceHistory = await getPoolPriceHistory(hash as string, num)
		setPoolPriceData(poolPriceHistory)
	}, [hash])

	const fetchPoolSwaps = useCallback(async () => {
		try {
			const swapsData = await getPoolSwaps(hash as string);
			setSwaps(swapsData.map(swap => ({
				...swap,
				type: parseFloat(swap.amount1) > 0 ? 'buy' : 'sell'
			})));
		} catch (error) {
			console.error('获取交易记录失败:', error);
		}
	}, [hash]);

	useEffect(() => {
		fetchPools()
	}, [hash])

	useEffect(() => {
		if (isV3) {
			fetchPoolSwaps()
		}
	}, [isV3, fetchPoolSwaps])


	useEffect(() => {
		if (isV3) {
			fetchPoolPriceHistory(7)
		} else {
			fetchPoolPriceData(1)
		}
	}, [fetchPoolPriceData, fetchPoolPriceHistory, isV3])

	useEffect(() => {
		dispatch(fetchTokenList() as any);
	}, [ dispatch]);

	useEffect(() => {
		const reserves = async () => {
			const reserves = await readContract(wagmiConfig, {
				address: hash as `0x${string}`,
				abi: PAIR_ABI,
				functionName: 'getReserves',
				args: [],
			}) as [bigint, bigint]
			
			// 格式化reserves以显示 - 使用对应代币的小数位数
			const formattedReserves = [
				formatTokenBalance(reserves[0].toString(), pool?.token0Info?.decimals || '18'),
				formatTokenBalance(reserves[1].toString(), pool?.token1Info?.decimals || '18')
			];
			
			setReserves(formattedReserves)
		}
		
		if (pool && hash) {
			reserves()
		}
	}, [hash, pool])

	useEffect(() => {
		console.log('poolData===2', poolData)
		const pool = poolData.find((pool) => pool.pairsAddress === hash);
		
		if (pool && tokens.length > 0) {
			// 从tokens中查找对应的代币信息
			const token0Info = tokens.find(token => token.address.toLowerCase() === pool.token0.toLowerCase());
			const token1Info = tokens.find(token => token.address.toLowerCase() === pool.token1.toLowerCase());
			
		
			setPool({
				...pool,
				token0Info: token0Info ? token0Info as TokenData : {
					address: pool.token0,
					symbol: pool.pairsName?.split('/')[0] || '',
					icon_url: "https://hyperindex.4everland.store/index-coin.jpg"
				} as TokenData,
				token1Info: token1Info ? token1Info as TokenData : {
					address: pool.token1,
					symbol: pool.pairsName?.split('/')[1] || '',
					icon_url: "https://hyperindex.4everland.store/index-coin.jpg"
				} as TokenData
			});
		}
	}, [hash, poolData, tokens]);

	const handleRangeChange = async (range: '1d' | '1w') => {
		switch (range) {
			case '1d':
				await fetchPoolPriceData(1);
				break;
			case '1w':	
				await fetchPoolPriceData(7);
				break;
		}
	}


	return (
		isAddress(hash as string) ? (
			<div className="flex justify-center min-h-screen pt-14">
				<div className="container mx-auto px-4 flex flex-col md:flex-row gap-6">
					<div className='card flex-1 h-fit'>
						{/* Chart Card */}
						<div className="card bg-base-100 p-6 h-fit">
							{/* 代币对信息 */}
							<div className='flex items-center gap-4 mb-6'>
								{loading ? (
									<>
										<div className="flex -space-x-3">
											<div className="w-12 h-12 rounded-full bg-base-300 animate-pulse"></div>
											<div className="w-12 h-12 rounded-full bg-base-300 animate-pulse"></div>
										</div>
										<div className="h-8 w-48 bg-base-300 rounded animate-pulse"></div>
									</>
								) : (
									<>
										<div className="flex -space-x-3">
											<div className="avatar">
												<div className="w-12 h-12 rounded-full ring-2 ring-base-100">
													<Image src={pool?.token0Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
															alt={pool?.token0Info?.symbol || pool?.pairsName?.split('/')[0] || ''} 
															width={48} height={48} 
															unoptimized />
												</div>
											</div>
											<div className="avatar">
												<div className="w-12 h-12 rounded-full ring-2 ring-base-100">
													<Image src={pool?.token1Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
															alt={pool?.pairsName?.split('/')[1] || ''} 
															width={48} height={48} 
															unoptimized />
												</div>
											</div>
										</div>
										<div className='text-2xl font-bold'>
											{pool?.pairsName ? `${pool.pairsName.split('/')[0]} / ${pool.pairsName.split('/')[1]}` : ''}
										</div>
										<button 
											className="btn btn-circle btn-sm"
											onClick={() => setIsReversed(!isReversed)}
										>
											<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
											</svg>
										</button>
										<div className="dropdown dropdown-end absolute right-7">
											<button className="btn btn-circle btn-sm" onClick={(e) => e.stopPropagation()}>
												<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</button>
											<div tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-72 left-1/2 -translate-x-1/2 mt-2">
												<div className="p-2">
													<a 
														href={`${getNewApiBaseUrl()}/address/${hash}`} 
														target="_blank" 
														rel="noopener noreferrer"
														className="block mb-2 hover:bg-base-300 p-2 rounded-lg transition-colors flex justify-between"
													>
														<div className="flex items-center gap-2">
															<div className="avatar">
																<div className="w-4 h-4 rounded-full">
																	<Image src={pool?.token0Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
																		alt={pool?.token0Info?.symbol || ''} 
																		width={16} height={16} 
																		unoptimized />
																</div>
																<div className="avatar">
																	<div className="w-4 h-4 rounded-full">
																		<Image src={pool?.token1Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
																			alt={pool?.token1Info?.symbol || ''} 
																			width={16} height={16} 
																			unoptimized />
																	</div>
																</div>
															</div>
															<div className="text-sm opacity-70">Pool</div>
															<div className="flex items-center gap-2">
																<div className="text-sm">
																	{(hash as string).substring(0, 6)}...{(hash as string).substring((hash as string).length - 4)}
																</div>
															</div>
														</div>
														<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
														</svg>
													</a>
													<a 
														href={`${getNewApiBaseUrl()}/token/${pool?.token0}`} 
														target="_blank"
														rel="noopener noreferrer"
														className="block mb-2 hover:bg-base-300 p-2 rounded-lg transition-colors flex justify-between items-center"
													>
														<div className="flex items-center gap-2">
															<div className="avatar">
																<div className="w-4 h-4 rounded-full">
																	<Image src={pool?.token0Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
																		alt={pool?.token0Info?.symbol || ''} 
																		width={16} height={16} 
																		unoptimized />
																</div>
															</div>
															<div className="text-sm opacity-70">{pool?.token0Info?.symbol}</div>
															<div className="text-sm">
																{pool?.token0?.substring(0, 6)}...{pool?.token0?.substring((pool?.token0?.length || 0) - 4)}
															</div>
														</div>
														<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
														</svg>
													</a>
													<a 
														href={`${getNewApiBaseUrl()}/token/${pool?.token1}`} 
														target="_blank" 
														rel="noopener noreferrer"
														className="block hover:bg-base-300 p-2 rounded-lg transition-colors flex justify-between items-center"
													>
														<div className="flex items-center gap-2">
															<div className="avatar">
																<div className="w-4 h-4 rounded-full">
																	<Image src={pool?.token1Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
																		alt={pool?.token1Info?.symbol || ''} 
																		width={16} height={16} 
																		unoptimized />
																</div>
															</div>
															<div className="text-sm opacity-70">{pool?.token1Info?.symbol}</div>
															<div className="text-sm">
																{pool?.token1?.substring(0, 6)}...{pool?.token1?.substring((pool?.token1?.length || 0) - 4)}
															</div>
														
														</div>
														<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
														</svg>
													</a>
												</div>
											</div>
										</div>
									</>
								)}
							</div>

							{/* Chart区域骨架屏 */}
							{loading ? (
								<div className="w-full h-[400px] bg-base-300 rounded-lg animate-pulse"></div>
							) : (
								<>
									<Chart 
										token0={isReversed ? poolPriceData[0]?.token0Symbol : poolPriceData[0]?.token1Symbol || ''} 
										token1={isReversed ? poolPriceData[0]?.token1Symbol : poolPriceData[0]?.token0Symbol || ''} 
										data={poolPriceData
											.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
											.map((item) => ({
												time: dayjs(item.timestamp).format('MM-DD HH:mm'),
												price: isReversed ? 
													Number(parseFloat(item.token1VsToken0).toFixed(6)) : 
													Number(parseFloat(item.token0VsToken1).toFixed(4))
											}))} 
										type="pool" 
										onRangeChange={handleRangeChange}
									/>
								</>
							)}
						</div>
						{/* 添加交易记录列表 */}
						<div className="card bg-base-100 py-6 px-3 mt-6">
							<h2 className="text-xl font-bold mb-4 ml-2">Transaction</h2>
							<div className="overflow-x-auto">
								<table className="table w-full">
									<thead>
										<tr>
											<th>Time</th>
											<th>Type</th>
											<th>{pool?.token0Info?.symbol || 'Token0'}</th>
											<th>{pool?.token1Info?.symbol || 'Token1'}</th>
											<th>Wallet Address</th>
										</tr>
									</thead>
									<tbody>
										{swaps.map((swap, index) => (
											<tr key={index}>
												<td>{dayjs(swap.timestamp).format('YYYY-MM-DD HH:mm:ss')}</td>
												<td>
													<span className={parseFloat(swap.amount1) > 0 ? 'text-success' : 'text-error'}>
														{parseFloat(swap.amount1) > 0 ? `Buy ${pool?.token1Info?.symbol}` : `Sell ${pool?.token1Info?.symbol}`}
													</span>
												</td>
												<td>{formatNumberToUnit(Math.abs(parseFloat(swap.amount0)))} {pool?.token0Info?.symbol}</td>
												<td>{formatNumberToUnit(Math.abs(parseFloat(swap.amount1)))} {pool?.token1Info?.symbol}</td>
												<td>
													<a 
														href={`${getNewApiBaseUrl()}/address/${swap.sender}`}
														target="_blank"
														rel="noopener noreferrer"
														className="link link-primary"
													>
														{`${swap.sender.substring(0, 6)}...${swap.sender.substring(swap.sender.length - 4)}`}
													</a>
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{swaps.length === 0 && (
									<div className="text-center py-4 text-gray-500">
										No transaction records
									</div>
								)}
							</div>
						</div>
					</div>
					{/* 池子信息卡片 */}
					<div className="card bg-base-100 w-[500px] shadow-xl p-6 h-fit">
						{/* Swap按钮骨架屏 */}
						{loading ? (
							<div className="flex justify-center items-center gap-4">
								<div className="h-12 w-32 bg-base-300 rounded-full animate-pulse"></div>
								<div className="h-12 w-32 bg-base-300 rounded-full animate-pulse"></div>
							</div>
						) : (
							<>
								<div className="text-center flex justify-between items-center gap-4">
									<button 
										className='btn btn-primary flex-1 rounded-lg px-8 font-semibold'
										onClick={() => setShowSwap(!showSwap)}
									>
										Swap Tokens
									</button>
									<Link href={isV3 ? `/liquidity/v3?inputCurrency=${pool?.token0}&outputCurrency=${pool?.token1}`  :`/liquidity?inputCurrency=${pool?.token0}&outputCurrency=${pool?.token1}`} className='btn flex-1 btn-primary rounded-lg px-8 font-semibold'>
										Add Liquidity
									</Link>
								</div>
								
								<div className={`mt-6 transition-all duration-300 ease-in-out ${showSwap ? 'opacity-100' : 'opacity-0 max-h-0 overflow-hidden'}`}>
									{/* <SwapContainer token1={pool?.token0} token2={pool?.token1} /> */}
									<SwapContainerV3 token1={pool?.token0} token2={pool?.token1} />
								</div>
							</>
						)}

						{/* 池子数据网格骨架屏 */}
						<div className="grid grid-cols-1 gap-4 my-6">
							{loading ? (
								<>
									{[1, 2, 3, 4].map((item) => (
										<div key={item} className="stat bg-base-200 rounded-box p-4">
											<div className="h-4 w-16 bg-base-300 rounded animate-pulse mb-2"></div>
											<div className="h-6 w-24 bg-base-300 rounded animate-pulse"></div>
										</div>
									))}
								</>
							) : (
								<>
									<div className="stat bg-base-200 rounded-box p-4">
										<div className="stat-title text-sm mb-4">Pool Balance</div>
										<div className="flex justify-between items-center mb-4">
											<div className="flex items-center gap-2">
												<div className="avatar">
													<div className="w-6 h-6 rounded-full">
														<Image src={pool?.token0Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
															  alt={pool?.token0Info?.symbol || ''} 
															  width={24} height={24} 
															  unoptimized />
													</div>
												</div>
												{pool?.totalValueLockedToken0 && pool?.totalValueLockedToken1 ? (
													<span>{formatNumberToUnit(parseFloat(pool?.totalValueLockedToken0))} {pool?.token0Info?.symbol}</span>
												) : (
													<span>{reserves.length > 0 ? formatNumberToUnit(parseFloat(reserves[0])) : 0} {pool?.token0Info?.symbol}</span>
												)}
											</div>
											<div className="flex items-center gap-2">
												<div className="avatar">
													<div className="w-6 h-6 rounded-full">
														<Image src={pool?.token1Info?.icon_url || "https://hyperindex.4everland.store/index-coin.jpg"} 
															  alt={pool?.token1Info?.symbol || ''} 
															  width={24} height={24} 
															  unoptimized />
													</div>
												</div>
												{pool?.totalValueLockedToken0 && pool?.totalValueLockedToken1 ? (
													<span>{formatNumberToUnit(parseFloat(pool?.totalValueLockedToken1))} {pool?.token1Info?.symbol}</span>
												) : (
													<span>{reserves.length > 0 ? formatNumberToUnit(parseFloat(reserves[1])) : 0} {pool?.token1Info?.symbol}</span>
												)}
											</div>
										</div>
										<div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
											{pool?.totalValueLockedToken0 && pool?.totalValueLockedToken1 ? (
												
												<div className="h-full flex">
												<div className="bg-primary" 
													style={{ width: `${pool ? ( Number(pool?.totalValueLockedToken0) / (Number(pool?.totalValueLockedToken0) + Number(pool?.totalValueLockedToken1)) * 100) : 50}%` }}
												></div>
													<div 
													className="bg-secondary" 
													style={{ width: `${pool ? (Number(pool?.totalValueLockedToken1) / (Number(pool?.totalValueLockedToken0) + Number(pool?.totalValueLockedToken1)) * 100) : 50}%` }}
													></div>
												</div>
											) : (
												<div className="h-full flex">
													<div 
														className="bg-primary" 
													style={{ width: `${pool ? ( Number(reserves[0]) / (Number(reserves[0]) + Number(reserves[1])) * 100) : 50}%` }}
												></div>
												<div 
													className="bg-secondary" 
													style={{ width: `${pool ? (Number(reserves[1]) / (Number(reserves[0]) + Number(reserves[1])) * 100) : 50}%` }}
												></div>
												</div>
											)}
										</div>
									</div>
									<div className="stat bg-base-200 rounded-box p-4">
										<div className="stat-title text-sm">APY</div>
										<div className={`stat-value text-xl ${Number(pool?.APY) >= 0 ? 'text-success' : 'text-error'}`}>
											{formatNumber(pool?.APY || 0, 3)}%
										</div>
									</div>
									<div className="stat bg-base-200 rounded-box p-4">
										<div className="stat-title text-sm">TVL</div>
										<div className="stat-value text-xl">{pool?.TVL}</div>
									</div>
									<div className="stat bg-base-200 rounded-box p-4">
										<div className="stat-title text-sm">24h Volume</div>
										<div className="stat-value text-xl">{pool?.tradingVolume1D}</div>
									</div>
									<div className="stat bg-base-200 rounded-box p-4">
										<div className="stat-title text-sm">30D Volume</div>
										<div className="stat-value text-xl">{pool?.tradingVolume30D}</div>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		) : (
			<div className="flex justify-center items-center min-h-screen">
				<div className="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span>Invalid pool address</span>
				</div>
			</div>
		)
	)
}


