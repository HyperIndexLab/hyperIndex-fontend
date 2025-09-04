import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import CopyAddress from './copyAddress';
import Image from 'next/image';
import {  selectTokens } from '@/store/tokenListSlice';
import { useDispatch, useSelector } from 'react-redux';
import TabToken, { TokenTab } from './Personal/TabToken';
import { fetchUserTokens, selectUserTokens } from '@/store/userTokensSlice';
import { AppDispatch } from '@/store';
import { getTokens, Token } from '@/request/explore';
import { formatTokenBalance } from '@/utils/formatTokenBalance';
import TabPool from './Personal/TabPool';
import BigNumber from 'bignumber.js';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { ArrowDownCircleIcon, BuildingLibraryIcon } from '@heroicons/react/24/solid';

export interface TokenBalance {
  address: string;
  balance: string;
}

// CEX列表数据
const CEX_LIST = [
  { name: 'HashKey Global', icon: 'https://hyperindex.4everland.store/hashkey.jpeg', link: 'https://global.hashkey.com/en-US/spot/HSK_USDT' },
  { name: 'Gate.io', icon: 'https://hyperindex.4everland.store/gate.png', link: 'https://www.gate.io/trade/HSK_USDT' },
  { name: 'KuCoin', icon: 'https://hyperindex.4everland.store/kucoin.png', link: 'https://www.kucoin.com/trade/HSK-USDT' },
  { name: 'BitKan', icon: 'https://hyperindex.4everland.store/bitkan.png', link: 'https://bitkan.com/zh/trade/HSK-USDT' },
  { name: 'MEXC', icon: 'https://hyperindex.4everland.store/mexc.png', link: 'https://www.mexc.com/exchange/HSK_USDT?_from=search' },
];

// 骨架屏组件
const TokenSkeleton = () => (
  <div className="animate-pulse space-y-4">
    {/* 代币项骨架 */}
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between p-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/[0.08]" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/[0.08] rounded" />
            <div className="h-3 w-16 bg-white/[0.08] rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 bg-white/[0.08] rounded" />
          <div className="h-3 w-12 bg-white/[0.08] rounded" />
        </div>
      </div>
    ))}
  </div>
);

