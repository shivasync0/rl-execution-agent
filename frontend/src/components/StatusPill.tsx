export type StatusType = 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';

interface StatusPillProps {
  status: StatusType;
}

export default function StatusPill({ status }: StatusPillProps) {
  const styles = {
    IDLE: {
      bg: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
      dot: 'bg-gray-500',
      pulse: ''
    },
    RUNNING: {
      bg: 'bg-[#2D8C6A]/10 border-[#2D8C6A]/20 text-[#2D8C6A]',
      dot: 'bg-[#2D8C6A]',
      pulse: 'running-pulse'
    },
    COMPLETE: {
      bg: 'bg-[#3FAF7B]/10 border-[#3FAF7B]/20 text-[#3FAF7B]',
      dot: 'bg-[#3FAF7B]',
      pulse: ''
    },
    FAILED: {
      bg: 'bg-[#B85A52]/10 border-[#B85A52]/20 text-[#B85A52]',
      dot: 'bg-[#B85A52]',
      pulse: ''
    }
  };

  const currentStyle = styles[status] || styles.IDLE;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 border rounded-full text-xs font-semibold select-none ${currentStyle.bg}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentStyle.dot} ${currentStyle.pulse}`} />
      <span className="tracking-wider">{status}</span>
    </div>
  );
}
