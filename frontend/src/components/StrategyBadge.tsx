interface StrategyBadgeProps {
  strategy: 'sac' | 'twap' | 'vwap' | 'random' | string;
}

export default function StrategyBadge({ strategy }: StrategyBadgeProps) {
  const normalized = strategy.toLowerCase();
  
  const styles: Record<string, { bg: string; text: string; label: string; border: string }> = {
    sac: {
      bg: 'bg-[#2D8C6A]/10',
      text: 'text-[#2D8C6A]',
      border: 'border-[#2D8C6A]/20',
      label: 'SAC AGENT'
    },
    twap: {
      bg: 'bg-gray-500/10',
      text: 'text-[#9CA3AF]',
      border: 'border-gray-500/20',
      label: 'TWAP'
    },
    vwap: {
      bg: 'bg-[#C58B39]/10',
      text: 'text-[#C58B39]',
      border: 'border-[#C58B39]/20',
      label: 'VWAP'
    },
    random: {
      bg: 'bg-[#B85A52]/10',
      text: 'text-[#B85A52]',
      border: 'border-[#B85A52]/20',
      label: 'RANDOM'
    }
  };

  const current = styles[normalized] || {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
    label: strategy.toUpperCase()
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 border rounded-md text-[10px] font-bold tracking-wider select-none ${current.bg} ${current.text} ${current.border}`}>
      {current.label}
    </span>
  );
}
