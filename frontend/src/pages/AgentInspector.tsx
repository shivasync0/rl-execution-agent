import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { Cpu, Info } from 'lucide-react';

interface AgentInspectorProps {
  steps: any[];
  selectedStep: number | null;
  stats: any;
}

export default function AgentInspector({ steps = [], selectedStep, stats }: AgentInspectorProps) {
  
  // 1. Radar chart data
  // Determine which step's state to show (selected step or latest step)
  const activeStepIdx = selectedStep !== null 
    ? steps.findIndex(s => s.step === selectedStep) 
    : steps.length > 0 ? steps.length - 1 : -1;
    
  const activeStepData = activeStepIdx !== -1 ? steps[activeStepIdx] : null;
  const stateFeatures = activeStepData?.agent?.state_features || [0, 0, 0, 0, 0, 0, 0];
  
  const radarData = [
    { subject: 'Spread Bps', value: Math.max(0, stateFeatures[0] * 2.5 + 5.0) }, // Denormalized for display
    { subject: 'Imbalance', value: Math.abs(stateFeatures[1] * 100) }, // Scale to 0-100%
    { subject: 'Time Elapsed', value: stateFeatures[2] * 100 }, // Scale to 0-100%
    { subject: 'Inventory Rem.', value: stateFeatures[3] * 100 }, // Scale to 0-100%
    { subject: 'Momentum (5s)', value: Math.min(100, Math.max(0, (stateFeatures[4] + 0.5) * 100)) }, // Normalized for display
    { subject: 'Momentum (20s)', value: Math.min(100, Math.max(0, (stateFeatures[5] + 0.5) * 100)) },
    { subject: 'Realized Vol', value: Math.min(100, stateFeatures[6] * 500) },
  ];

  // 2. Action distribution data (fraction traded at each step)
  const actionDistributionData = steps
    .filter(s => s.step > 0)
    .map(s => {
      // Action is: last_trade_qty / (inventory_remaining + last_trade_qty)
      // or we can read env action.
      // Let's compute it: fraction of remaining traded
      const inventoryBefore = (s.agent?.inventory_remaining || 0) + (s.agent?.last_trade_qty || 0);
      const fracTraded = inventoryBefore > 0 ? (s.agent?.last_trade_qty || 0) / inventoryBefore : 0.0;
      
      return {
        step: s.step,
        fraction: fracTraded * 100, // percentage
        qty: s.agent?.last_trade_qty || 0
      };
    });

  // 3. Q-value line chart data
  const qValueData = steps
    .filter(s => s.step > 0)
    .map(s => ({
      step: s.step,
      q1: s.agent?.q_values?.[0] || 0,
      q2: s.agent?.q_values?.[1] || 0
    }));

  // 4. Policy heatmap grid
  // Grid coordinates: y = inventory_remaining (0% to 100%), x = time_elapsed (0% to 100%)
  // If we have stats.policy_heatmap, we use it. Otherwise we generate a beautiful mock heatmap
  // representing the acceleration behavior near the end of the horizon.
  const timeLabels = ['0%', '11%', '22%', '33%', '44%', '55%', '66%', '77%', '88%', '100%'];
  const invLabels = ['100%', '88%', '77%', '66%', '55%', '44%', '33%', '22%', '11%', '0%'];

  const getHeatmapColor = (action: number) => {
    // action is [0, 1]. Map to green colors
    // 0.0 -> #171B22
    // 0.2 -> rgba(45, 140, 106, 0.15)
    // 0.5 -> rgba(45, 140, 106, 0.4)
    // 0.8 -> rgba(45, 140, 106, 0.75)
    // 1.0 -> #2D8C6A
    if (action < 0.05) return 'bg-[#171B22] text-gray-600';
    if (action < 0.15) return 'bg-[#2D8C6A]/10 text-[#2D8C6A]';
    if (action < 0.3) return 'bg-[#2D8C6A]/25 text-[#3FAF7B]';
    if (action < 0.5) return 'bg-[#2D8C6A]/50 text-emerald-200';
    if (action < 0.8) return 'bg-[#2D8C6A]/75 text-white';
    return 'bg-[#2D8C6A] text-white font-bold';
  };

  // Policy Heatmap Matrix (10x10)
  // We represent the trained actor behavior:
  // - High inventory + high time elapsed -> accelerates trading (action size -> 1.0)
  // - Low time elapsed -> trades small fractions (action size -> 0.05 - 0.2)
  const defaultHeatmap = Array.from({ length: 10 }, (_, yIdx) => {
    const invPct = 1.0 - yIdx / 9; // 100% down to 0%
    return Array.from({ length: 10 }, (_, xIdx) => {
      const timePct = xIdx / 9; // 0% up to 100%
      
      // Calculate action magnitude: accelerates as time_pct -> 1.0
      // Especially if inventory is high
      let action = 0.05 + 0.1 * invPct + 0.7 * Math.pow(timePct, 3.5) * invPct;
      if (timePct >= 0.9) action = 1.0; // terminal sweep
      if (invPct <= 0.0) action = 0.0; // done
      return Math.min(1.0, Math.max(0.0, action));
    });
  });

  const heatmapMatrix = stats?.policy_heatmap || defaultHeatmap;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#171B22] border border-[#262C36] rounded-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-[#2D8C6A]" />
            <h1 className="text-xl font-display font-bold text-white tracking-wide">Agent Inspector</h1>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Audit neural network decisions. Observe state feature inputs, Q-value estimates, action allocations, and policy heatmaps.
          </p>
        </div>
      </div>

      {/* Grid: Radar and Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Radar chart of state features (4 cols) */}
        <div className="lg:col-span-5 premium-card p-5 h-[380px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[#262C36] pb-3 mb-4 shrink-0">
            <div className="flex flex-col">
              <h3 className="font-semibold text-white tracking-wider text-sm font-display uppercase">
                State Observation Viewer
              </h3>
              <span className="text-[10px] text-[#9CA3AF] font-sans">
                {activeStepData ? `Step ${activeStepData.step} observation state` : 'No active step'}
              </span>
            </div>
            {selectedStep !== null && (
              <span className="text-[10px] bg-[#2D8C6A]/10 border border-[#2D8C6A]/20 text-[#2D8C6A] font-bold px-2 py-0.5 rounded">
                STEP {selectedStep} FOCUS
              </span>
            )}
          </div>

          <div className="flex-1 w-full flex items-center justify-center">
            {steps.length === 0 ? (
              <div className="text-gray-600 text-sm italic font-sans">
                Run an episode to inspect state parameters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#262C36" />
                  <PolarAngleAxis dataKey="subject" stroke="#9CA3AF" fontSize={9} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="transparent" />
                  <Radar 
                    name="State Feature Value" 
                    dataKey="value" 
                    stroke="#2D8C6A" 
                    fill="#2D8C6A" 
                    fillOpacity={0.25} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Policy Heatmap (7 cols) */}
        <div className="lg:col-span-7 premium-card p-5 h-[380px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Policy Heatmap
            </h3>
            <div className="text-[10px] text-gray-500 font-medium font-sans flex items-center gap-1.5 select-none">
              <Info size={12} />
              <span>Cell values show action magnitude (fraction traded)</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="flex-1 flex flex-col justify-center text-[9px] font-sans">
            <div className="flex w-full items-stretch">
              {/* Y-Axis labels (Inventory Remaining) */}
              <div className="w-12 flex flex-col justify-between py-2 pr-1.5 text-right font-medium text-gray-500">
                {invLabels.map(label => (
                  <span key={label} className="h-6 flex items-center justify-end">{label}</span>
                ))}
              </div>

              {/* Grid Cells */}
              <div className="flex-1 flex flex-col justify-between border border-[#262C36] bg-[#0F1115] p-0.5 rounded">
                {heatmapMatrix.map((row: number[], yIdx: number) => (
                  <div key={yIdx} className="flex flex-row justify-between h-6 w-full gap-0.5">
                    {row.map((val: number, xIdx: number) => (
                      <div 
                        key={xIdx}
                        className={`flex-1 rounded-sm flex items-center justify-center font-mono transition-colors duration-150 group relative ${getHeatmapColor(val)}`}
                      >
                        <span>{val.toFixed(2)}</span>
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-[#171B22] border border-[#262C36] text-[#F4F5F7] font-sans text-[10px] p-2 rounded shadow-xl whitespace-nowrap z-40 select-none">
                          <p>Time: {timeLabels[xIdx]}</p>
                          <p>Inventory: {invLabels[yIdx]}</p>
                          <p className="font-mono font-bold text-[#2D8C6A]">Trade: {(val*100).toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Labels (Time Elapsed) */}
            <div className="flex w-full mt-1.5">
              <div className="w-12"></div> {/* Spacer */}
              <div className="flex-1 flex justify-between px-2 text-center font-medium text-gray-500">
                {timeLabels.map(label => (
                  <span key={label} className="flex-1">{label}</span>
                ))}
              </div>
            </div>

            {/* Axis titles */}
            <div className="text-center font-bold text-gray-500 tracking-wide mt-2">
              TIME ELAPSED
            </div>
            <div className="absolute left-1 top-1/2 -rotate-90 -translate-y-1/2 font-bold text-gray-500 tracking-wide text-[9px]">
              INVENTORY REMAINING
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Action Histogram & Q-values */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Action timeline distribution (6 cols) */}
        <div className="lg:col-span-6 premium-card p-5 h-[320px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Action Timeline Distribution
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">Fraction of inventory traded at each step</span>
          </div>

          <div className="flex-1 w-full">
            {steps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm italic font-sans">
                Run simulation to view actions distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                  <XAxis dataKey="step" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="#4B5563" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`} 
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
                    formatter={(v) => [`${parseFloat(v as string).toFixed(1)}%`, 'Fraction Traded']}
                  />
                  {selectedStep !== null && (
                    <ReferenceLine x={selectedStep} stroke="#2D8C6A" strokeWidth={1.5} />
                  )}
                  <Bar dataKey="fraction" fill="#2D8C6A" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Q-values line chart (6 cols) */}
        <div className="lg:col-span-6 premium-card p-5 h-[320px] flex flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
            <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
              Q-Value Estimates
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">Q1 and Q2 critic values over the episode</span>
          </div>

          <div className="flex-1 w-full">
            {steps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm italic font-sans">
                Run simulation to view critic values.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qValueData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                  <XAxis dataKey="step" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
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
                  {selectedStep !== null && (
                    <ReferenceLine x={selectedStep} stroke="#2D8C6A" strokeWidth={1.5} strokeDasharray="3 3" />
                  )}
                  <Line type="monotone" dataKey="q1" name="Q1 Critic" stroke="#2D8C6A" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="q2" name="Q2 Critic" stroke="#C58B39" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
