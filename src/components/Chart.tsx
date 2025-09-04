import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';

interface ChartProps {
    token0: string;
    token1: string;
    data: { time: string; price: number }[];
    type: 'token' | 'pool';
    onRangeChange?: (range: '1d' | '1w') => void;
}

export default function Chart({ token0, token1, data, type = 'token', onRangeChange }: ChartProps) {
    const [activeRange, setActiveRange] = React.useState<'1d' | '1w'>('1d');
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<echarts.ECharts | null>(null);
    const [loading, setLoading] = React.useState(false);
    // 添加 data 的深度比较
    const memoizedData = useMemo(() => {
        return data.map(item => ({
            time: item.time,
            price: item.price
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.length, data[0]?.time, data[0]?.price, data[data.length - 1]?.time, data[data.length - 1]?.price]); // 只比较数组长度和首尾数据

    const calculateAPY = (price: number): number => {
        return (price / 100) * 12;
    };

    // 修改 option 的依赖项
    const option = useMemo(() => {
        const latestPrice = data.length > 0 ? data[data.length - 1].price : 0;
        const firstPrice = data.length > 0 ? data[0].price : 0; // 获取最老的价格数据
        let apy = 0;

        if (latestPrice !== 0 && firstPrice !== 0) {
            apy = calculateAPY((latestPrice - firstPrice) / firstPrice * 100);
        }

        return {
            title: { 
                text: type === 'token' ? `{price|$${latestPrice}}\n{apy|${apy >= 0.01 ? '▲' : '▼'} ${Math.abs(apy).toFixed(2)}%}` : `{price|1 ${token0} = ${latestPrice} ${token1}}\n{apy|${apy >= 0.01 ? '▲' : '▼'} ${Math.abs(apy).toFixed(2)}%}`,
                textStyle: {
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#fff',
                    rich: {
                        price: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
                        apy: {
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: apy >= 0.01 ? '#4eaf0a' : '#e84749',
                            padding: [10, 0, 0, 0]
                        }
                    },
                },
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(50, 50, 50, 0.8)',
                textStyle: {
                    color: '#fff',
                },
                formatter: function (params: any) {
                    if (params.length > 0) {
                        const price = parseFloat(params[0].data[1]).toFixed(2);
                        
                        return `Price: ${price}`;
                    }
                    return '';
                },
            },
            xAxis: {
                type: 'category',
                data: data.map(item => item.time),
                axisLine: { show: false }, // 去掉 x 轴的横线
                axisLabel: { color: '#666' },
            },
            yAxis: {
                type: 'value',
                position: 'right', // 将 y 轴移动到右侧
                axisLine: { show: false }, // 去掉 y 轴的横线
                axisLabel: { 
                    color: '#666',
                    formatter: function(value: number) {
                        return value.toFixed(2); // 将y轴标签格式化为2位小数
                    }
                },
                splitLine: { show: false }, // 去掉 y 轴的分隔线
                boundaryGap: [0, '100%'],
                min: function () {
                    // 计算数据中的最小值和最大值
                    const minPrice = Math.min(...data.map(item => item.price));
                    const maxPrice = Math.max(...data.map(item => item.price));
                    // 计算数据范围的一定比例
                    const range = maxPrice - minPrice;
                    // 返回最小值减去范围的10%，这样波动会更明显
                    return parseFloat((minPrice - range * 0.5).toFixed(2)); // 保留2位小数
                }
            },
            series: [
                {
                    name: 'chart',
                    data: data.map(item => [item.time, item.price]),
                    type: 'line',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(135, 206, 250, 0.8)' }, // 浅蓝色
                            { offset: 1, color: 'rgba(135, 206, 250, 0.1)' }, // 渐变到透明
                        ]),
                    },
                    lineStyle: {
                        color: 'rgba(135, 206, 250, 1)', // 设置线条颜色为浅蓝色
                        width: 2, // 设置线条宽度
                    },
                    symbol: 'none', // 去掉连接点
                },
            ],
            grid: {
                left: '3%',
                right: '3%',
                bottom: '3%',
                containLabel: true,
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memoizedData, token0, token1, type]); // 使用 memoizedData 替代 data

    useEffect(() => {
        if (!chartRef.current) return;
        
        // 如果已存在图表实例，先销毁它
        if (chartInstance.current) {
            chartInstance.current.dispose();
        }

        // 创建新的图表实例
        const chart = echarts.init(chartRef.current);
        chartInstance.current = chart;

        chart.setOption(option);

        // 事件监听器设置
        chart.on('updateAxisPointer', function (event: any) {
            const dataIndex = event.dataIndex;
            if (typeof dataIndex === 'undefined' || dataIndex <= 0) return;

            const currentPrice = data[dataIndex]?.price;
            const previousPrice = data[dataIndex - 1]?.price;

            if (currentPrice !== undefined && previousPrice !== undefined) {
                const apy = calculateAPY((currentPrice - previousPrice) / previousPrice * 100);
                chart.setOption({
                    title: { 
                        text: type === 'token' ? 
                            `{price|$${currentPrice}}\n{apy|${apy >= 0.01 ? '▲' : '▼'} ${Math.abs(apy).toFixed(2)}%}` : 
                            `{price|1 ${token0} = ${currentPrice} ${token1}}\n{apy|${apy >= 0.01 ? '▲' : '▼'} ${Math.abs(apy).toFixed(2)}%}`,
                        textStyle: {
                            rich: {
                                price: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
                                apy: {
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    color: apy >= 0.01 ? '#4eaf0a' : '#e84749',
                                    padding: [10, 0, 0, 0]
                                }
                            }
                        }
                    },
                });
            }
        });

        return () => {
            // 组件卸载时清理图表实例
            if (chartInstance.current) {
                chartInstance.current.dispose();
                chartInstance.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memoizedData]); // 依赖于 data 的变化

    const handleRangeChange = async (range: '1d' | '1w') => {
        setLoading(true);
        setActiveRange(range);
        try {
            await onRangeChange?.(range);
        } catch (error) {
            console.error('Range change failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full relative">
             {loading && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}
            {data.length > 0  ? (
                <div ref={chartRef} className="w-full h-[400px]" />
            ) : (
                <div 
                    style={{
                        width: '100%',
                        height: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}
                >
                    <svg
                        width="300"
                        height="100"
                        viewBox="0 0 300 100"
                        style={{
                            opacity: 0.6
                        }}
                    >
                        <path
                            d="M 0,50 Q 75,20 150,50 T 300,50"
                            fill="none"
                            stroke="#3498db"
                            strokeWidth="2"
                            style={{
                                animation: 'pathAnimate 3s linear infinite'
                            }}
                        />
                    </svg>
                    <style jsx global>{`
                        @keyframes pathAnimate {
                            0% {
                                stroke-dasharray: 500;
                                stroke-dashoffset: 500;
                            }
                            100% {
                                stroke-dasharray: 500;
                                stroke-dashoffset: -500;
                            }
                        }
                    `}</style>
                </div>
            )}
            <div className="mt-4 flex">
                <div className="flex p-1 bg-white/10 rounded-lg">
                    <button
                        onClick={() => handleRangeChange('1d')}
                        className={`
                            min-w-[40px] px-2 py-0.5 text-sm rounded-md
                            transition-all duration-300 ease-in-out
                            ${activeRange === '1d' 
                                ? 'bg-white/20 text-white' 
                                : 'bg-transparent text-white/60 hover:text-white/80'
                            }
                        `}
                    >
                        1D
                    </button>
                    <button
                        onClick={() => handleRangeChange('1w')}
                        className={`
                            min-w-[40px] px-2 py-0.5 text-sm rounded-md
                            transition-all duration-300 ease-in-out
                            ${activeRange === '1w' 
                                ? 'bg-white/20 text-white' 
                                : 'bg-transparent text-white/60 hover:text-white/80'
                            }
                        `}
                    >
                        1W
                    </button>
                </div>
            </div>
        </div>
    );
}