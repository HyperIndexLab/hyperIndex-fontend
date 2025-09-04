export const formatTokenBalance = (value: string, decimals: string | null) => {
  if (!decimals) return value;
  const decimalNum = parseInt(decimals);
  
  // 将value转换为BigInt以处理大数
  const valueBigInt = BigInt(value);
  const divisor = BigInt(10 ** decimalNum);
  
  // 计算整数部分和小数部分
  const integerPart = valueBigInt / divisor;
  const fractionalPart = valueBigInt % divisor;
  
  // 格式化小数部分，补齐前导零
  let fractionalStr = fractionalPart.toString().padStart(decimalNum, '0');
  
  // 移除末尾的0
  fractionalStr = fractionalStr.replace(/0+$/, '');
  
  // 如果小数部分为空，只返回整数部分
  if (fractionalStr === '') {
    return `${integerPart}`;
  }

  // 如果小数部分只有一个零，返回整数部分
  if (fractionalStr === '0') {
    return `${integerPart}`;
  }
  
  // 如果小数部分超过7位，截取到7位
  if (fractionalStr.length > 7) {
    fractionalStr = fractionalStr.slice(0, 7);
  }
  
  return `${integerPart}.${fractionalStr}`;
};

export function formatNumberAbbr(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
  if (num >= 1e4) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
  return num.toString();
} 