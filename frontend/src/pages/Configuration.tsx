import { useState, useEffect } from 'react';
import { Upload, Download, Settings, FileText, CheckCircle, AlertTriangle, TrendingUp, BarChart2, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ConfigurationProps {
  orderSize: number;
  setOrderSize: (size: number) => void;
  horizon: number;
  setHorizon: (steps: number) => void;
  marketImpact: number;
  setMarketImpact: (val: number) => void;
  volatilityRegime: 'low' | 'high';
  setVolatilityRegime: (regime: 'low' | 'high') => void;
  dataSource: 'gbm' | 'csv';
  setDataSource: (source: 'gbm' | 'csv') => void;
  csvFilename: string | null;
  setCsvFilename: (filename: string | null) => void;
  latestEpisodeId: string | null;
  symbol: string;
  setSymbol: (symbol: string) => void;
  useRealData: boolean;
  setUseRealData: (use: boolean) => void;
}

export default function Configuration({
  orderSize,
  setOrderSize,
  horizon,
  setHorizon,
  marketImpact,
  setMarketImpact,
  volatilityRegime,
  setVolatilityRegime,
  dataSource,
  setDataSource,
  csvFilename,
  setCsvFilename,
  latestEpisodeId,
  symbol,
  setSymbol,
  useRealData,
  setUseRealData
}: ConfigurationProps) {
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  // Real data details
  const [symbolDetails, setSymbolDetails] = useState<any | null>(null);
  const [isFetchingSymbol, setIsFetchingSymbol] = useState(false);

  // Fetch real symbol data
  useEffect(() => {
    if (!useRealData || !symbol || symbol.length < 2) {
      setSymbolDetails(null);
      return;
    }

    const fetchSymbolInfo = async () => {
      setIsFetchingSymbol(true);
      try {
        // Fetch all symbols to get the name, price, adv
        const res = await fetch('http://localhost:8000/market/symbols');
        if (res.ok) {
          const symbols = await res.json();
          const match = symbols.find((s: any) => s.symbol === symbol.toUpperCase());
          if (match && match.price > 0) {
            setSymbolDetails(match);
          } else {
            setSymbolDetails(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch symbol info", err);
      }
      setIsFetchingSymbol(false);
    };

    const timeoutId = setTimeout(fetchSymbolInfo, 800);
    return () => clearTimeout(timeoutId);
  }, [symbol, useRealData]);

  // Run a quick client-side mini-simulation to render the live preview execution curve
  useEffect(() => {
    const steps = [];
    let price = 100.0;
    let agentAvg = 100.0;
    let twapAvg = 100.0;
    let agentInv = orderSize;
    let twapInv = orderSize;
    
    const vol = volatilityRegime === 'high' ? 0.25 : 0.10;
    const dt = 1.0 / horizon;
    
    // Simple deterministic seed for preview so it doesn't flicker wildly but changes with sliders
    let seed = 42;
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    steps.push({
      step: 0,
      mid: price,
      agent: price,
      twap: price
    });

    for (let t = 1; t <= horizon; t++) {
      // GBM step
      const z = (pseudoRandom() + pseudoRandom() - 1.0) * 1.5; // simple normal approximation
      const priceReturn = (0.0 - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z;
      price = price * Math.exp(priceReturn);

      // SAC execution (tends to trade slower early on, accelerate later)
      const agentFraction = t === horizon ? 1.0 : Math.pow(t / horizon, 2.0) * 0.25;
      const agentTrade = agentInv * agentFraction;
      agentInv -= agentTrade;
      const agentFill = price + (0.05 / 2.0) * price + marketImpact * (agentTrade / orderSize) * price;
      agentAvg = t === 1 ? agentFill : (agentAvg * (t - 1) + agentFill) / t;

      // TWAP execution (equal chunks)
      const twapTrade = orderSize / horizon;
      twapInv -= twapTrade;
      const twapFill = price + (0.05 / 2.0) * price + marketImpact * (twapTrade / orderSize) * price;
      twapAvg = t === 1 ? twapFill : (twapAvg * (t - 1) + twapFill) / t;

      steps.push({
        step: t,
        mid: price,
        agent: agentAvg,
        twap: twapAvg
      });
    }

    setPreviewData(steps);
  }, [orderSize, horizon, marketImpact, volatilityRegime]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Only CSV files are allowed.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadStatus({ type: 'idle', message: 'Uploading file...' });

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      const resData = await response.json();
      if (response.ok) {
        setCsvFilename(resData.filename);
        setUploadStatus({ 
          type: 'success', 
          message: `Successfully loaded ${resData.filename} (${resData.rows} rows, containing 'price' column).` 
        });
      } else {
        setUploadStatus({ type: 'error', message: resData.detail || 'Failed to upload CSV.' });
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Could not connect to backend server.' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const triggerExport = () => {
    if (!latestEpisodeId) return;
    window.open(`http://localhost:8000/episode/${latestEpisodeId}/export.csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#171B22] border border-[#262C36] rounded-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[#2D8C6A]" />
            <h1 className="text-xl font-display font-bold text-white tracking-wide">Configuration</h1>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Define model variables, select execution policy models, and load historical tick datasets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sliders and Selectors Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="premium-card p-5 space-y-5">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-[rgba(255,255,255,0.07)] pb-3">
              Environment Variables
            </h3>

            {/* Order Size Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#9CA3AF]">
                <span>Total Order Size</span>
                <span className="font-mono-tabular text-[#2D8C6A]">
                  {orderSize.toLocaleString()} shares
                </span>
              </div>
              <input 
                type="range" 
                min={1000} 
                max={100000} 
                step={1000} 
                value={orderSize} 
                onChange={(e) => setOrderSize(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#0F1115] rounded-lg appearance-none cursor-pointer accent-[#2D8C6A]"
              />
            </div>

            {/* Time Horizon Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#9CA3AF]">
                <span>Time Horizon (Steps)</span>
                <span className="font-mono-tabular text-[#2D8C6A]">
                  {horizon} steps
                </span>
              </div>
              <input 
                type="range" 
                min={10} 
                max={60} 
                step={1} 
                value={horizon} 
                onChange={(e) => setHorizon(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#0F1115] rounded-lg appearance-none cursor-pointer accent-[#2D8C6A]"
              />
            </div>

            {/* Market Impact Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#9CA3AF]">
                <span>Market Impact Coefficient</span>
                <span className="font-mono-tabular text-[#2D8C6A]">
                  {marketImpact.toFixed(6)}
                </span>
              </div>
              <input 
                type="range" 
                min={0.00001} 
                max={0.0005} 
                step={0.00001} 
                value={marketImpact} 
                onChange={(e) => setMarketImpact(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#0F1115] rounded-lg appearance-none cursor-pointer accent-[#2D8C6A]"
              />
            </div>

            {/* Volatility Regime */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Volatility Regime
                </span>
                <div className="flex bg-[#0F1115] border border-[#262C36] p-1 rounded">
                  <button
                    onClick={() => setVolatilityRegime('low')}
                    className={`flex-1 py-1.5 rounded font-bold text-xs uppercase transition-all ${
                      volatilityRegime === 'low' ? 'bg-[#3FAF7B]/15 border border-[#3FAF7B]/30 text-[#3FAF7B]' : 'text-[#9CA3AF] hover:text-gray-300'
                    }`}
                  >
                    Low Vol (10%)
                  </button>
                  <button
                    onClick={() => setVolatilityRegime('high')}
                    className={`flex-1 py-1.5 rounded font-bold text-xs uppercase transition-all ${
                      volatilityRegime === 'high' ? 'bg-[#B85A52]/15 border border-[#B85A52]/30 text-[#B85A52]' : 'text-[#9CA3AF] hover:text-gray-300'
                    }`}
                  >
                    High Vol (30%)
                  </button>
                </div>
              </div>

              {/* Data Source Selector */}
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Market Data Source
                </span>
                <div className="flex bg-[#0F1115] border border-[#262C36] p-1 rounded">
                  <button
                    onClick={() => setUseRealData(true)}
                    className={`flex-1 py-1.5 rounded font-bold text-xs uppercase transition-all ${
                      useRealData ? 'bg-[#2D8C6A] text-white' : 'text-[#9CA3AF] hover:text-gray-300'
                    }`}
                  >
                    Yahoo Finance (Real)
                  </button>
                  <button
                    onClick={() => setUseRealData(false)}
                    className={`flex-1 py-1.5 rounded font-bold text-xs uppercase transition-all ${
                      !useRealData ? 'bg-[#2D8C6A] text-white' : 'text-[#9CA3AF] hover:text-gray-300'
                    }`}
                  >
                    Simulated (GBM)
                  </button>
                </div>
              </div>

              {/* Ticker Symbol (only active if Real Data) */}
              <div className="col-span-2 sm:col-span-1 pt-2">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Ticker Symbol
                </span>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  disabled={!useRealData}
                  placeholder="e.g. AAPL"
                  className="w-full bg-[#0F1115] border border-[#262C36] rounded p-2 text-white text-sm focus:outline-none focus:border-[#2D8C6A] disabled:opacity-50 disabled:cursor-not-allowed uppercase font-mono"
                />
              </div>
            </div>

            {/* Realistic Symbol Info Card */}
            {useRealData && symbolDetails && (
              <div className="mt-4 p-4 rounded-lg bg-[#0F1115] border border-[#262C36] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-[#2D8C6A]/20 p-1.5 rounded">
                      <TrendingUp size={16} className="text-[#2D8C6A]" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold tracking-wider">{symbolDetails.symbol}</h4>
                      <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{symbolDetails.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-bold">${symbolDetails.price.toFixed(2)}</div>
                    <div className="text-[10px] text-[#2D8C6A]">Real-Time Snapshot</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      <BarChart2 size={12} />
                      Avg Daily Volume
                    </div>
                    <div className="text-xs text-gray-300 font-mono">
                      {(symbolDetails.avg_daily_volume / 1000000).toFixed(2)}M shares
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      <Activity size={12} />
                      Implied Volatility
                    </div>
                    <div className="text-xs text-gray-300 font-mono">
                      {(volatilityRegime === 'high' ? 0.30 : 0.10 * 100).toFixed(1)}% (Regime)
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {useRealData && isFetchingSymbol && !symbolDetails && (
              <div className="mt-4 p-4 rounded-lg bg-[#0F1115] border border-[#262C36] flex items-center justify-center">
                <span className="text-xs text-gray-500 animate-pulse">Fetching market data...</span>
              </div>
            )}
            
          </div>

          {/* CSV File Upload Section */}
          {dataSource === 'csv' && (
            <div className="premium-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-[rgba(255,255,255,0.07)] pb-3">
                Historical Ticks Dataset
              </h3>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-[#2D8C6A] bg-[#2D8C6A]/5' 
                    : 'border-[#262C36] hover:border-[#2D8C6A]'
                }`}
              >
                <input 
                  type="file" 
                  id="csv-file-input" 
                  className="hidden" 
                  accept=".csv"
                  onChange={handleFileInput}
                />
                <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                  <Upload size={36} className="text-[#9CA3AF] mb-2 hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-gray-300">
                    Drag and drop your tick file, or <span className="text-[#2D8C6A]">browse</span>
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1">
                    Accepts CSV format only. Must contain a column labeled "price".
                  </span>
                </label>
              </div>

              {/* Upload Status indicators */}
              {uploadStatus.type !== 'idle' && (
                <div className={`p-3 rounded-lg flex items-start gap-2.5 text-xs font-medium ${
                  uploadStatus.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-[#10B981]' 
                    : 'bg-red-500/10 border border-red-500/20 text-[#EF4444]'
                }`}>
                  {uploadStatus.type === 'success' ? (
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{uploadStatus.message}</span>
                </div>
              )}

              {csvFilename && uploadStatus.type !== 'error' && (
                <div className="bg-[#0F1115] p-3 rounded border border-[#262C36] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText size={16} className="text-[#2D8C6A]" />
                    <span className="text-[#F4F5F7] font-mono">{csvFilename}</span>
                  </div>
                  <button 
                    onClick={() => { setCsvFilename(null); setUploadStatus({ type: 'idle', message: '' }); }}
                    className="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-wider"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Export Episode Log */}
          <div className="premium-card p-5 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Export Latest Episode Log
              </h3>
              <p className="text-[10px] text-gray-500 max-w-[280px] sm:max-w-sm">
                Download the step-by-step price and execution data for all compared policies of the latest simulated run.
              </p>
            </div>
            <button
              onClick={triggerExport}
              disabled={!latestEpisodeId}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2D8C6A]/10 border border-[#2D8C6A]/20 text-[#2D8C6A] hover:bg-[#2D8C6A] hover:text-white disabled:opacity-40 disabled:hover:bg-[#2D8C6A]/10 disabled:hover:text-[#2D8C6A] disabled:cursor-not-allowed font-semibold rounded-lg text-xs tracking-wider transition-all select-none"
            >
              <Download size={14} />
              <span>EXPORT CSV</span>
            </button>
          </div>
        </div>

        {/* Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="premium-card p-5 h-[400px] flex flex-col">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3 mb-4 shrink-0">
              <h3 className="font-semibold text-white tracking-wider text-sm font-sans uppercase">
                Interactive Curve Preview
              </h3>
              <span className="text-[10px] text-gray-500">Live preview of parameter changes</span>
            </div>

            {/* Small live chart */}
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={previewData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262C36" vertical={false} />
                  <XAxis dataKey="step" stroke="#4B5563" fontSize={9} tickLine={false} />
                  <YAxis stroke="#4B5563" fontSize={9} tickLine={false} domain={['auto', 'auto']} />
                  <Line type="monotone" dataKey="mid" name="Mid Price" stroke="rgba(255,255,255,0.15)" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="agent" name="SAC Agent" stroke="#2D8C6A" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="twap" name="TWAP" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-[10px] text-gray-500 leading-relaxed shrink-0">
              *The preview updates immediately on the client side using a fast mock GBM paths to display the relative fill differences under the current market impact coefficient.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
