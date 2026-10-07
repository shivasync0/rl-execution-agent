"""
Real-Market Execution Environment (v2)

Drop-in replacement for the original env.py that integrates:
  1. Real market data from pluggable providers (Yahoo Finance, Alpaca, etc.)
  2. Almgren-Chriss square-root market impact model
  3. Real order book snapshots (reconstructed from OHLCV or live L2 data)
  4. Volume-aware VWAP baseline (using actual volume profiles)
  5. Additional state features for better RL training

Falls back to the original GBM simulation when no market data is available.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pandas as pd
from typing import Optional

from market_data.provider import (
    BaseMarketDataProvider, DataProvider, MarketDataBundle,
    OrderBookSnapshot, OrderBookLevel
)
from market_data.impact_model import AlmgrenChrissModel


class RealMarketExecutionEnv(gym.Env):
    """
    Enhanced ExecutionEnv with real market data and Almgren-Chriss impact model.

    State space (10 dimensions — expanded from original 7):
      1. spread_bps: Current spread in basis points (normalized)
      2. order_book_imbalance: (bid_vol - ask_vol) / (bid_vol + ask_vol)
      3. time_pct: Current step / total steps
      4. inventory_pct: Remaining shares / total shares
      5. momentum_5: Price momentum over the last 5 steps
      6. momentum_20: Price momentum over the last 20 steps
      7. realized_vol: Rolling volatility of returns
      8. volume_ratio: Current bar volume / average volume (real data)
      9. vwap_distance: Distance from VWAP in bps (real data)
     10. impact_estimate: Estimated cost of trading remaining inventory (normalized)

    Action space (1 dimension):
      - Continuous [0, 1] = fraction of REMAINING inventory to trade this step

    Impact model:
      - Almgren-Chriss with square-root temporary impact
      - Auto-calibrated from the stock's ADV and volatility
    """

    def __init__(
        self,
        order_size: int = 10000,
        horizon: int = 20,
        market_impact: float = 0.0001,  # legacy param, used as fallback scaling
        volatility_regime: str = "low",
        initial_price: float = 100.0,
        csv_path: Optional[str] = None,
        symbol: str = "AAPL",
        data_provider: Optional[BaseMarketDataProvider] = None,
        use_real_data: bool = False,
    ):
        super().__init__()

        self.order_size = order_size
        self.horizon = horizon
        self.market_impact_legacy = market_impact
        self.volatility_regime = volatility_regime
        self.initial_price = initial_price
        self.csv_path = csv_path
        self.symbol = symbol
        self.data_provider = data_provider
        self.use_real_data = use_real_data and data_provider is not None

        # Load CSV if provided (legacy support)
        self.historical_prices = None
        if csv_path:
            try:
                df = pd.read_csv(csv_path)
                if 'price' in df.columns:
                    self.historical_prices = df['price'].values
            except Exception as e:
                print(f"Failed to load historical data from {csv_path}: {e}")

        # State space: 10 features (backward compatible — first 7 match original)
        self.state_dim = 10
        self.observation_space = spaces.Box(
            low=-5.0, high=5.0, shape=(self.state_dim,), dtype=np.float32
        )

        # Action space: fraction of remaining inventory [0, 1]
        self.action_space = spaces.Box(
            low=0.0, high=1.0, shape=(1,), dtype=np.float32
        )

        # Market data bundle (populated on reset)
        self._market_data: Optional[MarketDataBundle] = None
        self._impact_model: Optional[AlmgrenChrissModel] = None
        self._current_ob: Optional[OrderBookSnapshot] = None

        self.reset()

    def _load_market_data(self) -> bool:
        """Attempt to load real market data. Returns True on success."""
        if not self.use_real_data or self.data_provider is None:
            return False

        try:
            self._market_data = self.data_provider.build_episode_data(
                symbol=self.symbol,
                horizon=self.horizon,
                order_size=self.order_size,
            )

            # Auto-calibrate impact model from real data
            self._impact_model = AlmgrenChrissModel.calibrate(
                mid_price=self._market_data.initial_price,
                avg_daily_volume=self._market_data.avg_daily_volume,
                annual_volatility=self._market_data.volatility_annual,
                horizon_steps=self.horizon,
            )

            return True
        except Exception as e:
            print(f"[RealMarketEnv] Failed to load real data for {self.symbol}: {e}")
            print("[RealMarketEnv] Falling back to GBM simulation.")
            return False

    def _generate_gbm_prices(self) -> np.ndarray:
        """Generate price path using Geometric Brownian Motion (legacy fallback)."""
        if self.volatility_regime == "high":
            vol = 0.30
        else:
            vol = 0.10

        dt = 0.0001
        prices = [self.initial_price]
        p = self.initial_price
        for _ in range(self.horizon):
            r = np.random.normal(0, 1)
            p = p * np.exp(-0.5 * (vol ** 2) * dt + vol * np.sqrt(dt) * r)
            prices.append(p)
        return np.array(prices)

    def _generate_synthetic_order_book(self) -> OrderBookSnapshot:
        """Generate a synthetic order book (legacy fallback)."""
        spread_bps = max(1.0, 5.0 + np.random.normal(0, 1.2))
        spread = (spread_bps / 10000.0) * self.mid_price
        tick_size = 0.01
        spread = max(tick_size, round(spread, 2))

        half_spread = spread / 2.0
        best_bid = round(self.mid_price - half_spread, 2)
        best_ask = round(self.mid_price + half_spread, 2)

        bids = []
        asks = []
        base_size = 1200
        for i in range(5):
            bid_price = round(best_bid - i * tick_size, 2)
            ask_price = round(best_ask + i * tick_size, 2)
            bid_size = int(max(100, base_size * (1.2 - 0.15 * i) + np.random.randint(-300, 300)))
            ask_size = int(max(100, base_size * (1.2 - 0.15 * i) + np.random.randint(-300, 300)))
            bids.append(OrderBookLevel(price=bid_price, size=bid_size))
            asks.append(OrderBookLevel(price=ask_price, size=ask_size))

        return OrderBookSnapshot(
            timestamp=0.0, symbol=self.symbol, bids=bids, asks=asks
        )

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            np.random.seed(seed)

        self.current_step = 0
        self.inventory_remaining = float(self.order_size)
        self.total_cost = 0.0
        self.total_executed = 0.0
        self.trades = []

        # Cumulative volume-weighted price tracker (for VWAP distance feature)
        self._cum_volume = 0.0
        self._cum_vol_price = 0.0

        # Try to load real market data
        has_real_data = self._load_market_data()

        if has_real_data and self._market_data is not None:
            # Use real price path
            self.sim_mid_prices = self._market_data.mid_prices.copy()
            self.initial_price = float(self.sim_mid_prices[0])
            self._volumes = self._market_data.volumes.copy()
            self._data_source = "real"
        elif self.historical_prices is not None and len(self.historical_prices) > self.horizon:
            # CSV fallback
            start_idx = np.random.randint(0, len(self.historical_prices) - self.horizon - 1)
            self.sim_mid_prices = self.historical_prices[start_idx:start_idx + self.horizon + 1]
            scale = self.initial_price / self.sim_mid_prices[0]
            self.sim_mid_prices = self.sim_mid_prices * scale
            self._volumes = np.ones(self.horizon + 1) * 10000  # synthetic
            self._data_source = "csv"

            # Calibrate impact model from CSV data
            prices = self.sim_mid_prices
            log_rets = np.diff(np.log(prices))
            annual_vol = float(np.std(log_rets) * np.sqrt(252 * 390))
            self._impact_model = AlmgrenChrissModel.calibrate(
                mid_price=self.initial_price,
                avg_daily_volume=5_000_000,
                annual_volatility=max(0.1, annual_vol),
                horizon_steps=self.horizon,
            )
        else:
            # GBM fallback
            self.sim_mid_prices = self._generate_gbm_prices()
            self._volumes = np.ones(self.horizon + 1) * 10000  # synthetic
            self._data_source = "simulated"

            # Simple impact model for GBM
            vol = 0.30 if self.volatility_regime == "high" else 0.10
            self._impact_model = AlmgrenChrissModel.calibrate(
                mid_price=self.initial_price,
                avg_daily_volume=5_000_000,
                annual_volatility=vol,
                horizon_steps=self.horizon,
            )

        self.mid_price = float(self.sim_mid_prices[0])
        self.price_history = [self.mid_price]

        # History tracking for features
        self.spread_bps_history = []
        self.imbalance_history = []

        # Get initial observation
        state = self._get_observation()
        info = self._get_info()

        return state, info

    def _get_current_order_book(self) -> OrderBookSnapshot:
        """Get order book for the current step."""
        if (
            self._data_source == "real"
            and self._market_data is not None
            and self.current_step < len(self._market_data.order_book_snapshots)
        ):
            return self._market_data.order_book_snapshots[self.current_step]
        else:
            return self._generate_synthetic_order_book()

    def _get_observation(self) -> np.ndarray:
        """Build the 10-dimensional state vector."""

        # Get order book
        ob = self._get_current_order_book()
        self._current_ob = ob

        # 1. spread_bps (normalized)
        spread_bps = ob.spread_bps if ob.spread_bps > 0 else max(1.0, 5.0 + np.random.normal(0, 1.2))
        self.spread_bps_history.append(spread_bps)
        spread_bps_norm = (spread_bps - 5.0) / 2.5

        # 2. order_book_imbalance
        imbalance = ob.imbalance
        self.imbalance_history.append(imbalance)

        # 3. time_pct
        time_pct = self.current_step / self.horizon

        # 4. inventory_pct
        inventory_pct = self.inventory_remaining / self.order_size

        # 5 & 6. momentum (5 and 20 steps)
        if len(self.price_history) >= 6:
            momentum_5 = (self.price_history[-1] - self.price_history[-6]) / self.price_history[-6]
        else:
            momentum_5 = (self.price_history[-1] - self.price_history[0]) / (self.price_history[0] + 1e-10)

        if len(self.price_history) >= 21:
            momentum_20 = (self.price_history[-1] - self.price_history[-21]) / self.price_history[-21]
        else:
            momentum_20 = (self.price_history[-1] - self.price_history[0]) / (self.price_history[0] + 1e-10)

        momentum_5_norm = momentum_5 * 100.0
        momentum_20_norm = momentum_20 * 100.0

        # 7. realized volatility
        if len(self.price_history) >= 2:
            prices = np.array(self.price_history[-11:])
            returns = np.diff(np.log(prices + 1e-10))
            realized_vol = float(np.std(returns)) if len(returns) > 1 else 0.0
        else:
            realized_vol = 0.0
        realized_vol_norm = realized_vol * 100.0

        # 8. volume_ratio: current volume vs average
        if self._data_source == "real" and self._market_data is not None:
            avg_vol = np.mean(self._volumes) if np.mean(self._volumes) > 0 else 1.0
            current_vol = self._volumes[min(self.current_step, len(self._volumes) - 1)]
            volume_ratio = (current_vol / avg_vol) - 1.0  # centered at 0
        else:
            volume_ratio = 0.0  # no information in simulated mode

        # 9. vwap_distance: distance from running VWAP in bps
        if self._cum_volume > 0:
            running_vwap = self._cum_vol_price / self._cum_volume
            vwap_distance = ((self.mid_price - running_vwap) / running_vwap) * 100.0
        else:
            vwap_distance = 0.0

        # 10. impact_estimate: estimated cost of remaining inventory (normalized)
        if self._impact_model is not None and self.inventory_remaining > 0:
            est_impact = self._impact_model.temporary_impact(
                self.inventory_remaining, self.mid_price
            )
            impact_norm = (est_impact / self.mid_price) * 10000.0  # in bps
            impact_norm = np.clip(impact_norm / 50.0, -2.0, 2.0)  # normalize
        else:
            impact_norm = 0.0

        return np.array([
            spread_bps_norm,
            imbalance,
            time_pct,
            inventory_pct,
            momentum_5_norm,
            momentum_20_norm,
            realized_vol_norm,
            np.clip(volume_ratio, -2.0, 2.0),
            np.clip(vwap_distance, -2.0, 2.0),
            impact_norm,
        ], dtype=np.float32)

    def _get_info(self) -> dict:
        """Build the info dictionary for the current state."""
        ob = self._current_ob or self._get_current_order_book()

        arrival_price = self.initial_price
        avg_fill_price = self.total_cost / self.total_executed if self.total_executed > 0 else 0.0
        shortfall_bps = ((avg_fill_price - arrival_price) / arrival_price * 10000.0) if avg_fill_price > 0 else 0.0

        info = {
            "step": self.current_step,
            "inventory_remaining": self.inventory_remaining,
            "total_executed": self.total_executed,
            "mid_price": self.mid_price,
            "avg_fill_price": avg_fill_price,
            "shortfall_bps": shortfall_bps,
            "bids": [{"price": l.price, "size": l.size} for l in ob.bids],
            "asks": [{"price": l.price, "size": l.size} for l in ob.asks],
            "trades": self.trades,
            "data_source": self._data_source,
            "symbol": self.symbol,
        }

        # Add impact model info if available
        if self._impact_model is not None:
            info["impact_model"] = self._impact_model.to_dict()

        return info

    def step(self, action):
        """Execute one step of the environment."""
        action_val = float(np.clip(action[0], 0.0, 1.0))

        is_last_step = (self.current_step == self.horizon - 1)

        if is_last_step:
            shares_to_trade = self.inventory_remaining
        else:
            shares_to_trade = action_val * self.inventory_remaining
            shares_to_trade = round(shares_to_trade)
            shares_to_trade = min(shares_to_trade, self.inventory_remaining)

        # Advance to next time step
        self.current_step += 1
        self.mid_price = float(self.sim_mid_prices[min(self.current_step, len(self.sim_mid_prices) - 1)])
        self.price_history.append(self.mid_price)

        # Update volume tracking
        current_vol = float(self._volumes[min(self.current_step, len(self._volumes) - 1)])
        self._cum_volume += current_vol
        self._cum_vol_price += current_vol * self.mid_price

        # Calculate fill price using Almgren-Chriss impact model
        ob = self._get_current_order_book()
        self._current_ob = ob
        spread = ob.spread if ob.spread > 0 else (5.0 / 10000.0) * self.mid_price

        fill_price = 0.0
        slippage_bps = 0.0

        if shares_to_trade > 0:
            if self._impact_model is not None:
                # Use Almgren-Chriss model
                fill_price = self._impact_model.fill_price(
                    shares_traded=shares_to_trade,
                    mid_price=self.mid_price,
                    spread=spread,
                    is_buy=True,
                )

                # Apply permanent impact to future prices
                perm_impact = self._impact_model.permanent_impact(
                    shares_to_trade, self.mid_price
                )
                self.sim_mid_prices[self.current_step:] += perm_impact
                self.mid_price = float(self.sim_mid_prices[self.current_step])
            else:
                # Legacy linear impact (fallback)
                temp_impact = self.market_impact_legacy * (shares_to_trade / self.order_size) * self.mid_price
                fill_price = self.mid_price + (spread / 2.0) + temp_impact
                perm_impact = 0.3 * self.market_impact_legacy * (shares_to_trade / self.order_size) * self.mid_price
                self.sim_mid_prices[self.current_step:] += perm_impact
                self.mid_price = float(self.sim_mid_prices[self.current_step])

            # Update cost tracking
            cost = fill_price * shares_to_trade
            self.total_cost += cost
            self.total_executed += shares_to_trade
            self.inventory_remaining -= shares_to_trade

            slippage_bps = ((fill_price - self.initial_price) / self.initial_price) * 10000.0

            self.trades.append({
                "step": self.current_step,
                "qty": float(shares_to_trade),
                "fill_price": float(fill_price),
                "slippage_bps": float(slippage_bps),
            })

        # Calculate reward
        qty_fraction = shares_to_trade / self.order_size
        slippage_penalty = -(slippage_bps * qty_fraction)

        urgency_coef = 0.05
        inventory_pct = self.inventory_remaining / self.order_size
        urgency_penalty = -urgency_coef * (inventory_pct ** 2)

        completion_bonus = 0.0
        if self.inventory_remaining == 0 and is_last_step:
            completion_bonus = 10.0
        elif is_last_step and self.inventory_remaining > 0:
            completion_bonus = -50.0

        reward = slippage_penalty + urgency_penalty + completion_bonus

        terminated = (self.current_step >= self.horizon) or (self.inventory_remaining <= 0)
        truncated = False

        obs = self._get_observation()
        info = self._get_info()

        info["reward_components"] = {
            "slippage_penalty": float(slippage_penalty),
            "urgency_penalty": float(urgency_penalty),
            "completion_bonus": float(completion_bonus),
            "total_reward": float(reward),
        }

        return obs, reward, terminated, truncated, info
