"""
Yahoo Finance Market Data Provider

Uses yfinance to fetch real historical intraday data for US equities.
Reconstructs realistic order book snapshots from OHLCV bar data.
Provides real volume profiles and volatility estimates.

Free, no API key required. Limited to last 7 days for 1-minute data,
or last 60 days for 5-minute data.
"""

import time
import numpy as np
import pandas as pd
from typing import Optional
from datetime import datetime, timedelta

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

from .provider import (
    BaseMarketDataProvider, DataProvider, MarketBar,
    MarketDataBundle, OrderBookSnapshot, OrderBookLevel
)


class YahooFinanceProvider(BaseMarketDataProvider):
    """
    Fetches real historical intraday data from Yahoo Finance via yfinance.
    Reconstructs order books from OHLCV data using statistical modeling.
    """

    # Popular US equities with high liquidity
    DEFAULT_SYMBOLS = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
        "NVDA", "META", "JPM", "V", "JNJ",
        "SPY", "QQQ", "IWM"
    ]

    def __init__(self, cache_dir: Optional[str] = None):
        if not HAS_YFINANCE:
            raise ImportError(
                "yfinance is required for Yahoo Finance data. "
                "Install it with: pip install yfinance"
            )
        self._cache: dict[str, pd.DataFrame] = {}
        self._cache_dir = cache_dir

    @property
    def provider_name(self) -> DataProvider:
        return DataProvider.YAHOO

    def get_supported_symbols(self) -> list[str]:
        return self.DEFAULT_SYMBOLS

    def get_historical_bars(
        self,
        symbol: str,
        num_bars: int,
        interval: str = "1m",
    ) -> list[MarketBar]:
        """Fetch historical OHLCV bars from Yahoo Finance."""
        cache_key = f"{symbol}_{interval}"

        if cache_key not in self._cache:
            # For 1m data, Yahoo allows last 7 days
            # For 5m data, last 60 days
            if interval == "1m":
                period = "5d"
            elif interval == "5m":
                period = "60d"
            else:
                period = "1mo"

            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(period=period, interval=interval)

                if df.empty:
                    raise ValueError(f"No data returned for {symbol}")

                # Clean data: drop NaN rows, reset index
                df = df.dropna(subset=["Close", "Volume"])
                df = df[df["Volume"] > 0]  # Remove zero-volume bars

                self._cache[cache_key] = df
            except Exception as e:
                raise RuntimeError(f"Failed to fetch data for {symbol}: {e}")

        df = self._cache[cache_key]

        # If we have more bars than needed, randomly sample a contiguous window
        if len(df) > num_bars:
            max_start = len(df) - num_bars
            start_idx = np.random.randint(0, max_start)
            df_window = df.iloc[start_idx : start_idx + num_bars]
        else:
            df_window = df.tail(num_bars)

        bars = []
        for idx, row in df_window.iterrows():
            ts = idx.timestamp() if hasattr(idx, "timestamp") else time.time()
            bars.append(MarketBar(
                timestamp=ts,
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=int(row["Volume"]),
            ))

        return bars

    def _estimate_daily_volume(self, symbol: str) -> float:
        """Estimate average daily volume from recent data."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            adv = info.get("averageDailyVolume10Day", info.get("averageVolume", 5_000_000))
            return float(adv)
        except Exception:
            return 5_000_000.0  # Reasonable default for large-cap

    def _estimate_volatility(self, prices: np.ndarray) -> tuple[float, float]:
        """
        Estimate annualized and per-step volatility from a price series.
        Returns (annualized_vol, per_step_vol).
        """
        if len(prices) < 3:
            return 0.20, 0.001  # default 20% annual

        log_returns = np.diff(np.log(prices))
        per_step_vol = float(np.std(log_returns))

        # Approximate annualization:
        # If bars are 1-minute, there are ~390 bars/day * 252 days/year
        bars_per_year = 390 * 252
        annualized_vol = per_step_vol * np.sqrt(bars_per_year)
        annualized_vol = np.clip(annualized_vol, 0.05, 1.50)  # sanity bounds

        return float(annualized_vol), float(per_step_vol)

    def _reconstruct_order_book(
        self,
        bar: MarketBar,
        avg_daily_volume: float,
        volatility: float,
        num_levels: int = 5,
    ) -> OrderBookSnapshot:
        """
        Reconstruct a realistic order book snapshot from an OHLCV bar.

        Uses the bar's OHLC range to estimate the spread, and distributes
        volume across levels using an exponential decay model calibrated
        to the bar's actual volume and the stock's ADV.
        """
        mid_price = (bar.high + bar.low) / 2.0
        tick_size = 0.01

        # Estimate spread from the bar's range and volatility
        # In liquid markets, spread ≈ 1-5 bps for large-cap stocks
        intraday_range_bps = ((bar.high - bar.low) / mid_price) * 10000.0
        # Spread is roughly 10-30% of the bar range, minimum 1 tick
        estimated_spread = max(tick_size, (bar.high - bar.low) * 0.15)
        estimated_spread = round(estimated_spread, 2)

        half_spread = estimated_spread / 2.0
        best_bid = round(mid_price - half_spread, 2)
        best_ask = round(mid_price + half_spread, 2)

        # Distribute volume across levels
        # Top of book gets the most volume, exponential decay deeper
        bar_volume = max(100, bar.volume)
        # Assume visible book is ~5-10% of bar volume
        visible_volume = int(bar_volume * 0.07)

        bids = []
        asks = []
        for i in range(num_levels):
            decay = np.exp(-0.5 * i)  # exponential decay
            noise = np.random.uniform(0.7, 1.3)  # ±30% noise

            level_size = max(100, int(visible_volume * decay * noise / num_levels))

            bid_price = round(best_bid - i * tick_size, 2)
            ask_price = round(best_ask + i * tick_size, 2)

            bids.append(OrderBookLevel(price=bid_price, size=level_size))
            asks.append(OrderBookLevel(price=ask_price, size=level_size))

        return OrderBookSnapshot(
            timestamp=bar.timestamp,
            symbol="",  # filled by caller
            bids=bids,
            asks=asks,
        )

    def build_episode_data(
        self,
        symbol: str,
        horizon: int,
        order_size: int,
    ) -> MarketDataBundle:
        """
        Build a complete MarketDataBundle for one simulation episode
        using real Yahoo Finance data.
        """
        # Need horizon+1 bars to get horizon price steps
        bars = self.get_historical_bars(symbol, num_bars=horizon + 1, interval="1m")

        if len(bars) < horizon + 1:
            # Fall back to 5-minute data if 1-minute isn't available
            bars = self.get_historical_bars(symbol, num_bars=horizon + 1, interval="5m")

        if len(bars) < 3:
            raise ValueError(
                f"Insufficient data for {symbol}. Got {len(bars)} bars, need at least {horizon + 1}."
            )

        # Trim or pad to exact horizon+1
        bars = bars[:horizon + 1]
        actual_horizon = len(bars) - 1

        # Extract price and volume series
        mid_prices = np.array([(b.high + b.low) / 2.0 for b in bars], dtype=np.float64)
        volumes = np.array([b.volume for b in bars], dtype=np.float64)

        # Get ADV
        avg_daily_volume = self._estimate_daily_volume(symbol)

        # Estimate volatility
        annual_vol, step_vol = self._estimate_volatility(mid_prices)

        # Reconstruct order books
        order_books = []
        for bar in bars:
            ob = self._reconstruct_order_book(bar, avg_daily_volume, step_vol)
            ob.symbol = symbol
            order_books.append(ob)

        return MarketDataBundle(
            symbol=symbol,
            provider=DataProvider.YAHOO,
            bars=bars,
            mid_prices=mid_prices,
            volumes=volumes,
            order_book_snapshots=order_books,
            initial_price=float(mid_prices[0]),
            avg_daily_volume=avg_daily_volume,
            volatility_annual=annual_vol,
            volatility_intraday=step_vol,
        )
