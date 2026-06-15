export interface TradeLog {
  step: number;
  qty: number;
  fill_price: number;
  slippage_bps: number;
}

interface OrderBlotterProps {
  trades: TradeLog[];
  selectedStep: number | null;
  onSelectStep: (step: number | null) => void;
}

export default function OrderBlotter({ trades = [], selectedStep, onSelectStep }: OrderBlotterProps) {
  return (
    <div className="premium-card p-5 flex flex-col h-[300px] select-none">
      <div className="flex items-center justify-between border-b border-[#262C36] pb-3 mb-3 shrink-0">
        <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
          Order Blotter
        </h3>
        <span className="text-xs text-gray-500 font-medium font-sans">
          {trades.length} {trades.length === 1 ? 'Fill' : 'Fills'}
        </span>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-4 text-right text-[10px] font-bold text-gray-500 tracking-wider uppercase py-2 px-3 shrink-0 border-b border-[#262C36]">
        <span className="text-left">Step</span>
        <span>Quantity</span>
        <span>Fill Price</span>
        <span>Slippage</span>
      </div>

      {/* Scrollable Trades List */}
      <div className="flex-1 overflow-y-auto font-mono-tabular text-xs py-1">
        {trades.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 font-sans text-xs italic">
            No trades executed in this episode yet.
          </div>
        ) : (
          <div className="space-y-0.5">
            {trades.map((trade, idx) => {
              const isSelected = selectedStep === trade.step;
              const isEven = idx % 2 === 0;
              
              return (
                <div
                  key={`trade-${trade.step}`}
                  onClick={() => onSelectStep(isSelected ? null : trade.step)}
                  className={`grid grid-cols-4 items-center py-2 px-3 rounded cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? 'bg-[#2D8C6A]/20 border border-[#2D8C6A]/50 text-white font-semibold' 
                      : isEven 
                        ? 'bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(255,255,255,0.04)] text-gray-300' 
                        : 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)] text-gray-300'
                  }`}
                >
                  <span className="text-left font-semibold text-[#2D8C6A]">
                    Step {trade.step}
                  </span>
                  <span className="text-right">
                    {trade.qty.toLocaleString()}
                  </span>
                  <span className="text-right">
                    ${trade.fill_price.toFixed(2)}
                  </span>
                  <span 
                    className={`text-right font-medium ${
                      trade.slippage_bps > 0 
                        ? 'text-[#B85A52]' 
                        : trade.slippage_bps < 0 
                          ? 'text-[#3FAF7B]' 
                          : 'text-gray-400'
                    }`}
                  >
                    {trade.slippage_bps > 0 ? '+' : ''}
                    {trade.slippage_bps.toFixed(1)} bps
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
