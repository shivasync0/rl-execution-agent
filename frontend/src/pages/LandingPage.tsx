import { useRef, useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════
   SVG Icon Components
   ═══════════════════════════════════════════════════════ */

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const AISparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const AttachIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const VoiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);


/* ═══════════════════════════════════════════════════════
   Video Background Component (Darkened for institutional vibe)
   ═══════════════════════════════════════════════════════ */

function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const fadingOutRef = useRef(false);

  const cancelAnim = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const fadeIn = useCallback((duration = 250) => {
    cancelAnim();
    fadingOutRef.current = false;
    const video = videoRef.current;
    if (!video) return;
    const start = performance.now();
    const from = parseFloat(video.style.opacity || '0');
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      video.style.opacity = String(from + (0.35 - from) * progress); // Max opacity 35% to keep it institutional
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [cancelAnim]);

  const fadeOut = useCallback((duration = 250) => {
    cancelAnim();
    const video = videoRef.current;
    if (!video) return;
    const start = performance.now();
    const from = parseFloat(video.style.opacity || '0.35');
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      video.style.opacity = String(from - from * progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [cancelAnim]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';

    const handleCanPlay = () => {
      video.play().then(() => fadeIn(250)).catch(() => {});
    };

    const handleTimeUpdate = () => {
      if (!video.duration || fadingOutRef.current) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55) {
        fadingOutRef.current = true;
        fadeOut(250);
      }
    };

    const handleEnded = () => {
      cancelAnim();
      video.style.opacity = '0';
      setTimeout(() => {
        video.currentTime = 0;
        fadingOutRef.current = false;
        video.play().then(() => fadeIn(250)).catch(() => {});
      }, 100);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      cancelAnim();
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [fadeIn, fadeOut, cancelAnim]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      preload="auto"
      style={{
        position: 'fixed',
        inset: 0,
        width: '115%',
        height: '115%',
        left: '50%',
        transform: 'translateX(-50%)',
        objectFit: 'cover',
        objectPosition: 'center top',
        opacity: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <source
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260329_050842_be71947f-f16e-4a14-810c-06e83d23ddb5.mp4"
        type="video/mp4"
      />
    </video>
  );
}


/* ═══════════════════════════════════════════════════════
   Landing Page
   ═══════════════════════════════════════════════════════ */

interface LandingPageProps {
  onEnterDashboard: (pageId?: string, orderSize?: number, steps?: number) => void;
}

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [inputText, setInputText] = useState("Execute 10,000 shares over 20 steps");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLaunch = () => {
    let size: number | undefined = undefined;
    let steps: number | undefined = undefined;

    const numbers = inputText.match(/\d+[\d,.]*/g);
    if (numbers && numbers.length > 0) {
      const clean1 = numbers[0].replace(/,/g, '');
      const parsedVal1 = parseInt(clean1, 10);
      if (!isNaN(parsedVal1) && parsedVal1 > 0) {
        size = parsedVal1;
      }
    }
    if (numbers && numbers.length > 1) {
      const clean2 = numbers[1].replace(/,/g, '');
      const parsedVal2 = parseInt(clean2, 10);
      if (!isNaN(parsedVal2) && parsedVal2 > 0) {
        steps = parsedVal2;
      }
    }

    onEnterDashboard('simulator', size, steps);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#0F1115',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Dark vignette gradient overlay to darken the video background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(15, 17, 21, 0.4) 0%, #0F1115 85%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Video BG */}
      <VideoBackground />
      {/* ━━━ Navigation Bar ━━━ */}
      <nav
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '16px 20px' : '24px 48px',
          gap: '40px',
          maxWidth: '100%',
          boxSizing: 'border-box',
          borderBottom: '1px solid rgba(38, 44, 54, 0.4)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
          }}
          onClick={() => onEnterDashboard()}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D8C6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span
            style={{
              fontFamily: "'Schibsted Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '24px',
              letterSpacing: '-1.2px',
              color: '#F4F5F7',
              whiteSpace: 'nowrap',
            }}
          >
            Exec<span style={{ color: '#2D8C6A' }}>Agent</span>
          </span>
        </div>

        {/* Nav Links */}
        <div
          style={{
            display: isMobile ? 'none' : 'flex',
            alignItems: 'center',
            gap: '24px',
            marginLeft: '40px',
          }}
        >
          {['Live Simulator', 'Training Metrics', 'Agent Inspector', 'Configuration'].map((item) => {
            const pageMap: Record<string, string> = {
              'Live Simulator': 'simulator',
              'Training Metrics': 'dashboard',
              'Agent Inspector': 'inspector',
              'Configuration': 'config'
            };
            return (
              <a
                key={item}
                onClick={() => onEnterDashboard(pageMap[item])}
                style={{
                  fontFamily: "'Schibsted Grotesk', sans-serif",
                  fontWeight: 500,
                  fontSize: '15px',
                  letterSpacing: '-0.2px',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#2D8C6A'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#9CA3AF'; }}
              >
                {item}
              </a>
            );
          })}
          <a
            onClick={() => onEnterDashboard('config')}
            style={{
              fontFamily: "'Schibsted Grotesk', sans-serif",
              fontWeight: 500,
              fontSize: '15px',
              letterSpacing: '-0.2px',
              color: '#9CA3AF',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#2D8C6A'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#9CA3AF'; }}
          >
            Docs
          </a>
        </div>

        {/* Right Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => onEnterDashboard('config')}
            style={{
              fontFamily: "'Schibsted Grotesk', sans-serif",
              fontWeight: 500,
              fontSize: '14px',
              background: 'transparent',
              border: 'none',
              color: '#F4F5F7',
              padding: '8px 16px',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.2s, color 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { 
              const el = e.target as HTMLElement;
              el.style.background = 'rgba(45, 140, 106, 0.1)'; 
              el.style.color = '#2D8C6A';
            }}
            onMouseLeave={(e) => { 
              const el = e.target as HTMLElement;
              el.style.background = 'transparent'; 
              el.style.color = '#F4F5F7';
            }}
          >
            Configure
          </button>
          <button
            onClick={() => onEnterDashboard('simulator')}
            style={{
              fontFamily: "'Schibsted Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              background: 'linear-gradient(135deg, #2D8C6A 0%, #1E6B4E 100%)',
              border: 'none',
              color: '#fff',
              padding: '8px 20px',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(45, 140, 106, 0.2)',
              transition: 'all 0.25s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.transform = 'translateY(-1px)';
              el.style.boxShadow = '0 6px 18px rgba(45, 140, 106, 0.35)';
              el.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = '0 4px 12px rgba(45, 140, 106, 0.2)';
              el.style.filter = 'brightness(1)';
            }}
          >
            Launch Terminal
            <span
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </button>
        </div>
      </nav>

      {/* ━━━ Hero Content ━━━ */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 48px 100px',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        {/* Centered Column: Badge, Title, Subtitle, Search Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '800px',
            width: '100%',
          }}
        >
          {/* ── Badge ── */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #262C36',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              marginBottom: '32px',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2D8C6A',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                padding: '6px 12px',
              }}
            >
              <StarIcon />
              SAC Agent v2.1
            </span>
            <span
              style={{
                background: '#171B22',
                color: '#C58B39', // Brass Gold highlight
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: '13px',
                padding: '6px 16px',
              }}
            >
              Institutional Reinforcement Learning Order Execution
            </span>
          </div>

          {/* ── Headline ── */}
          <h1
            style={{
              fontFamily: "'Fustat', sans-serif",
              fontWeight: 700,
              fontSize: isMobile ? '38px' : '84px',
              letterSpacing: isMobile ? '-1.5px' : '-3px',
              lineHeight: 1.1,
              color: '#F4F5F7',
              textAlign: 'center',
              margin: isMobile ? '0 0 16px 0' : '0 0 28px 0',
            }}
          >
            Intelligent Order Execution
          </h1>

          {/* ── Subtitle ── */}
          <p
            style={{
              fontFamily: "'Fustat', sans-serif",
              fontWeight: 500,
              fontSize: isMobile ? '14px' : '20px',
              letterSpacing: '-0.3px',
              color: '#9CA3AF',
              textAlign: 'center',
              maxWidth: '720px',
              lineHeight: 1.6,
              margin: isMobile ? '0 0 24px 0' : '0 0 44px 0',
            }}
          >
            Simulate, evaluate, and inspect custom neural network agents trained with Soft Actor-Critic (SAC). Minimize execution slippage and market impact under dynamic volatility regimes.
          </p>

          {/* ── Search Input Box ── */}
          <div
            style={{
              width: '100%',
              maxWidth: '728px',
              background: 'rgba(23, 27, 34, 0.75)',
              border: '1px solid #262C36',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '12px',
              padding: '12px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Top credit row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: "'Schibsted Grotesk', sans-serif",
                    fontWeight: 500,
                    fontSize: '12px',
                    color: '#9CA3AF',
                  }}
                >
                  Simulation Model:
                </span>
                <span
                  style={{
                    fontFamily: "'Schibsted Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    background: 'rgba(45, 140, 106, 0.15)',
                    color: '#3FAF7B',
                    border: '1px solid rgba(63, 175, 123, 0.3)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  SAC Policy Loaded
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Schibsted Grotesk', sans-serif",
                  fontWeight: 500,
                  fontSize: '12px',
                  color: '#C58B39', // Gold
                }}
              >
                <AISparkle />
                Powered by PyTorch RL
              </div>
            </div>

            {/* Main input area */}
            <div
              style={{
                background: '#171B22',
                border: '1px solid #262C36',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLaunch();
                  }
                }}
                placeholder={isMobile ? "Enter trade parameters (e.g. 10000 over 20)..." : "Enter trade size, execution window (e.g. Sell 10000 AAPL over 20 steps)..."}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontFamily: "'Noto Sans', sans-serif",
                  fontWeight: 400,
                  fontSize: isMobile ? '13px' : '15px',
                  color: '#F4F5F7',
                  background: 'transparent',
                }}
              />
              <button
                onClick={handleLaunch}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: '#2D8C6A',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.15s, background-color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3FAF7B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2D8C6A'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              </button>
            </div>

            {/* Bottom actions row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 4px 2px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {[
                  { label: 'Asset: GBM/CSV', Icon: AttachIcon },
                  { label: 'Agent Strategy', Icon: VoiceIcon },
                  { label: 'Compare Baselines', Icon: SearchIcon },
                ].map(({ label, Icon }) => (
                  <button
                    key={label}
                    onClick={() => onEnterDashboard('simulator')}
                    style={{
                      fontFamily: "'Schibsted Grotesk', sans-serif",
                      fontWeight: 500,
                      fontSize: '12px',
                      color: '#9CA3AF',
                      background: 'rgba(38, 44, 54, 0.5)',
                      border: '1px solid #262C36',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.borderColor = '#2D8C6A';
                      e.currentTarget.style.color = '#F4F5F7';
                      e.currentTarget.style.background = 'rgba(45, 140, 106, 0.05)';
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.borderColor = '#262C36';
                      e.currentTarget.style.color = '#9CA3AF';
                      e.currentTarget.style.background = 'rgba(38, 44, 54, 0.5)';
                    }}
                  >
                    <Icon />
                    {label}
                  </button>
                ))}
              </div>
              <span
                style={{
                  fontFamily: "'Schibsted Grotesk', sans-serif",
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#9CA3AF',
                  opacity: 0.7,
                }}
              >
                Press Enter to Simulate
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ Section: Slides (Concept Deck) ━━━ */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          boxSizing: 'border-box',
          padding: '0 48px',
        }}
      >
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #262C36 20%, #262C36 80%, transparent)', marginBottom: '80px' }} />
        
        {/* Slide 1: Concept */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '64px' }}
        >
          <div
            style={{
              background: '#171B22',
              border: '1px solid #262C36',
              borderRadius: '16px',
              padding: isMobile ? '20px' : '40px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              gap: '48px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(45, 140, 106, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262C36'; }}
          >
            <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#C58B39', letterSpacing: '1px', fontFamily: "'Schibsted Grotesk', sans-serif", marginBottom: '12px' }}>
                CONCEPT // STAGE 01
              </div>
              <h3 style={{ fontFamily: "'Fustat', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F4F5F7', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Autonomous Execution Agent
              </h3>
              <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'block', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
                What is ExecAgent?
              </span>
              <p style={{ fontFamily: "'Schibsted Grotesk', sans-serif", fontWeight: 400, fontSize: '15px', lineHeight: '1.6', color: '#9CA3AF', margin: 0 }}>
                ExecAgent is an institutional-grade deep reinforcement learning engine built to solve optimal execution problems in high-frequency trading. It dynamically controls execution pace to minimize transaction costs.
              </p>
            </div>
            <div style={{ flex: '1 1 350px', maxWidth: '480px', width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                {[
                  { name: "Algorithm", val: "Soft Actor-Critic" },
                  { name: "Action Space", val: "Continuous [0.0, 2.0]" },
                  { name: "Objective", val: "Slippage Minimization" },
                  { name: "Observation", val: "LOB State & Inventory" },
                ].map((item, idx) => (
                  <div key={idx} style={{ background: '#0F1115', border: '1px solid #262C36', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: "'Schibsted Grotesk', sans-serif" }}>{item.name}</div>
                    <div style={{ fontSize: '13px', color: '#2D8C6A', fontWeight: 600, marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Slide 2: The Challenge */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '64px' }}
        >
          <div
            style={{
              background: '#171B22',
              border: '1px solid #262C36',
              borderRadius: '16px',
              padding: isMobile ? '20px' : '40px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              gap: '48px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(45, 140, 106, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262C36'; }}
          >
            <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#C58B39', letterSpacing: '1px', fontFamily: "'Schibsted Grotesk', sans-serif", marginBottom: '12px' }}>
                THE CHALLENGE // STAGE 02
              </div>
              <h3 style={{ fontFamily: "'Fustat', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F4F5F7', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Mitigating Market Slippage
              </h3>
              <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'block', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
                Why do we need RL?
              </span>
              <p style={{ fontFamily: "'Schibsted Grotesk', sans-serif", fontWeight: 400, fontSize: '15px', lineHeight: '1.6', color: '#9CA3AF', margin: 0 }}>
                Large trades executed via static algorithms (like TWAP/VWAP) are highly predictable and suffer from execution slippage due to market impact and bid-ask spread costs.
              </p>
            </div>
            <div style={{ flex: '1 1 350px', maxWidth: '480px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#0F1115', border: '1px solid #262C36', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                  <span>Average Price Slippage (bps)</span>
                  <span style={{ color: '#3FAF7B', fontWeight: 600 }}>-35.4% vs TWAP</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '40px', fontSize: '10px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>TWAP</span>
                    <div style={{ flex: 1, height: '8px', background: '#262C36', borderRadius: '4px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '85%', background: '#9CA3AF', borderRadius: '4px' }} />
                    </div>
                    <span style={{ width: '30px', fontSize: '10px', color: '#F4F5F7', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>12.4</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '40px', fontSize: '10px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>SAC</span>
                    <div style={{ flex: 1, height: '8px', background: '#262C36', borderRadius: '4px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: '#2D8C6A', borderRadius: '4px' }} />
                    </div>
                    <span style={{ width: '30px', fontSize: '10px', color: '#2D8C6A', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>8.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Slide 3: MDP Formulation */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '64px' }}
        >
          <div
            style={{
              background: '#171B22',
              border: '1px solid #262C36',
              borderRadius: '16px',
              padding: isMobile ? '20px' : '40px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              gap: '48px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(45, 140, 106, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262C36'; }}
          >
            <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#C58B39', letterSpacing: '1px', fontFamily: "'Schibsted Grotesk', sans-serif", marginBottom: '12px' }}>
                MDP FORMULATION // STAGE 03
              </div>
              <h3 style={{ fontFamily: "'Fustat', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F4F5F7', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Markov Decision Process (MDP)
              </h3>
              <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'block', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
                State Observations & Rewards
              </span>
              <p style={{ fontFamily: "'Schibsted Grotesk', sans-serif", fontWeight: 400, fontSize: '15px', lineHeight: '1.6', color: '#9CA3AF', margin: 0 }}>
                The agent observes a structured feature space at each time step t and receives feedback based on execution quality.
              </p>
            </div>
            <div style={{ flex: '1 1 350px', maxWidth: '480px', width: '100%' }}>
              <div style={{ background: '#0F1115', border: '1px solid #262C36', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #262C36', color: '#9CA3AF' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 500 }}>State Feature</th>
                      <th style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'right' }}>Description / Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(38, 44, 54, 0.5)' }}>
                      <td style={{ padding: '8px', color: '#F4F5F7', fontFamily: "'JetBrains Mono', monospace" }}>t / T</td>
                      <td style={{ padding: '8px', color: '#9CA3AF', textAlign: 'right' }}>Time ratio remaining [1.0 ➔ 0.0]</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(38, 44, 54, 0.5)' }}>
                      <td style={{ padding: '8px', color: '#F4F5F7', fontFamily: "'JetBrains Mono', monospace" }}>q_t / Q</td>
                      <td style={{ padding: '8px', color: '#9CA3AF', textAlign: 'right' }}>Inventory ratio remaining [1.0 ➔ 0.0]</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', color: '#F4F5F7', fontFamily: "'JetBrains Mono', monospace" }}>spread_bps</td>
                      <td style={{ padding: '8px', color: '#9CA3AF', textAlign: 'right' }}>Bid-ask spread size in basis points</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Slide 4: Quantitative Stack */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '64px' }}
        >
          <div
            style={{
              background: '#171B22',
              border: '1px solid #262C36',
              borderRadius: '16px',
              padding: isMobile ? '20px' : '40px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              gap: '48px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(45, 140, 106, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262C36'; }}
          >
            <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#C58B39', letterSpacing: '1px', fontFamily: "'Schibsted Grotesk', sans-serif", marginBottom: '12px' }}>
                ARCHITECTURE // STAGE 04
              </div>
              <h3 style={{ fontFamily: "'Fustat', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F4F5F7', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Production-Grade Architecture
              </h3>
              <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'block', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
                End-to-End Execution Pipeline
              </span>
              <p style={{ fontFamily: "'Schibsted Grotesk', sans-serif", fontWeight: 400, fontSize: '15px', lineHeight: '1.6', color: '#9CA3AF', margin: 0 }}>
                Built with a modern, high-throughput tech stack that bridges frontend interaction with real-time PyTorch model inference.
              </p>
            </div>
            <div style={{ flex: '1 1 350px', maxWidth: '480px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0F1115', border: '1px solid #262C36', borderRadius: '12px', padding: '16px 20px' }}>
                {[
                  { label: "React UI", bg: "rgba(45, 140, 106, 0.1)", border: "rgba(45, 140, 106, 0.3)", text: "#3FAF7B" },
                  { label: "FastAPI", bg: "rgba(197, 139, 57, 0.1)", border: "rgba(197, 139, 57, 0.3)", text: "#C58B39" },
                  { label: "PyTorch", bg: "rgba(184, 90, 82, 0.1)", border: "rgba(184, 90, 82, 0.3)", text: "#B85A52" }
                ].map((node, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      background: node.bg,
                      border: `1px solid ${node.border}`,
                      color: node.text,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'center',
                      flex: 1,
                      fontFamily: "'Schibsted Grotesk', sans-serif"
                    }}>
                      {node.label}
                    </div>
                    {i < 2 && (
                      <div style={{
                        width: '20px',
                        height: '1px',
                        background: '#262C36',
                        position: 'relative',
                        margin: '0 6px'
                      }}>
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: '-2.5px',
                          width: '0',
                          height: '0',
                          borderTop: '3px solid transparent',
                          borderBottom: '3px solid transparent',
                          borderLeft: '4px solid #262C36'
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ Section 2: Features Grid ━━━ */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          padding: '80px 48px',
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #262C36 20%, #262C36 80%, transparent)', marginBottom: '64px' }} />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', marginBottom: '48px' }}
        >
          <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
            EXECUTIVE ADVANTAGES
          </span>
          <h2 style={{ fontFamily: "'Fustat', sans-serif", fontSize: '36px', fontWeight: 700, color: '#F4F5F7', marginTop: '8px', letterSpacing: '-1px' }}>
            Engineered for Quantitative Performance
          </h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {[
            {
              title: "Order Book Imbalance",
              desc: "Monitors the ratio of bid/ask depth in real time. Executes aggressively during high buy-pressure and pauses during sell-offs to save ticks.",
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D8C6A" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
              )
            },
            {
              title: "Risk-Averse Policy Tuning",
              desc: "Allows desk managers to configure a custom risk penalty parameter (η) to trade off execution speed against short-term price variance.",
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C58B39" strokeWidth="2">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M12 6v6l4 2" />
                </svg>
              )
            },
            {
              title: "High-Frequency Simulator",
              desc: "Simulate runs over standard Geometric Brownian Motion or upload historical L3 order book CSV logs for detailed offline backtesting.",
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B85A52" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              )
            }
          ].map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: '#171B22',
                border: '1px solid #262C36',
                borderRadius: '12px',
                padding: '28px',
                boxSizing: 'border-box',
                transition: 'border-color 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(45, 140, 106, 0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262C36'; }}
            >
              <div style={{ marginBottom: '16px' }}>{feat.icon}</div>
              <h4 style={{ fontFamily: "'Fustat', sans-serif", fontSize: '18px', fontWeight: 600, color: '#F4F5F7', margin: '0 0 8px 0' }}>
                {feat.title}
              </h4>
              <p style={{ fontFamily: "'Schibsted Grotesk', sans-serif", fontSize: '14px', lineHeight: '1.5', color: '#9CA3AF', margin: 0 }}>
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ━━━ Section 3: Performance Regime Grid ━━━ */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          padding: '0 48px 100px',
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: '#171B22',
            border: '1px solid #262C36',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '40px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#2D8C6A', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
                BENCHMARK COMPARISONS
              </span>
              <h3 style={{ fontFamily: "'Fustat', sans-serif", fontSize: '28px', fontWeight: 700, color: '#F4F5F7', marginTop: '6px', letterSpacing: '-0.5px', margin: 0 }}>
                Average Implementation Shortfall (bps)
              </h3>
            </div>
            <button
              onClick={() => onEnterDashboard('simulator')}
              style={{
                fontFamily: "'Schibsted Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: '14px',
                background: 'rgba(45, 140, 106, 0.1)',
                border: '1px solid rgba(45, 140, 106, 0.3)',
                color: '#2D8C6A',
                padding: '10px 20px',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2D8C6A';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(45, 140, 106, 0.1)';
                e.currentTarget.style.color = '#2D8C6A';
              }}
            >
              Run Benchmark Simulator
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #262C36', color: '#9CA3AF' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>VOLATILITY REGIME</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#2D8C6A' }}>SAC AGENT (OURS)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>TWAP BASELINE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>VWAP BASELINE</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(38, 44, 54, 0.5)' }}>
                  <td style={{ padding: '16px', color: '#F4F5F7', fontWeight: 500 }}>Low Volatility Regime</td>
                  <td style={{ padding: '16px', color: '#3FAF7B', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>1.8 bps</td>
                  <td style={{ padding: '16px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>3.2 bps</td>
                  <td style={{ padding: '16px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>2.8 bps</td>
                </tr>
                <tr>
                  <td style={{ padding: '16px', color: '#F4F5F7', fontWeight: 500 }}>High Volatility Regime</td>
                  <td style={{ padding: '16px', color: '#3FAF7B', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>4.6 bps</td>
                  <td style={{ padding: '16px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>7.6 bps</td>
                  <td style={{ padding: '16px', color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>6.8 bps</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

