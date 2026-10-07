"""
Market Data API Endpoints

New REST and WebSocket endpoints for:
  - Fetching available symbols and their metadata
  - Getting real-time market snapshots
  - Streaming live market data
  - Configuring data sources
  - Running episodes with real market data
"""

import os
import json
import time
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import numpy as np

from market_data.provider import DataProvider, BaseMarketDataProvider
from market_data.impact_model import AlmgrenChrissModel

# Lazy-load Yahoo provider to avoid import errors if yfinance not installed
_yahoo_provider: Optional[BaseMarketDataProvider] = None
_provider_available: dict[str, bool] = {}


def get_yahoo_provider() -> Optional[BaseMarketDataProvider]:
    """Lazy-initialize the Yahoo Finance provider."""
    global _yahoo_provider, _provider_available

    if "yahoo" not in _provider_available:
        try:
            from market_data.yahoo_provider import YahooFinanceProvider
            _yahoo_provider = YahooFinanceProvider()
            _provider_available["yahoo"] = True
            print("[MarketData] Yahoo Finance provider initialized.")
        except ImportError as e:
            _provider_available["yahoo"] = False
            print(f"[MarketData] Yahoo Finance not available: {e}")
            print("[MarketData] Install with: pip install yfinance")

    return _yahoo_provider


def get_provider(provider_name: str = "yahoo") -> Optional[BaseMarketDataProvider]:
    """Get a data provider by name."""
    if provider_name == "yahoo":
        return get_yahoo_provider()
    return None


router = APIRouter(prefix="/market", tags=["Market Data"])


# --- Data Models ---

class SymbolInfo(BaseModel):
    symbol: str
    name: str = ""
    price: float = 0.0
    change_pct: float = 0.0
    volume: int = 0
    avg_daily_volume: float = 0.0
    annual_volatility: float = 0.0


class MarketSnapshot(BaseModel):
    symbol: str
    mid_price: float
    spread_bps: float
    imbalance: float
    bids: list[dict]
    asks: list[dict]
    volume_today: int = 0
    timestamp: float = 0.0
    data_source: str = "simulated"


class ImpactEstimate(BaseModel):
    symbol: str
    order_size: int
    horizon: int
    estimated_cost_bps: float
    optimal_trajectory: list[float]
    impact_model_params: dict


class DataSourceStatus(BaseModel):
    yahoo_available: bool
    alpaca_available: bool
    active_provider: str
    cached_symbols: list[str]


# --- Endpoints ---

@router.get("/status", response_model=DataSourceStatus)
def get_data_source_status():
    """Check which market data providers are available."""
    provider = get_yahoo_provider()
    return DataSourceStatus(
        yahoo_available=_provider_available.get("yahoo", False),
        alpaca_available=False,  # Future: Alpaca integration
        active_provider="yahoo" if provider else "simulated",
        cached_symbols=list(provider._cache.keys()) if provider and hasattr(provider, "_cache") else [],
    )


@router.get("/symbols", response_model=list[SymbolInfo])
def list_symbols():
    """List available symbols with basic market info."""
    provider = get_yahoo_provider()
    if not provider:
        # Return default list without live data
        return [
            SymbolInfo(symbol=s)
            for s in ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "SPY", "QQQ"]
        ]

    symbols = provider.get_supported_symbols()
    results = []

    for sym in symbols:
        info = SymbolInfo(symbol=sym)
        try:
            import yfinance as yf
            ticker = yf.Ticker(sym)
            fast_info = ticker.fast_info
            info.price = float(getattr(fast_info, "last_price", 0) or 0)
            info.volume = int(getattr(fast_info, "last_volume", 0) or 0)
            # Market cap can help identify name
            hist = ticker.info
            info.name = hist.get("shortName", sym)
            info.avg_daily_volume = float(hist.get("averageDailyVolume10Day", 0) or 0)
        except Exception:
            pass
        results.append(info)

    return results


