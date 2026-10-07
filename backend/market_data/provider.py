"""
Market Data Provider Abstraction Layer

Defines the interface all market data providers must implement,
allowing seamless switching between data sources (Yahoo Finance,
Alpaca, Polygon, Binance, etc.)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
import numpy as np


class DataProvider(str, Enum):
    """Supported market data providers."""
    YAHOO = "yahoo"
    ALPACA = "alpaca"
    SIMULATED = "simulated"  # fallback to GBM


@dataclass
class OrderBookLevel:
    """A single price level in the order book."""
    price: float
    size: int


@dataclass
class OrderBookSnapshot:
    """Complete order book state at a point in time."""
    timestamp: float  # unix timestamp
    symbol: str
    bids: list[OrderBookLevel] = field(default_factory=list)  # sorted descending by price
    asks: list[OrderBookLevel] = field(default_factory=list)  # sorted ascending by price

    @property
    def mid_price(self) -> float:
        if self.bids and self.asks:
            return (self.bids[0].price + self.asks[0].price) / 2.0
        return 0.0

    @property
    def spread(self) -> float:
        if self.bids and self.asks:
            return self.asks[0].price - self.bids[0].price
        return 0.0

    @property
    def spread_bps(self) -> float:
        mid = self.mid_price
        if mid > 0:
            return (self.spread / mid) * 10000.0
        return 0.0

    @property
    def bid_volume(self) -> int:
        return sum(level.size for level in self.bids)

    @property
    def ask_volume(self) -> int:
        return sum(level.size for level in self.asks)

    @property
    def imbalance(self) -> float:
        total = self.bid_volume + self.ask_volume
        if total > 0:
            return (self.bid_volume - self.ask_volume) / total
        return 0.0

    def to_dict(self) -> dict:
        return {
            "bids": [{"price": l.price, "size": l.size} for l in self.bids],
            "asks": [{"price": l.price, "size": l.size} for l in self.asks],
            "mid_price": self.mid_price,
            "spread_bps": self.spread_bps,
            "imbalance": self.imbalance,
        }


@dataclass
class MarketBar:
    """A single OHLCV bar."""
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass
class MarketDataBundle:
    """
    Complete market data for a simulation episode.
    Contains price path, volume profile, and order book snapshots.
    """
    symbol: str
    provider: DataProvider
    bars: list[MarketBar]             # intraday bars
    mid_prices: np.ndarray            # extracted mid-price series
    volumes: np.ndarray               # volume at each step
    order_book_snapshots: list[OrderBookSnapshot]  # one per step
    initial_price: float
    avg_daily_volume: float           # ADV for impact model calibration
    volatility_annual: float          # annualized volatility
    volatility_intraday: float        # intraday volatility (per-step)

    @property
    def horizon(self) -> int:
        return len(self.mid_prices)

    def volume_profile(self) -> np.ndarray:
        """Normalized volume profile (sums to 1.0)."""
        total = np.sum(self.volumes)
        if total > 0:
            return self.volumes / total
        return np.ones(len(self.volumes)) / len(self.volumes)


class BaseMarketDataProvider(ABC):
    """
    Abstract base class for all market data providers.
    Concrete implementations (Yahoo, Alpaca, etc.) inherit from this.
    """

    @abstractmethod
    def get_historical_bars(
        self,
        symbol: str,
        num_bars: int,
        interval: str = "1m",
    ) -> list[MarketBar]:
        """Fetch historical OHLCV bars."""
        pass

    @abstractmethod
    def build_episode_data(
        self,
        symbol: str,
        horizon: int,
        order_size: int,
    ) -> MarketDataBundle:
        """
        Build a complete MarketDataBundle for one simulation episode.
        This is the primary method the environment calls.
        """
        pass

    @abstractmethod
    def get_supported_symbols(self) -> list[str]:
        """Return list of symbols this provider supports."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> DataProvider:
        pass
