import { getAddress } from '@ethersproject/address'
import { ChainId } from 'hypherin-sdk'
import { zeroAddress } from 'viem'

export function isAddress(value: string | undefined): string | false {
  try {
    return getAddress(value || '')
  } catch {
    return false
  }
}

// 获取hashkey链上数据链接
export function getEtherscanLink(chainId: ChainId, data: string, type: 'transaction' | 'token' | 'address'): string {
  const prefix = `https://explorer.hsk.xyz`
  
  switch (type) {
    case 'transaction': {
      return `${prefix}/tx/${data}`
    }
    case 'token': {
      return `${prefix}/token/${data}`
    }
    case 'address':
    default: {
      return `${prefix}/address/${data}`
    }
  }
}

export const formatNumber = (value: number | string, decimals: number = 2): string => {
  if (value === 0 || isNaN(Number(value))) {
    return '0'
  }
  const num = Number(value)
  if (Math.abs(num) < 0.00001) return '< 0.00001'
  const fixedValue = num.toFixed(decimals)
  return fixedValue.replace(/\.?0+$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export const estimateAndCheckGas = async (hskBalance: any): Promise<boolean> => {
  try {
    // const defaultGas = BigInt(21000); // 基本交易的默认 gas
    
    // 检查用户是否有足够的 gas
    if (hskBalance && hskBalance.value <= 0) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    return true;
  }
};

// 只添加3位分隔符，增强鲁棒性
export const formatNumberWithCommas = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  
  // 尝试将输入转换为数字，处理科学计数法
  let numStr: string;
  try {
    // 先移除已有的逗号
    const cleanValue = value.toString().replace(/,/g, '');
    // 转换为数字再转回字符串，处理科学计数法
    numStr = Number(cleanValue).toString();
    // 如果转换结果是NaN，返回0
    if (numStr === 'NaN') return '0';
  } catch (error) {
    console.error('formatNumberWithCommas error:', error);
    return '0';
  }
  
  // 处理小数点
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return parts.join('.');
};

// 将数字转换为带有K、M、B等单位的格式
export const formatNumberToUnit = (value: number | string, decimals: number = 2): string => {
  if (value === undefined || value === null || value === '' || isNaN(Number(value))) {
    return '0';
  }
  
  const num = Number(value);
  
  if (num === 0) return '0';
  if (Math.abs(num) < 0.00001) return '< 0.00001';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000000) {
    // 十亿及以上用B (Billion)
    return sign + (absNum / 1000000000).toFixed(decimals).replace(/\.?0+$/, '') + 'B';
  } else if (absNum >= 1000000) {
    // 百万及以上用M (Million)
    return sign + (absNum / 1000000).toFixed(decimals).replace(/\.?0+$/, '') + 'M';
  } else if (absNum >= 1000) {
    // 千及以上用K (Kilo)
    return sign + (absNum / 1000).toFixed(decimals).replace(/\.?0+$/, '') + 'K';
  } else {
    // 小于1000的数字直接显示
    return sign + absNum.toFixed(decimals).replace(/\.?0+$/, '');
  }
};


export const isValidAddress = (address: string | undefined): boolean => {
  if (!address) return false;
  return Boolean(isAddress(address) && address !== zeroAddress);
};