@router.get("/snapshot/{symbol}", response_model=MarketSnapshot)
def get_market_snapshot(symbol: str):
    """Get a real-time market snapshot for a symbol."""
    provider = get_yahoo_provider()

    if provider:
        try:
            bundle = provider.build_episode_data(
                symbol=symbol.upper(), horizon=5, order_size=1000
            )
            ob = bundle.order_book_snapshots[-1]
            return MarketSnapshot(
                symbol=symbol.upper(),
                mid_price=ob.mid_price,
                spread_bps=ob.spread_bps,
                imbalance=ob.imbalance,
                bids=[{"price": l.price, "size": l.size} for l in ob.bids],
                asks=[{"price": l.price, "size": l.size} for l in ob.asks],
                volume_today=int(np.sum(bundle.volumes)),
                timestamp=time.time(),
                data_source="yahoo",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {e}")
    else:
        # Simulated snapshot
        mid = 100.0
        spread = 0.05
        return MarketSnapshot(
            symbol=symbol.upper(),
            mid_price=mid,
            spread_bps=5.0,
            imbalance=0.0,
            bids=[{"price": round(mid - spread/2 - i*0.01, 2), "size": 1000 + i*100} for i in range(5)],
            asks=[{"price": round(mid + spread/2 + i*0.01, 2), "size": 1000 + i*100} for i in range(5)],
            timestamp=time.time(),
            data_source="simulated",
        )


@router.get("/impact-estimate/{symbol}", response_model=ImpactEstimate)
def estimate_impact(
    symbol: str,
    order_size: int = Query(default=10000, ge=100, le=1000000),
    horizon: int = Query(default=20, ge=5, le=100),
):
    """
    Estimate the market impact cost for executing an order using
    the Almgren-Chriss model calibrated to the stock's real ADV and volatility.
    """
    provider = get_yahoo_provider()
    mid_price = 100.0
    adv = 5_000_000.0
    annual_vol = 0.25

    if provider:
        try:
            bundle = provider.build_episode_data(
                symbol=symbol.upper(), horizon=horizon, order_size=order_size
            )
            mid_price = bundle.initial_price
            adv = bundle.avg_daily_volume
            annual_vol = bundle.volatility_annual
        except Exception:
            pass

    # Calibrate impact model
    model = AlmgrenChrissModel.calibrate(
        mid_price=mid_price,
        avg_daily_volume=adv,
        annual_volatility=annual_vol,
        horizon_steps=horizon,
    )

    # Estimate total cost
    spread = (5.0 / 10000.0) * mid_price  # ~5 bps spread assumption
    total_cost_bps = model.execution_cost_bps(
        shares_traded=order_size,
        mid_price=mid_price,
        spread=spread,
        arrival_price=mid_price,
    )

    # Compute optimal trajectory
    trajectory = model.optimal_trajectory(order_size, horizon, mid_price)

    return ImpactEstimate(
        symbol=symbol.upper(),
        order_size=order_size,
        horizon=horizon,
        estimated_cost_bps=float(total_cost_bps),
        optimal_trajectory=[float(x) for x in trajectory],
        impact_model_params=model.to_dict(),
    )


@router.get("/price-history/{symbol}")
def get_price_history(
    symbol: str,
    bars: int = Query(default=100, ge=10, le=500),
    interval: str = Query(default="5m"),
):
    """Get recent price history for a symbol (for charts)."""
    provider = get_yahoo_provider()
    if not provider:
        # Return simulated price path
        prices = [100.0]
        for _ in range(bars - 1):
            prices.append(prices[-1] * np.exp(np.random.normal(0, 0.001)))
        return {
            "symbol": symbol.upper(),
            "interval": interval,
            "data_source": "simulated",
            "bars": [
                {"timestamp": time.time() - (bars - i) * 60, "close": p, "volume": 10000}
                for i, p in enumerate(prices)
            ],
        }

    try:
        raw_bars = provider.get_historical_bars(symbol.upper(), num_bars=bars, interval=interval)
        return {
            "symbol": symbol.upper(),
            "interval": interval,
            "data_source": "yahoo",
            "bars": [
                {
                    "timestamp": b.timestamp,
                    "open": b.open,
                    "high": b.high,
                    "low": b.low,
                    "close": b.close,
                    "volume": b.volume,
                }
                for b in raw_bars
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch price history: {e}")


@router.get("/volume-profile/{symbol}")
def get_volume_profile(
    symbol: str,
    horizon: int = Query(default=20, ge=5, le=100),
):
    """
    Get the real intraday volume profile for a symbol.
    Used to calibrate the VWAP baseline with actual market volume patterns.
    """
    provider = get_yahoo_provider()
    if not provider:
        # Synthetic U-shaped profile
        profile = np.zeros(horizon)
        for t in range(horizon):
            profile[t] = (t - horizon/2.0)**2
        profile = profile / np.sum(profile)
        return {
            "symbol": symbol.upper(),
            "data_source": "simulated",
            "profile": [float(x) for x in profile],
        }

    try:
        bundle = provider.build_episode_data(
            symbol=symbol.upper(), horizon=horizon, order_size=10000
        )
        profile = bundle.volume_profile()
        return {
            "symbol": symbol.upper(),
            "data_source": "yahoo",
            "profile": [float(x) for x in profile],
            "raw_volumes": [float(x) for x in bundle.volumes],
            "avg_daily_volume": bundle.avg_daily_volume,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch volume profile: {e}")
