import { useEffect } from 'react';
import { Play, RotateCcw, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';

import MetricCard from '../components/MetricCard';
import OrderBook from '../components/OrderBook';
import OrderBlotter from '../components/OrderBlotter';
import type { TradeLog } from '../components/OrderBlotter';
import StrategyBadge from '../components/StrategyBadge';

interface LiveSimulatorProps {
  status: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  steps: any[];
  runEpisode: () => void;
  resetEpisode: () => void;
  activeStrategy: 'sac' | 'twap' | 'vwap' | 'random';
  setActiveStrategy: (strategy: 'sac' | 'twap' | 'vwap' | 'random') => void;
  selectedStep: number | null;
  setSelectedStep: (step: number | null) => void;
}

export default function LiveSimulator({
  status,
  steps = [],
  runEpisode,
  resetEpisode,
  activeStrategy,
  setActiveStrategy,
  selectedStep,
  setSelectedStep
}: LiveSimulatorProps) {
  
  // Confetti effect when episode completes and Agent beats TWAP
  useEffect(() => {
    if (status === 'COMPLETE' && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      const agentShortfall = lastStep.agent?.shortfall_bps || 0;
      const twapShortfall = lastStep.twap?.shortfall_bps || 0;
      
      // If buying, lower shortfall is better
      if (agentShortfall < twapShortfall) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#6366F1', '#10B981', '#F3F4F6']
        });
      }
    }
  }, [status, steps]);

  const latestStepData = steps.length > 0 ? steps[steps.length - 1] : null;
  
  // Extract active strategy metrics
  const activeMetrics = latestStepData ? latestStepData[activeStrategy] : {
    inventory_remaining: 10000,
    total_executed: 0,
    avg_fill_price: 0,
    shortfall_bps: 0,
    last_trade_qty: 0,
    last_trade_price: 0
  };

  const midPrice = latestStepData ? latestStepData.mid_price : 100.00;
  const spreadBps = latestStepData ? (latestStepData.agent?.state_features?.[0] * 2.5 + 5.0) || 5.0 : 5.0;
  const orderBookBids = latestStepData ? latestStepData.order_book?.bids : [];
  const orderBookAsks = latestStepData ? latestStepData.order_book?.asks : [];

  // Format charts data
  const chartData = steps.map((s) => ({
    step: s.step,
    midPrice: s.mid_price,
    agentAvgPrice: s.agent?.avg_fill_price || null,
    twapAvgPrice: s.twap?.avg_fill_price || null,
    vwapAvgPrice: s.vwap?.avg_fill_price || null,
    randomAvgPrice: s.random?.avg_fill_price || null,
  }));

  // Build trades log for blotter
  const tradesLog: TradeLog[] = steps
    .filter(s => s.step > 0 && s[activeStrategy]?.last_trade_qty > 0)
    .map(s => ({
      step: s.step,
      qty: s[activeStrategy].last_trade_qty,
      fill_price: s[activeStrategy].last_trade_price,
      slippage_bps: s[activeStrategy].last_trade_slippage_bps
    }));

  // Calculate comparisons vs baselines for MetricCards
  const twapShortfall = latestStepData?.twap?.shortfall_bps || 0;
  
  const currentShortfall = activeMetrics.shortfall_bps;
  const twapDiff = currentShortfall - twapShortfall;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#171B22] border border-[#262C36] rounded-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-white tracking-wide">Live Execution Simulator</h1>
            <StrategyBadge strategy={activeStrategy} />
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Compare RL agent orders execution in real time. Switch strategies mid-episode to observe policy response.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Strategy Toggle */}
          <div className="flex bg-[#0F1115] p-1 border border-[#262C36] rounded-lg text-xs shrink-0 select-none">
            {(['sac', 'twap', 'vwap', 'random'] as const).map((strat) => (
              <button
                key={strat}
                onClick={() => setActiveStrategy(strat)}
                className={`px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150 ${
                  activeStrategy === strat
                    ? strat === 'sac' 
                      ? 'bg-[#2D8C6A] text-white' 
                      : strat === 'vwap'
                        ? 'bg-[#C58B39] text-white'
                        : 'bg-gray-700 text-white'
                    : 'text-[#9CA3AF] hover:text-gray-300'
                }`}
              >
                {strat === 'sac' ? 'Agent' : strat}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {status === 'RUNNING' ? (
              <button 
                disabled
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2D8C6A] text-white font-semibold rounded-lg text-sm select-none running-pulse cursor-not-allowed opacity-80"
              >
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Simulating...</span>
              </button>
            ) : (
              <button
                onClick={runEpisode}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2D8C6A] hover:bg-[#3FAF7B] text-white font-semibold rounded-lg text-sm shadow-lg shadow-[#2D8C6A]/10 transition-all select-none"
              >
                <Play size={16} fill="white" />
                <span>Run Episode</span>
              </button>
            )}

            <button
              onClick={resetEpisode}
              disabled={status === 'RUNNING'}
              className="p-2 border border-[#262C36] hover:border-[#2D8C6A] bg-transparent text-[#9CA3AF] hover:text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Shares Remaining / Total"
          value={`${activeMetrics.inventory_remaining.toLocaleString()} / ${(steps[0]?.agent?.inventory_remaining || 10000).toLocaleString()}`}
          isMono={true}
        />
        <MetricCard
          label="Implementation Shortfall"
          value={`${currentShortfall.toFixed(1)} bps`}
          delta={activeStrategy !== 'twap' ? twapDiff : undefined}
          deltaSuffix=" bps vs TWAP"
          lowerIsBetter={true}
        />
        <MetricCard
          label="Avg Fill vs Arrival Price"
          value={activeMetrics.avg_fill_price > 0 
            ? `$${activeMetrics.avg_fill_price.toFixed(2)}` 
            : `$${midPrice.toFixed(2)}`}
          delta={activeMetrics.avg_fill_price > 0 ? (activeMetrics.avg_fill_price - midPrice) : 0}
          deltaSuffix=""
          lowerIsBetter={true}
        />
        <MetricCard
          label="Time Elapsed / Horizon"
          value={`${steps.length > 0 ? steps[steps.length - 1].step : 0} / ${latestStepData?.horizon || 20} steps`}
          isMono={true}
        />
      </div>

      {/* Main Grid: Charts & OrderBook */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Execution curves take 8 columns */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="premium-card p-5 flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
              <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
                Execution Price Curves
              </h3>
              <div className="text-[10px] text-gray-500 font-medium font-sans flex items-center gap-1.5 select-none">
                <HelpCircle size={12} />
                <span>Shows average fill price cumulative over the episode steps</span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full">
              {steps.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm italic font-sans">
                  No simulation active. Click "Run Episode" to generate execution price paths.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                    <XAxis 
                      dataKey="step" 
                      stroke="#4B5563" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#4B5563" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `$${v.toFixed(1)}`}
                    />
                    
                    {/* Recharts Tooltip with dark card style */}
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
                      labelFormatter={(label) => `Step: ${label}`}
                    />
                    
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="plainline" 
                      fontSize={10}
                      wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }}
                    />
                    
                    {/* Linked Highlight Step */}
                    {selectedStep !== null && (
                      <ReferenceLine x={selectedStep} stroke="#2D8C6A" strokeWidth={1.5} strokeDasharray="3 3" />
                    )}

                    {/* Mid Price Path */}
                    <Line 
                      type="monotone" 
                      dataKey="midPrice" 
                      name="Mid Price" 
                      stroke="rgba(255,255,255,0.25)" 
                      strokeWidth={1.5} 
                      dot={false}
                      activeDot={false}
                    />

                    {/* Agent Curve (solid deep green) */}
                    <Line 
                      type="monotone" 
                      dataKey="agentAvgPrice" 
                      name="SAC Agent" 
                      stroke="#2D8C6A" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 4 }}
                      animationDuration={500}
                    />

                    {/* TWAP Curve (dashed gray) */}
                    <Line 
                      type="monotone" 
                      dataKey="twapAvgPrice" 
                      name="TWAP" 
                      stroke="#9CA3AF" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4" 
                      dot={false}
                      activeDot={{ r: 3 }}
                    />

                    {/* VWAP Curve (dashed gold) */}
                    <Line 
                      type="monotone" 
                      dataKey="vwapAvgPrice" 
                      name="VWAP" 
                      stroke="#C58B39" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4" 
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Order Blotter table */}
          <OrderBlotter 
            trades={tradesLog} 
            selectedStep={selectedStep} 
            onSelectStep={setSelectedStep} 
          />
        </div>

        {/* OrderBook takes 4 columns */}
        <div className="lg:col-span-4">
          <OrderBook 
            bids={orderBookBids} 
            asks={orderBookAsks} 
            midPrice={midPrice} 
            spreadBps={spreadBps} 
          />
        </div>
      </div>
    </div>
  );
}
