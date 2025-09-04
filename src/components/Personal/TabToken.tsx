import React from 'react';

import { UserToken } from '@/store/userTokensSlice';
import { formatTokenBalance } from '@/utils/formatTokenBalance';
import BigNumber from 'bignumber.js';
import { DEFAULT_TOKEN_ICON } from '../TokenModal';
import { DocumentDuplicateIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export interface TokenTab extends UserToken {
	price: string;
}

// 添加小数点前后分离的工具函数
const formatNumberWithDecimals = (value: string | number) => {
	// 确保值是字符串
	const stringValue = typeof value === 'number' ? value.toString() : value;
	// 转为数字
	const num = parseFloat(stringValue);
	
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

// 格式化地址
const formatAddress = (address: string) => {
	if (!address) return '';
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 单位缩写格式化函数
function formatWithUnit(num: string | number) {
	const n = Number(num);
	if (isNaN(n)) return num;
	if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
	if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
	return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function TabToken({userTokens}: {userTokens: TokenTab[] }) {
	return (
		<div className="mt-4 px-2">
			{userTokens?.map((token) => {
				// 特殊处理HSK代币价格，使其与WHSK价格一致
				const tokenPrice = token.token.symbol === 'HSK' ? 
					userTokens.find(t => t.token.symbol === 'WHSK')?.price || token.price : 
					token.price;

				// 计算代币余额
				const balance = formatTokenBalance(token.value, token.token.decimals);
				
				// 计算代币价值
				const tokenValue = tokenPrice === '0' 
					? balance 
					: BigNumber(tokenPrice).multipliedBy(BigNumber(balance)).toString();
				
				// 分离余额的整数和小数部分
				const balanceParts = formatNumberWithDecimals(balance);
				
				// 分离价值的整数和小数部分
				const valueParts = formatNumberWithDecimals(tokenValue);

				return (
					<div key={token.token.address} className="flex items-center gap-2 mb-4 justify-between">
						<div className="flex items-center gap-2">
							<img src={token.token.icon_url || DEFAULT_TOKEN_ICON} alt={token.token.symbol!} className="w-8 h-8 rounded-full" />
							<div className="flex flex-col gap-1">
								<div className="flex items-center">
									<span className="text-base font-medium">{token.token.symbol}</span>
									<button 
										className="ml-2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10"
										onClick={() => window.open(`https://hashkey.blockscout.com/token/${token.token.address}`, '_blank')}
									>
										<ArrowTopRightOnSquareIcon className="w-4 h-4" />
									</button>
								</div>
								<div className="flex items-center mt-1">
									<span className="text-xs text-gray-400 mr-1">
										{formatAddress(token.token.address)}
									</span>
									<button 
										className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10"
										onClick={() => navigator.clipboard.writeText(token.token.address || '')}
									>
										<DocumentDuplicateIcon className="w-3 h-3" />
									</button>
								</div>
							</div>
						</div>
						<div className="flex flex-col items-end">
							<div className="text-base">
								{tokenPrice === '0' ? (
									<>
										<span className="text-white">{formatWithUnit(balance)}</span>
									</>
								) : (
									<>
										<span className="text-white mr-1">$</span>
										<span className="text-white">{valueParts.integer}</span>
										<span className="text-gray-500">{valueParts.decimal}</span>
									</>
								)}
							</div>
							<div className="text-xs text-gray-400 mt-1">
								<span>{formatWithUnit(balance)}</span>
								<span className="ml-1">{token.token.symbol}</span>
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
