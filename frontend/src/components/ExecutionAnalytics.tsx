import { Zap, Activity, Clock, ShieldAlert, CheckCircle } from 'lucide-react';

interface ExecutionAnalyticsProps {
  agentShortfall: number;
  twapShortfall: number;
  vwapShortfall: number;
  impactModel: any;
  rewardComponents: any;
  orderSize: number;
}

export default function ExecutionAnalytics({
  agentShortfall,
  twapShortfall,
  vwapShortfall,
  impactModel,
  rewardComponents,
  orderSize
}: ExecutionAnalyticsProps) {
  
  if (!impactModel) return null;

  // Derive estimated cost breakdown from Almgren-Chriss model parameters
  const tempImpactCoeff = impactModel.eta;
  const permImpactCoeff = impactModel.gamma;
  const avgDailyVol = impactModel.avg_daily_volume;
  const annualVol = impactModel.annual_volatility;

  // Temporary impact proxy
  const tempCostRatio = (tempImpactCoeff * orderSize) / (avgDailyVol * 0.01 + 1);
  const permCostRatio = (permImpactCoeff * orderSize) / (avgDailyVol * 0.01 + 1);

  return (
    <div className="premium-card p-5 flex flex-col space-y-4 select-none">
      <div className="flex items-center justify-between border-b border-[#262C36] pb-3 shrink-0">
        <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase flex items-center gap-2">
          <Activity size={16} className="text-[#2D8C6A]" />
          Execution Cost Analytics
        </h3>
        <span className="text-[10px] text-gray-500 font-mono">Powered by Almgren-Chriss</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Slippage vs Benchmarks */}
        <div className="bg-[#0F1115] p-4 rounded-lg border border-[#262C36] flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            <Zap size={14} className="text-yellow-500" />
            Performance vs Benchmarks
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">Agent Slippage</span>
              <span className={`text-sm font-bold font-mono ${agentShortfall > 0 ? 'text-[#B85A52]' : 'text-[#3FAF7B]'}`}>
                {agentShortfall.toFixed(2)} bps
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">TWAP Slippage</span>
              <span className="text-xs text-gray-500 font-mono">{twapShortfall.toFixed(2)} bps</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">VWAP Slippage</span>
              <span className="text-xs text-gray-500 font-mono">{vwapShortfall.toFixed(2)} bps</span>
            </div>
          </div>
        </div>

        {/* Impact Model Components */}
        <div className="bg-[#0F1115] p-4 rounded-lg border border-[#262C36] flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            <ShieldAlert size={14} className="text-[#3FAF7B]" />
            Impact Breakdown (Estimates)
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Temporary Impact</span>
                <span className="font-mono">{tempCostRatio > 0.01 ? 'High' : 'Low'}</span>
              </div>
              <div className="w-full bg-[#171B22] rounded-full h-1.5">
                <div className="bg-[#3FAF7B] h-1.5 rounded-full" style={{ width: `${Math.min(100, tempCostRatio * 10000)}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Permanent Impact</span>
                <span className="font-mono">{permCostRatio > 0.01 ? 'High' : 'Low'}</span>
              </div>
              <div className="w-full bg-[#171B22] rounded-full h-1.5">
                <div className="bg-[#B85A52] h-1.5 rounded-full" style={{ width: `${Math.min(100, permCostRatio * 10000)}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500">Market Volatility</span>
              <span className="text-xs font-mono text-white">{(annualVol * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* RL Reward Components */}
        <div className="bg-[#0F1115] p-4 rounded-lg border border-[#262C36] flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            <Clock size={14} className="text-blue-500" />
            Agent Reward Drivers
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">Slippage Penalty</span>
              <span className="text-sm font-mono text-[#B85A52]">
                {rewardComponents?.slippage_penalty ? rewardComponents.slippage_penalty.toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">Timing Risk (Urgency)</span>
              <span className="text-sm font-mono text-[#C58B39]">
                {rewardComponents?.urgency_penalty ? rewardComponents.urgency_penalty.toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">Completion Bonus</span>
              <span className={`text-sm font-mono ${rewardComponents?.completion_bonus > 0 ? 'text-[#3FAF7B]' : 'text-gray-500'}`}>
                {rewardComponents?.completion_bonus ? `+${rewardComponents.completion_bonus.toFixed(1)}` : '0.0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
