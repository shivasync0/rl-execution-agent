import { useState, useEffect } from 'react';
import { Play, LayoutDashboard, Cpu, Settings } from 'lucide-react';

import Sidebar from './components/Sidebar';
import StatusPill from './components/StatusPill';
import type { StatusType } from './components/StatusPill';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import LiveSimulator from './pages/LiveSimulator';
import TrainingDashboard from './pages/TrainingDashboard';
import AgentInspector from './pages/AgentInspector';
import Configuration from './pages/Configuration';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function App() {
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<string>('simulator');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  
  // Simulation Variables
  const [orderSize, setOrderSize] = useState<number>(10000);
  const [horizon, setHorizon] = useState<number>(20);
  const [marketImpact, setMarketImpact] = useState<number>(0.0001);
  const [volatilityRegime, setVolatilityRegime] = useState<'low' | 'high'>('low');
  const [dataSource, setDataSource] = useState<'gbm' | 'csv'>('gbm');
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [useRealData, setUseRealData] = useState<boolean>(true);

  // Live Simulation state
  const [status, setStatus] = useState<StatusType>('IDLE');
  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [latestEpisodeId, setLatestEpisodeId] = useState<string | null>(null);
  const [activeSimulationStrategy, setActiveSimulationStrategy] = useState<'sac' | 'twap' | 'vwap' | 'random'>('sac');

  // Training metrics stats state
  const [stats, setStats] = useState<any>(null);

  // Fetch training stats from Python FastAPI backend on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/training-stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error("Failed to load training stats from API");
        }
      } catch (err) {
        console.error("Could not connect to backend to fetch training stats:", err);
      }
    };
    
    // Attempt fetch, but also schedule poll in case backend is still starting up
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Run Episode WebSocket triggers
  const runEpisode = () => {
    if (status === 'RUNNING') return;

    setStatus('RUNNING');
    setSteps([]);
    setSelectedStep(null);

    const ws = new WebSocket(`${WS_URL}/ws/episode`);

    ws.onopen = () => {
      // Send parameters payload
      const payload = {
        order_size: orderSize,
        horizon: horizon,
        market_impact: marketImpact,
        volatility_regime: volatilityRegime,
        csv_filename: dataSource === 'csv' ? csvFilename : null,
        symbol: symbol,
        use_real_data: useRealData
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error("WebSocket server error:", data.error);
          setStatus('FAILED');
          ws.close();
          return;
        }

        // Add step to list
        setSteps((prevSteps) => {
          const newSteps = [...prevSteps, data];
          // If we reached the final step, mark as complete
          if (data.step >= data.horizon) {
            setStatus('COMPLETE');
            setLatestEpisodeId(data.episode_id);
            ws.close();
          }
          return newSteps;
        });

      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus('FAILED');
    };

    ws.onclose = () => {
      setStatus((currentStatus) => {
        if (currentStatus === 'RUNNING') {
          return 'FAILED';
        }
        return currentStatus;
      });
    };
  };

  const resetEpisode = () => {
    setSteps([]);
    setStatus('IDLE');
    setSelectedStep(null);
    setLatestEpisodeId(null);
  };

  // If landing page is active, render it
  if (showLanding) {
    return (
      <LandingPage 
        onEnterDashboard={(pageId?: string, size?: number, steps?: number) => {
          setShowLanding(false);
          if (pageId) {
            setActivePage(pageId);
          }
          if (size) {
            setOrderSize(size);
          }
          if (steps) {
            setHorizon(steps);
          }
        }} 
      />
    );
  }



  const renderPage = () => {
    switch (activePage) {
      case 'simulator':
        return (
          <LiveSimulator
            status={status}
            steps={steps}
            runEpisode={runEpisode}
            resetEpisode={resetEpisode}
            activeStrategy={activeSimulationStrategy}
            setActiveStrategy={setActiveSimulationStrategy}
            selectedStep={selectedStep}
            setSelectedStep={setSelectedStep}
            symbol={symbol}
            useRealData={useRealData}
          />
        );
      case 'dashboard':
        return <TrainingDashboard stats={stats} />;
      case 'inspector':
        return (
          <AgentInspector
            steps={steps}
            selectedStep={selectedStep}
            stats={stats}
          />
        );
      case 'config':
        return (
          <Configuration
            orderSize={orderSize}
            setOrderSize={setOrderSize}
            horizon={horizon}
            setHorizon={setHorizon}
            marketImpact={marketImpact}
            setMarketImpact={setMarketImpact}
            volatilityRegime={volatilityRegime}
            setVolatilityRegime={setVolatilityRegime}
            dataSource={dataSource}
            setDataSource={setDataSource}
            csvFilename={csvFilename}
            setCsvFilename={setCsvFilename}
            latestEpisodeId={latestEpisodeId}
            symbol={symbol}
            setSymbol={setSymbol}
            useRealData={useRealData}
            setUseRealData={setUseRealData}
          />
        );
      default:
        return (
          <NotFoundPage
            onGoHome={() => setShowLanding(true)}
            onGoSimulator={() => setActivePage('simulator')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-row">
      {/* Expandable Sidebar */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded} 
      />

      {/* Main Content Pane */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarExpanded ? 'pl-0 md:pl-[220px]' : 'pl-0 md:pl-[64px]'}`}>
        {/* Top Header */}
        <header className="h-14 border-b border-[#262C36] px-4 md:px-6 flex items-center justify-between shrink-0 bg-[#171B22]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Back to Landing */}
            <button
              onClick={() => setShowLanding(true)}
              className="text-xs text-gray-400 hover:text-[#2D8C6A] transition-colors flex items-center gap-1.5 font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Overview
            </button>
            <div className="w-px h-5 bg-[#262C36]" />
            <span className="text-xs font-medium text-gray-500">
              Execution Control Center
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <StatusPill status={status} />

            {/* Config quick badges */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#0F1115] border border-[#262C36] rounded-lg text-[10px] font-semibold text-[#9CA3AF] font-mono-tabular">
              <span>SIZE: {orderSize.toLocaleString()}</span>
              <span className="text-gray-700">·</span>
              <span>STEPS: {horizon}</span>
              <span className="text-gray-700">·</span>
              <span>IMPACT: {marketImpact.toFixed(5)}</span>
            </div>

            {/* GitHub Link */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 border border-[#262C36] hover:border-[#2D8C6A] rounded-lg hover:bg-[#171B22] text-[#9CA3AF] hover:text-white transition-all flex items-center justify-center"
              title="GitHub Repository"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-3 md:p-6 max-w-[1400px] mx-auto pb-24 md:pb-16">
          {renderPage()}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#171B22]/95 backdrop-blur-xl border-t border-[#262C36] flex md:hidden items-center justify-around z-30 px-2 pb-safe shadow-lg">
          {[
            { id: 'simulator', label: 'Simulator', icon: Play },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'inspector', label: 'Inspector', icon: Cpu },
            { id: 'config', label: 'Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 ${
                  isActive ? 'text-[#2D8C6A]' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={18} className="mb-0.5" />
                <span className="text-[10px] font-medium tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
