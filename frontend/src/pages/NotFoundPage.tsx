import { useState } from 'react';
import './NotFoundPage.css';

interface NotFoundPageProps {
  onGoHome: () => void;
  onGoSimulator: () => void;
}

export default function NotFoundPage({ onGoHome, onGoSimulator }: NotFoundPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="notfound-page">
      {/* ━━━ Navbar ━━━ */}
      <nav className="nf-navbar">
        {/* Logo */}
        <div className="nf-logo" onClick={onGoHome}>
          <div className="nf-logo-icon">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div className="nf-logo-text">
            Exec<span>Agent</span>
          </div>
        </div>

        {/* Nav Links (Desktop) */}
        <ul className="nf-nav-links">
          <li><a onClick={onGoSimulator}>Simulator</a></li>
          <li><a onClick={onGoHome}>Dashboard &#8964;</a></li>
          <li><a onClick={onGoHome}>Inspector</a></li>
          <li><a onClick={onGoHome}>Overview</a></li>
        </ul>

        {/* CTA Button (Desktop) */}
        <button className="nf-cta-btn" onClick={onGoSimulator}>
          <span className="nf-cta-arrow">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          Launch Simulator
        </button>

        {/* Hamburger (Mobile) */}
        <button
          className={`nf-hamburger ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* ━━━ Mobile Nav Overlay ━━━ */}
      <div className={`nf-mobile-nav ${menuOpen ? 'open' : ''}`}>
        <a onClick={() => { onGoSimulator(); setMenuOpen(false); }}>Simulator</a>
        <a onClick={() => { onGoHome(); setMenuOpen(false); }}>Dashboard</a>
        <a onClick={() => { onGoHome(); setMenuOpen(false); }}>Inspector</a>
        <a onClick={() => { onGoHome(); setMenuOpen(false); }}>Overview</a>
        <button className="nf-cta-btn" onClick={() => { onGoSimulator(); setMenuOpen(false); }}>
          <span className="nf-cta-arrow">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" stroke="white" strokeWidth="2.5" fill="none" width="14" height="14">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          Launch Simulator
        </button>
      </div>

      {/* ━━━ Main Content ━━━ */}
      <main className="nf-main">
        {/* Lost text */}
        <p className="nf-lost-text">Seems you've drifted off course...</p>

        {/* Title with decorations */}
        <div className="nf-title-wrapper">
          {/* Cloud decoration */}
          <span className="nf-cloud-deco material-symbols-rounded">cloud</span>
          {/* Heart decoration */}
          <span className="nf-heart-deco material-symbols-rounded">favorite</span>
          {/* Title */}
          <h1 className="nf-title">Lost in the Market Noise</h1>
        </div>

        {/* Subtext */}
        <p className="nf-subtext">
          This route doesn't exist — but your next optimal{' '}
          <span className="nf-highlight">trade</span>{' '}
          is just one click away. Head back to the simulator to run a live episode, or{' '}
          <span className="nf-highlight">explore</span>{' '}
          the dashboard to review agent performance and training metrics.
        </p>

        {/* Navigation Cards */}
        <div className="nf-cards">
          {/* Card 1 — Simulator */}
          <div className="nf-card" onClick={onGoSimulator}>
            <div className="nf-card-left">
              <div className="nf-card-icon">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" className="filled" />
                </svg>
              </div>
              <div className="nf-card-info">
                <div className="nf-card-title">Live Simulator</div>
                <div className="nf-card-subtitle">Run a fresh execution episode...</div>
              </div>
            </div>
            <span className="nf-card-arrow">&#8250;</span>
          </div>

          {/* Card 2 — Overview */}
          <div className="nf-card" onClick={onGoHome}>
            <div className="nf-card-left">
              <div className="nf-card-icon">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                  <path d="M9 21V12h6v9" stroke="rgba(14,17,28,0.9)" strokeWidth="1.8" />
                </svg>
              </div>
              <div className="nf-card-info">
                <div className="nf-card-title">Back to Overview</div>
                <div className="nf-card-subtitle">Where it all begins...</div>
              </div>
            </div>
            <span className="nf-card-arrow">&#8250;</span>
          </div>
        </div>
      </main>
    </div>
  );
}