export default function Personal({ isOpen, setOpen }: { isOpen: boolean, setOpen: (open: boolean) => void }) {
  const { address, connector } = useAccount();
	const { disconnect } = useDisconnect();
	const [connectorName, setConnectorName] = useState('');
	const tokens = useSelector(selectTokens);
	const userTokens = useSelector(selectUserTokens);
	const [activeTab, setActiveTab] = useState('token');
	const dispatch = useDispatch<AppDispatch>();
	const [tokenData, setTokenData] = useState<Token[]>([]);
	const [totalBalance, setTotalBalance] = useState<string>('0');
	const [tokenBalances, setTokenBalances] = useState<TokenTab[]>([]);
	const [isLoading, setIsLoading] = useState(true);
  // 新增状态用于控制弹窗显示
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

	const logout = () => {
		disconnect();
		setOpen(false);
	}

	useEffect(() => {
    if (address) {
      setIsLoading(true);
      dispatch(fetchUserTokens(address));
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  }, [address, dispatch, tokens.length, userTokens.length]);

	// connector?.name 需要转换
	useEffect(() => {
		if (connector?.name) {
			const name = connector?.name.toLowerCase();
			if (name === 'metamask') {
				setConnectorName('metamask');
			} else if (name === 'okx wallet') {
				setConnectorName('okx');
			} else if (name === 'particle wallet') {
				setConnectorName('particle');
			} else {
				setConnectorName(name);
			}
		}
	}, [connector?.name]);


	useEffect(() => {
		fetchTokens()
	}, [])

	const fetchTokens = async () => {
    try {
			const tokens = await getTokens()
			setTokenData(tokens)
    } catch (error) {
      console.error('Failed to fetch token list:', error)
    }
  }

	useEffect(() => {
		if (tokenData.length > 0 && userTokens.length > 0) {
			let totalBalance = BigNumber(0);
			const newTokenBalances: TokenTab[] = [];

			userTokens.forEach(token => {
				const balance = formatTokenBalance(token.value, token.token.decimals);
				
				// 特殊处理HSK和WHSK价格
				let tokenBalance;
				let price = '0';
				let icon_url = '';
				
				if (token.token.symbol?.toUpperCase() === 'HSK') {
					// 如果是HSK，查找WHSK的价格
					tokenBalance = tokenData.find(t => t.symbol?.toUpperCase() === 'WHSK');
					price = tokenBalance?.price.replace('$', '') || '0';
					// HSK使用WHSK的图标
					icon_url = tokenBalance?.icon_url || '/img/HSK-LOGO.png';
				} else {
					tokenBalance = tokenData.find(t => t.address === token.token.address);
					price = tokenBalance?.price.replace('$', '') || '0';
					icon_url = tokenBalance?.icon_url || '';
				}
				
				// 特殊处理常见代币图标
				const symbol = token.token.symbol?.toLowerCase();
				if (!icon_url && symbol) {
					const iconMap: Record<string, string> = {
						'usdt': '/img/usdt.svg',
						'whsk': '/img/HSK-LOGO.png',
						'weth': '/img/weth.svg',
						'usdc.e': '/img/usdc.e.svg',
						'hsk': '/img/HSK-LOGO.png'
					};
					
					icon_url = iconMap[symbol] || '';
				}
				
				if (tokenBalance) {
					const priceValue = parseFloat(price);
					totalBalance = BigNumber(totalBalance).plus(BigNumber(balance).multipliedBy(priceValue));
				}

				newTokenBalances.push({
					price,
					token: {
            ...token.token,
            icon_url: icon_url
          },
          token_id: token.token.address,
          token_instance: null,
          value: token.value
				});
			});

			
			setTotalBalance(totalBalance.toString());
			setTokenBalances(newTokenBalances);
			setIsLoading(false);
		}
	}, [setTotalBalance, tokenData, tokenData.length, userTokens, userTokens.length])

  // 格式化余额，分离整数和小数部分
  const formatBalanceWithDecimals = (balance: string) => {
    // 转为数字
    const num = parseFloat(balance);
    
    // 判断是否为0（或接近0）
    const isZero = Math.abs(num) < 0.000001;
    
    // 如果是0，显示2位小数，否则显示6位小数
    const decimalPlaces = isZero ? 2 : 6;
    const formattedNum = num.toFixed(decimalPlaces);
    
    // 分离整数和小数部分
    const parts = formattedNum.split('.');
    
    // 处理小数部分，移除末尾的0，但如果是0值，保留2位小数
    let decimal = parts.length > 1 ? parts[1] : '';
    
    // 如果不是0值，移除末尾的0
    if (!isZero) {
      while (decimal.length > 0 && decimal.endsWith('0')) {
        decimal = decimal.slice(0, -1);
      }
    } else {
      // 如果是0值，确保有2位小数
      decimal = decimal.padEnd(2, '0');
    }
    
    // 如果小数部分为空，不显示小数点，否则添加小数点
    const decimalPart = decimal.length > 0 ? '.' + decimal : '';
    
    return {
      integer: parts[0],
      decimal: decimalPart
    };
  };

  return (
    <>
      {/* 侧边栏遮罩 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Buy Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center">
          <div className="bg-[#121212] border border-gray-800 w-[90%] max-w-md rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold flex items-center gap-2">Buy <img className="w-6 h-6 rounded-full" src="https://hyperindex.4everland.store/HSK-LOGO.png" alt="HSK" /> HSK from this CEX</h2>
              <button 
                className="text-gray-400 hover:text-white"
                onClick={() => setShowBuyModal(false)}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {CEX_LIST.map((cex, index) => (
                <a 
                  key={index} 
                  href={cex.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 bg-[#1E1E1E] hover:bg-[#252525] rounded-xl transition-colors"
                >
                  <img src={cex.icon} alt={cex.name} className="w-8 h-8 rounded-full" />
                  <span className="flex-1">{cex.name}</span>
                  <ArrowDownCircleIcon className="w-5 h-5 transform rotate-[-135deg] text-gray-400" />
                </a>
              ))}
            </div>
            
            <div className="mt-6 text-sm text-gray-400 text-center">
              Select an exchange to buy HSK tokens
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center">
          <div className="bg-[#121212] border border-gray-800 w-[90%] max-w-md rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Receive crypto</h2>
              <button 
                className="text-gray-400 hover:text-white"
                onClick={() => setShowReceiveModal(false)}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-gray-400 text-center mb-8">
              Fund your wallet by transferring crypto from another wallet or account
            </p>
            
            <div className="bg-[#1B1B1B] p-2 rounded-2xl mb-6 w-full">
              {address && (
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center justify-center gap-2 rounded-full">
                    <img 
                      src="/img/index-coin.jpg" 
                      alt="HyperIndex Logo" 
                      className="w-6 h-6 rounded-full" 
                    />
                    <p className="text-gray-400 text-base font-extrabold">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4">
                    <button 
                      className="w-8 h-8 bg-[#252525] rounded-full flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
                      onClick={() => navigator.clipboard.writeText(address || '')}
                    >
                      <DocumentDuplicateIcon className='w-5 h-5 text-gray-400' />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-400 text-center">
              Only send assets on HashKey chain to this address
            </div>
          </div>
        </div>
      )}

      {/* 收起按钮 - 固定在抽屉外部左侧 */}
      <div className={`fixed top-4 right-[360px] z-50 transition-all duration-300 ${
        isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}>
        <button 
          className="btn btn-sm btn-circle bg-[#0D111C] hover:bg-[#0D111C] border border-white/[0.08]"
          onClick={() => setOpen(false)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 6l6 6-6 6M5 6l6 6-6 6"/>
          </svg>
        </button>
      </div>

      {/* 侧边栏内容 */}
      <div className={`fixed top-0 right-0 h-screen w-[360px] bg-[#0D111C] z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col w-full px-2 h-full">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-700">
                  <Image 
                    src="/img/index-coin.jpg" 
                    alt="User Avatar" 
                    width={32} 
                    height={32}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                </div>
                <Image 
                  className="absolute -bottom-1 -right-1 rounded-full" 
                  src={`/img/${connectorName}.png`} 
                  alt="wallet" 
                  width={14} 
                  height={14} 
                />
              </div>
              {address && <CopyAddress address={address} />}
            </div>
            <button 
              className="btn btn-ghost btn-sm btn-circle"
              onClick={logout}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 7.3335C7.63133 7.3335 7.33333 7.03483 7.33333 6.66683V2.00016C7.33333 1.63216 7.63133 1.3335 8 1.3335C8.36867 1.3335 8.66667 1.63216 8.66667 2.00016V6.66683C8.66667 7.03483 8.36867 7.3335 8 7.3335ZM14 8.66683C14 6.5375 12.8506 4.5462 11.002 3.47087C10.6833 3.28553 10.2753 3.39343 10.0907 3.71143C9.90532 4.03009 10.0134 4.43822 10.3314 4.62288C11.772 5.46088 12.6667 7.01083 12.6667 8.66683C12.6667 11.2402 10.5727 13.3335 8 13.3335C5.42733 13.3335 3.33333 11.2402 3.33333 8.66683C3.33333 7.01083 4.22795 5.46088 5.66862 4.62288C5.98729 4.43822 6.09534 4.02943 5.90934 3.71143C5.72334 3.39343 5.31538 3.2842 4.99805 3.47087C3.14938 4.54687 2 6.5375 2 8.66683C2 11.9748 4.69133 14.6668 8 14.6668C11.3087 14.6668 14 11.9748 14 8.66683Z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          {/* 总资产 */}
          <div className="px-2 py-4">
            <div className="text-sm font-medium text-gray-400 mb-1">Total Balance</div>
            {isLoading ? (
              <div className="h-8 w-48 bg-white/[0.08] rounded animate-pulse" />
            ) : (
              <div className="text-[32px] font-medium tracking-[-0.02em]">
                <span className="text-white mr-1">$</span>
                <span className="text-white">{formatBalanceWithDecimals(totalBalance).integer}</span>
                <span className="text-gray-500">{formatBalanceWithDecimals(totalBalance).decimal}</span>
              </div>
            )}
            
            {/* Buy 和 Receive 按钮 */}
            <div className="flex gap-4 mt-4 h-20">
              <button 
                className="flex-1 flex flex-col items-start px-6 h-full justify-center rounded-2xl gap-2 transition-all hover:opacity-90 bg-custom-purple"
                onClick={() => setShowBuyModal(true)}
              >
                <BuildingLibraryIcon className="w-5 h-5 text-primary" />
                <span className="text-primary font-extrabold">Buy</span>
              </button>
              <button 
                className="flex-1 flex flex-col items-start px-6 h-full justify-center rounded-2xl gap-2 transition-all hover:opacity-90 bg-custom-purple"
                onClick={() => setShowReceiveModal(true)}
              >
                <ArrowDownCircleIcon className="w-5 h-5 text-primary"  />
                <span className="text-primary font-extrabold">Receive</span>
              </button>
            </div>
          </div>

          {/* 导航切换 */}
          <div className="flex px-2 border-b border-white/[0.08]">
            <button
              className={`py-4 px-1 text-base font-medium relative ${
                activeTab === 'token' 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setActiveTab('token')}
            >
              Tokens
              {activeTab === 'token' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full" />
              )}
            </button>
            <button
              className={`py-4 px-1 text-base font-medium ml-6 relative ${
                activeTab === 'pool' 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setActiveTab('pool')}
            >
              Pools
              {activeTab === 'pool' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full" />
              )}
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto px-2 py-4">
            {isLoading || (tokenBalances.length === 0 && userTokens.length !== 0) ? (
              <TokenSkeleton />
            ) : (
              <>
                {activeTab === 'token' && <TabToken userTokens={tokenBalances} />}
                {activeTab === 'pool' && <TabPool tokenData={tokenData} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
