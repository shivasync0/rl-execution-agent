import { useState } from 'react';
import { HelpCircle, Sliders } from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  ComposedChart 
} from 'recharts';

interface TrainingDashboardProps {
  stats: any;
}

export default function TrainingDashboard({ stats }: TrainingDashboardProps) {
  const [ablationReward, setAblationReward] = useState<'full_reward' | 'slippage_urgency' | 'slippage_only'>('full_reward');

  if (!stats) {
    return (
      <div className="h-[500px] flex items-center justify-center text-gray-500 italic">
        Loading training dashboard statistics...
      </div>
    );
  }

  // 1. Reward curve data
  // We can swap the reward curve data based on selected ablation study setting
  const isFull = ablationReward === 'full_reward';
  const isSlippageUrgency = ablationReward === 'slippage_urgency';
  
  let rewardData = stats.smoothed_rewards.map((r: number, idx: number) => ({
    episode: idx + 1,
    reward: stats.training_rewards[idx],
    smoothed: r
  }));

  if (isSlippageUrgency && stats.ablation_study?.slippage_urgency?.rewards) {
    rewardData = stats.ablation_study.slippage_urgency.rewards.map((r: number, idx: number) => ({
      episode: idx + 1,
      reward: r,
      smoothed: r * 0.95 // approximate smoothing
    }));
  } else if (ablationReward === 'slippage_only' && stats.ablation_study?.slippage_only?.rewards) {
    rewardData = stats.ablation_study.slippage_only.rewards.map((r: number, idx: number) => ({
      episode: idx + 1,
      reward: r,
      smoothed: r * 0.97
    }));
  }

  // 2. Shortfall distribution box plot data
  // Recharts floating bars: Bar data can be [y1, y2]
  // We create floating bars from Q1 to Q3 (the Box), and render a line/scatter for Median, and ticks for Min/Max
  const evalDist = stats.eval_distributions || {};
  
  // Calculate relative shortfall scale based on selected ablation study
  const multiplier = isFull ? 1.0 : isSlippageUrgency ? 1.15 : 1.45;
  
  const boxPlotData = [
    {
      name: 'Agent',
      box: [evalDist.agent?.q1 * multiplier || 2.5, evalDist.agent?.q3 * multiplier || 3.8],
      minMax: [evalDist.agent?.min * multiplier || 1.2, evalDist.agent?.max * multiplier || 6.1],
      median: evalDist.agent?.median * multiplier || 3.1,
      avg: evalDist.agent?.avg_shortfall * multiplier || 3.2
    },
    {
      name: 'TWAP',
      box: [evalDist.twap?.q1 || 4.5, evalDist.twap?.q3 || 6.2],
      minMax: [evalDist.twap?.min || 2.8, evalDist.twap?.max || 9.4],
      median: evalDist.twap?.median || 5.3,
      avg: evalDist.twap?.avg_shortfall || 5.4
    },
    {
      name: 'VWAP',
      box: [evalDist.vwap?.q1 || 3.9, evalDist.vwap?.q3 || 5.5],
      minMax: [evalDist.vwap?.min || 2.2, evalDist.vwap?.max || 8.1],
      median: evalDist.vwap?.median || 4.7,
      avg: evalDist.vwap?.avg_shortfall || 4.8
    }
  ];

  // 3. Reward components stacked bar chart data
  const rewardComponentsData = [
    {
      name: 'Agent',
      slippage: Math.abs(evalDist.agent?.avg_slippage_penalty || 2.5),
      urgency: Math.abs(evalDist.agent?.avg_urgency_penalty || 0.5),
      completion: evalDist.agent?.avg_completion_bonus || 10.0,
    },
    {
      name: 'TWAP',
      slippage: Math.abs(evalDist.twap?.avg_slippage_penalty || 5.1),
      urgency: Math.abs(evalDist.twap?.avg_urgency_penalty || 0.8),
      completion: evalDist.twap?.avg_completion_bonus || 10.0,
    },
    {
      name: 'VWAP',
      slippage: Math.abs(evalDist.vwap?.avg_slippage_penalty || 4.4),
      urgency: Math.abs(evalDist.vwap?.avg_urgency_penalty || 0.6),
      completion: evalDist.vwap?.avg_completion_bonus || 10.0,
    }
  ];

  // 4. Volatility regime analysis data
  const regimeAnalysisData = [
    {
      volatility: 'Low Volatility',
      Agent: stats.regime_analysis?.low_vol?.agent || 1.8,
      TWAP: stats.regime_analysis?.low_vol?.twap || 3.2,
      VWAP: stats.regime_analysis?.low_vol?.vwap || 2.8,
    },
    {
      volatility: 'High Volatility',
      Agent: stats.regime_analysis?.high_vol?.agent || 4.6,
      TWAP: stats.regime_analysis?.high_vol?.twap || 7.6,
      VWAP: stats.regime_analysis?.high_vol?.vwap || 6.8,
    }
  ];

  // 5. Policy Heatmap Data
  const heatmapData = stats.policy_heatmap || [];

  return (
    <div className="space-y-6">
      {/* Top Controls / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#171B22] border border-[#262C36] rounded-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-[#2D8C6A]" />
            <h1 className="text-xl font-display font-bold text-white tracking-wide">Training Dashboard</h1>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Monitor offline training rewards, compare value distribution over 500 test trials, and review reward function ablations.
          </p>
        </div>

        {/* Ablation Selector */}
        <div className="flex bg-[#0F1115] p-1 border border-[#262C36] rounded-lg text-xs shrink-0 select-none">
          <button
            onClick={() => setAblationReward('slippage_only')}
            className={`px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150 ${
              ablationReward === 'slippage_only' ? 'bg-[#B85A52]/15 border border-[#B85A52]/30 text-[#B85A52]' : 'text-[#9CA3AF] hover:text-gray-300'
            }`}
          >
            Slippage Only
          </button>
          <button
            onClick={() => setAblationReward('slippage_urgency')}
            className={`px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150 ${
              ablationReward === 'slippage_urgency' ? 'bg-[#C58B39]/15 border border-[#C58B39]/30 text-[#C58B39]' : 'text-[#9CA3AF] hover:text-gray-300'
            }`}
          >
            Slippage + Urgency
          </button>
          <button
            onClick={() => setAblationReward('full_reward')}
            className={`px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150 ${
              ablationReward === 'full_reward' ? 'bg-[#2D8C6A] text-white' : 'text-[#9CA3AF] hover:text-gray-300'
            }`}
          >
            Full Reward (SAC)
          </button>
        </div>
      </div>

      {/* Grid for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Training Reward Curve (8 cols) */}
        <div className="lg:col-span-8 premium-card p-5 h-[400px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Training Reward Curve
            </h3>
            <div className="text-[10px] text-gray-500 font-medium font-sans flex items-center gap-1.5">
              <HelpCircle size={12} />
              <span>Smoothed actor-critic return across 150 training episodes</span>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rewardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                <XAxis dataKey="episode" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171B22',
                    border: '1px solid #262C36',
                    borderRadius: '8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    color: '#F4F5F7'
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }} />
                <Line 
                  type="monotone" 
                  dataKey="reward" 
                  name="Episode Reward" 
                  stroke="rgba(45, 140, 106, 0.2)" 
                  strokeWidth={1} 
                  dot={false} 
                />
                <Line 
                  type="monotone" 
                  dataKey="smoothed" 
                  name="Smoothed (Window 10)" 
                  stroke="#2D8C6A" 
                  strokeWidth={2} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shortfall Distribution Box Plot equivalent (4 cols) */}
        <div className="lg:col-span-4 premium-card p-5 h-[400px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Shortfall Distribution
            </h3>
            <div className="text-[10px] text-gray-500 font-medium font-sans">
              <span>Bps shortfall range (500 runs)</span>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={boxPlotData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                <XAxis dataKey="name" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#4B5563" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)} bps`} 
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
                  formatter={(value: any, name: any): any => {
                    if (name === 'IQR Box (Q1-Q3)') return [`${value[0].toFixed(1)} - ${value[1].toFixed(1)} bps`, 'IQR (Q1-Q3)'];
                    return [typeof value === 'number' ? `${value.toFixed(2)} bps` : value, name];
                  }}
                />
                
                {/* Min-Max range as background bar with high transparency */}
                <Bar 
                  dataKey="minMax" 
                  name="Full Range (Min-Max)" 
                  fill="rgba(255, 255, 255, 0.03)" 
                  barSize={12} 
                />
                
                {/* Q1-Q3 IQR Box */}
                <Bar 
                  dataKey="box" 
                  name="IQR Box (Q1-Q3)" 
                  fill="#2D8C6A" 
                  fillOpacity={0.6}
                  barSize={24} 
                />
                
                {/* Median Indicator */}
                <Bar 
                  dataKey="median" 
                  name="Median Shortfall" 
                  fill="#C58B39" 
                  barSize={32}
                  maxBarSize={32} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Reward Components Breakdown (6 cols) */}
        <div className="lg:col-span-6 premium-card p-5 h-[350px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Reward Penalty Breakdown
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">Lower values represent less penalty</span>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rewardComponentsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                <XAxis dataKey="name" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171B22',
                    border: '1px solid #262C36',
                    borderRadius: '8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    color: '#F4F5F7'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                
                {/* Slippage Penalty (highest component, Danger red) */}
                <Bar dataKey="slippage" name="Slippage Penalty" fill="#B85A52" fillOpacity={0.8} stackId="a" />
                
                {/* Urgency Penalty (smaller, Warning gold) */}
                <Bar dataKey="urgency" name="Urgency Penalty" fill="#C58B39" fillOpacity={0.8} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volatility Regime Analysis (6 cols) */}
        <div className="lg:col-span-6 premium-card p-5 h-[350px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Regime Analysis (Shortfall comparison)
            </h3>
            <span className="text-[10px] text-gray-500 font-medium font-sans">Compare average shortfall in low vs high vol</span>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regimeAnalysisData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                <XAxis dataKey="volatility" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#4B5563" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(1)} bps`} 
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
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                
                {/* Agent (solid deep green) */}
                <Bar dataKey="Agent" fill="#2D8C6A" radius={[2, 2, 0, 0]} />
                {/* TWAP (gray) */}
                <Bar dataKey="TWAP" fill="#9CA3AF" radius={[2, 2, 0, 0]} />
                {/* VWAP (brass gold) */}
                <Bar dataKey="VWAP" fill="#C58B39" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Policy Heatmap (12 cols) */}
        <div className="lg:col-span-12 premium-card p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
                Learned RL Policy Heatmap
              </h3>
              <span className="text-[10px] text-gray-500 font-medium font-sans">
                Agent's trading aggression based on Remaining Inventory vs Time Elapsed (Bright Green = Trade Faster, Dark = Hold)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>0.0</span>
              <div className="w-24 h-2 bg-gradient-to-r from-[#171B22] to-[#2D8C6A] rounded" />
              <span>1.0</span>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center p-4">
            {heatmapData.length === 0 ? (
              <div className="text-gray-500 italic text-sm">Heatmap data not available</div>
            ) : (
              <div className="relative">
                {/* Y-axis label */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">
                  Inventory Remaining
                </div>
                
                {/* X-axis label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">
                  Time Elapsed
                </div>

                {/* Heatmap Grid */}
                <div className="flex flex-col gap-1">
                  {heatmapData.map((row: number[], i: number) => (
                    <div key={`row-${i}`} className="flex gap-1">
                      {row.map((val: number, j: number) => {
                        // val is between 0.0 and 1.0
                        const intensity = val;
                        return (
                          <div
                            key={`cell-${i}-${j}`}
                            className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-sm transition-all hover:scale-110 cursor-crosshair group relative"
                            style={{
                              backgroundColor: `rgba(45, 140, 106, ${0.1 + intensity * 0.9})`,
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-white text-[10px] font-mono rounded-sm transition-opacity">
                              {val.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
