import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  isMono?: boolean;
  delta?: number; // delta in bps or percent
  deltaSuffix?: string;
  lowerIsBetter?: boolean;
}

export default function MetricCard({ 
  label, 
  value, 
  isMono = true, 
  delta, 
  deltaSuffix = ' bps',
  lowerIsBetter = true
}: MetricCardProps) {
  
  const renderDelta = () => {
    if (delta === undefined || delta === 0) return null;
    
    // Determine if the change is "good" or "bad"
    const isGood = lowerIsBetter ? delta < 0 : delta > 0;
    
    return (
      <div 
        className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold ${
          isGood 
            ? 'bg-[#3FAF7B]/10 text-[#3FAF7B]' 
            : 'bg-[#B85A52]/10 text-[#B85A52]'
        }`}
      >
        {isGood ? (
          <ArrowDownRight size={14} className="shrink-0" />
        ) : (
          <ArrowUpRight size={14} className="shrink-0" />
        )}
        <span className="font-mono-tabular">
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{deltaSuffix}
        </span>
      </div>
    );
  };

  return (
    <div className="premium-card p-5 flex flex-col justify-between h-32 select-none">
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
          {label}
        </span>
        {renderDelta()}
      </div>
      <div className="mt-2 text-right">
        <span 
          className={`text-2.5xl sm:text-3xl font-semibold text-white tracking-tight ${
            isMono ? 'font-mono-tabular' : 'font-sans'
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
