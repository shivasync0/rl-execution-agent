import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, List } from 'lucide-react';
import OrderBookDepthChart from './OrderBookDepthChart';

export interface BookLevel {
  price: number;
  size: number;
}

interface OrderBookProps {
  bids: BookLevel[];
  asks: BookLevel[];
  midPrice: number;
  spreadBps: number;
}

export default function OrderBook({ bids = [], asks = [], midPrice, spreadBps }: OrderBookProps) {
  const [viewMode, setViewMode] = useState<'ladder' | 'chart'>('ladder');

  // Sort asks descending so highest ask is at the top
  const sortedAsks = [...asks].sort((a, b) => b.price - a.price);
  // Sort bids descending so highest bid (best bid) is at the top of bids
  const sortedBids = [...bids].sort((a, b) => b.price - a.price);

  // Calculate maximum size for relative depth bars
  const maxBidSize = bids.length > 0 ? Math.max(...bids.map(b => b.size)) : 1;
  const maxAskSize = asks.length > 0 ? Math.max(...asks.map(a => a.size)) : 1;
  const maxVolume = Math.max(maxBidSize, maxAskSize);

  return (
    <div className="premium-card p-5 flex flex-col h-[480px] overflow-hidden select-none">
      <div className="flex items-center justify-between border-b border-[#262C36] pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
            Live Order Book
          </h3>
          <div className="flex bg-[#0F1115] border border-[#262C36] p-0.5 rounded">
            <button
              onClick={() => setViewMode('ladder')}
              className={`p-1 rounded ${viewMode === 'ladder' ? 'bg-[#2D8C6A] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Ladder View"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`p-1 rounded ${viewMode === 'chart' ? 'bg-[#2D8C6A] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Depth Chart View"
            >
              <BarChart2 size={14} />
            </button>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 font-medium">Spread: </span>
          <span className="text-xs font-mono-tabular text-[#2D8C6A] font-semibold">
            {spreadBps.toFixed(1)} bps
          </span>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="flex-1 w-full mt-2">
          <OrderBookDepthChart bids={bids} asks={asks} midPrice={midPrice} />
        </div>
      ) : (
        <>
          {/* Table Headers */}
          <div className="grid grid-cols-3 text-right text-[10px] font-bold text-gray-500 tracking-wider uppercase py-1 px-2 shrink-0 border-b border-[#262C36]">
            <span className="text-left">Bid Size</span>
            <span className="text-center">Price</span>
            <span>Ask Size</span>
          </div>

      {/* Ladder Container */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col justify-between py-1 font-mono-tabular text-xs">
        {/* Asks (Sells) - Top of ladder */}
        <div className="flex flex-col justify-end flex-1">
          <AnimatePresence initial={false}>
            {sortedAsks.map((ask) => {
              const depthPct = (ask.size / maxVolume) * 100;
              return (
                <motion.div
                  key={`ask-${ask.price}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.1 }}
                  className="grid grid-cols-3 items-center py-1 px-2 relative hover:bg-[rgba(255,255,255,0.02)] group rounded"
                >
                  {/* Depth Bar Background (Ask = Red/Danger) */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-[#B85A52]/8 transition-all duration-300"
                    style={{ width: `${depthPct / 2}%` }}
                  />
                  
                  <span></span>
                  <span className="text-center text-[#B85A52] font-medium group-hover:scale-105 transition-transform">
                    {ask.price.toFixed(2)}
                  </span>
                  <span className="text-right text-gray-300 relative z-10 font-mono-tabular">
                    {ask.size.toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Mid Price & Spread Separator */}
        <div className="my-2 py-2 px-3 border-y border-[#262C36] bg-[rgba(45,140,106,0.02)] flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-sans font-bold">Mid Price</span>
            <span className="text-base font-semibold text-white">
              {midPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-right flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-sans font-bold">Spread Value</span>
            <span className="text-xs text-gray-300 font-semibold">
              ${(spreadBps / 10000 * midPrice).toFixed(3)}
            </span>
          </div>
        </div>

        {/* Bids (Buys) - Bottom of ladder */}
        <div className="flex flex-col flex-1">
          <AnimatePresence initial={false}>
            {sortedBids.map((bid) => {
              const depthPct = (bid.size / maxVolume) * 100;
              return (
                <motion.div
                  key={`bid-${bid.price}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.1 }}
                  className="grid grid-cols-3 items-center py-1 px-2 relative hover:bg-[rgba(255,255,255,0.02)] group rounded"
                >
                  {/* Depth Bar Background (Bid = Emerald/Secondary) */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-[#3FAF7B]/8 transition-all duration-300"
                    style={{ width: `${depthPct / 2}%` }}
                  />

                  <span className="text-left text-gray-300 relative z-10 font-mono-tabular">
                    {bid.size.toLocaleString()}
                  </span>
                  <span className="text-center text-[#3FAF7B] font-medium group-hover:scale-105 transition-transform">
                    {bid.price.toFixed(2)}
                  </span>
                  <span></span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
