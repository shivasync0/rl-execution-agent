import { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

import type { BookLevel } from './OrderBook';

interface OrderBookDepthChartProps {
  bids: BookLevel[];
  asks: BookLevel[];
  midPrice: number;
}

export default function OrderBookDepthChart({ bids = [], asks = [], midPrice }: OrderBookDepthChartProps) {
  
  // Prepare data for the depth chart (cumulative size)
  const chartData = useMemo(() => {
    if (!bids.length && !asks.length) return [];
    
    // Process bids (descending price, cumulative from mid price out)
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    let bidCum = 0;
    const bidPoints = sortedBids.map(b => {
      bidCum += b.size;
      return {
        price: b.price,
        bidSize: bidCum,
        askSize: null
      };
    }).reverse(); // Reverse so x-axis is ascending price

    // Process asks (ascending price, cumulative from mid price out)
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    let askCum = 0;
    const askPoints = sortedAsks.map(a => {
      askCum += a.size;
      return {
        price: a.price,
        bidSize: null,
        askSize: askCum
      };
    });

    return [...bidPoints, ...askPoints];
  }, [bids, asks]);

  if (!chartData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500 text-xs">
        No depth data available
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[200px] select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
          
          <XAxis 
            dataKey="price" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(val) => val.toFixed(2)}
            stroke="#4B5563"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          
          <YAxis 
            stroke="#4B5563"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
            orientation="right"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#171B22',
              border: '1px solid #262C36',
              borderRadius: '8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: '#F4F5F7'
            }}
            itemStyle={{ padding: '2px 0' }}
            labelFormatter={(label: number) => `Price: $${label.toFixed(2)}`}
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === 'bidSize' ? 'Bid Depth' : 'Ask Depth'
            ]}
          />

          <ReferenceLine x={midPrice} stroke="#4B5563" strokeDasharray="3 3" />

          <Area 
            type="stepAfter" 
            dataKey="bidSize" 
            stroke="#3FAF7B" 
            fill="#3FAF7B" 
            fillOpacity={0.2}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          
          <Area 
            type="stepBefore" 
            dataKey="askSize" 
            stroke="#B85A52" 
            fill="#B85A52" 
            fillOpacity={0.2}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
