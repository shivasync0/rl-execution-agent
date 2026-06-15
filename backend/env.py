import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pandas as pd

class ExecutionEnv(gym.Env):
    """
    ExecutionEnv is a Gymnasium environment simulating optimal order execution (buy order).
    
    State space (7 dimensions):
      1. spread_bps: Current spread in basis points (centered/normalized).
      2. order_book_imbalance: (bid_vol - ask_vol) / (bid_vol + ask_vol).
      3. time_pct: Current step / total steps.
      4. inventory_pct: Remaining shares / total shares.
      5. momentum_5: Price momentum over the last 5 steps.
      6. momentum_20: Price momentum over the last 20 steps.
      7. realized_vol: Volatility of returns over the last 10 steps.
      
    Action space (1 dimension):
      - continuous value in [0, 1] representing the fraction of REMAINING inventory to trade.
      - If action is close to 0, small or no trade. If action is 1, trade all remaining inventory.
      - At the final step, any remaining inventory is executed in a market sweep (forced execution).
    """
    
    def __init__(self, 
                 order_size=10000, 
                 horizon=20, 
                 market_impact=0.0001, 
                 volatility_regime="low", 
                 initial_price=100.0,
                 csv_path=None):
        super(ExecutionEnv, self).__init__()
        
        self.order_size = order_size
        self.horizon = horizon
        self.market_impact = market_impact
        self.volatility_regime = volatility_regime
        self.initial_price = initial_price
        self.csv_path = csv_path
        
        # Load external data if provided
        self.historical_prices = None
        if csv_path:
            try:
                df = pd.read_csv(csv_path)
                if 'price' in df.columns:
                    self.historical_prices = df['price'].values
            except Exception as e:
                print(f"Failed to load historical data from {csv_path}: {e}")
                
        # Action space: fraction of remaining inventory to execute [0, 1]
        self.action_space = spaces.Box(low=0.0, high=1.0, shape=(1,), dtype=np.float32)
        
        # Observation space: 7 state features
        # all scaled to roughly [-2, 2] or [0, 1]
        self.observation_space = spaces.Box(
            low=-5.0, 
            high=5.0, 
            shape=(7,), 
            dtype=np.float32
        )
        
        self.reset()
        
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            np.random.seed(seed)
            
        self.current_step = 0
        self.inventory_remaining = float(self.order_size)
        self.price_history = [self.initial_price]
        
        # Set volatility parameter based on regime
        if self.volatility_regime == "high":
            self.vol = 0.30  # 30% annual volatility
        else:
            self.vol = 0.10  # 10% annual volatility
            
        # Time step delta (assuming trading horizon represents a small fraction of a day, e.g., 30 minutes)
        # delta_t is the time step size in years: 30 mins = 30 / (252 * 390) = 3.05e-4 years
        self.dt = 0.0001
        
        # Pre-generate or prepare price path
        if self.historical_prices is not None and len(self.historical_prices) > self.horizon:
            # Pick a random starting point
            start_idx = np.random.randint(0, len(self.historical_prices) - self.horizon - 1)
            self.sim_mid_prices = self.historical_prices[start_idx : start_idx + self.horizon + 1]
            # Normalize to start at initial_price
            scale = self.initial_price / self.sim_mid_prices[0]
            self.sim_mid_prices = self.sim_mid_prices * scale
        else:
            # Generate via GBM
            self.sim_mid_prices = [self.initial_price]
            p = self.initial_price
            for _ in range(self.horizon):
                # Daily drift assumed 0 for execution timescale
                r = np.random.normal(0, 1)
                p = p * np.exp((0.0 - 0.5 * (self.vol ** 2)) * self.dt + self.vol * np.sqrt(self.dt) * r)
                self.sim_mid_prices.append(p)
            self.sim_mid_prices = np.array(self.sim_mid_prices)
            
        self.mid_price = self.sim_mid_prices[0]
        
        # Keep track of execution costs and quantities
        self.trades = []  # list of dicts: {step, qty, price, slippage_bps}
        self.total_cost = 0.0
        self.total_executed = 0.0
        
        # State variables
        self.spread_bps_history = []
        self.imbalance_history = []
        
        # Initial step features
        state = self._get_observation()
        info = self._get_info()
        
        return state, info

    def _get_spread(self):
        # Base spread is 5 bps + standard normal noise
        # Clip to ensure spread is always positive (at least 1 bp)
        noise = np.random.normal(0, 1.2)
        spread_bps = max(1.0, 5.0 + noise)
        return spread_bps
        
    def _get_order_book_depth(self):
        """Simulate order book queue sizes for depth chart / bid-ask ladder."""
        spread = (self._get_spread() / 10000.0) * self.mid_price
        tick_size = 0.01
        spread = max(tick_size, round(spread, 2))
        
        half_spread = spread / 2.0
        best_bid = round(self.mid_price - half_spread, 2)
        best_ask = round(self.mid_price + half_spread, 2)
        
        # Create 5 levels of bids and asks
        bids = []
        asks = []
        
        # U-shaped or bell-shaped volume profile on levels
        # Base size around 500-2000 shares
        base_size = 1200
        for i in range(5):
            bid_price = round(best_bid - i * tick_size, 2)
            ask_price = round(best_ask + i * tick_size, 2)
            
            # Add some random queue sizes
            bid_size = int(max(100, base_size * (1.2 - 0.15 * i) + np.random.randint(-300, 300)))
            ask_size = int(max(100, base_size * (1.2 - 0.15 * i) + np.random.randint(-300, 300)))
            
            bids.append({"price": bid_price, "size": bid_size})
            asks.append({"price": ask_price, "size": ask_size})
            
        return bids, asks

    def _get_observation(self):
        # 1. spread_bps
        current_spread_bps = self._get_spread()
        self.spread_bps_history.append(current_spread_bps)
        spread_bps_norm = (current_spread_bps - 5.0) / 2.5 # normalized around 0
        
        # 2. order_book_imbalance
        bids, asks = self._get_order_book_depth()
        total_bid_vol = sum(b['size'] for b in bids)
        total_ask_vol = sum(a['size'] for a in asks)
        imbalance = (total_bid_vol - total_ask_vol) / (total_bid_vol + total_ask_vol + 1e-8)
        self.imbalance_history.append(imbalance)
        
        # 3. time_pct
        time_pct = self.current_step / self.horizon
        
        # 4. inventory_pct
        inventory_pct = self.inventory_remaining / self.order_size
        
        # 5 & 6. momentum (5 and 20 steps)
        # Momentum relative to current price
        if len(self.price_history) >= 6:
            momentum_5 = (self.price_history[-1] - self.price_history[-6]) / self.price_history[-6]
        else:
            momentum_5 = (self.price_history[-1] - self.price_history[0]) / self.price_history[0]
            
        if len(self.price_history) >= 21:
            momentum_20 = (self.price_history[-1] - self.price_history[-21]) / self.price_history[-21]
        else:
            momentum_20 = (self.price_history[-1] - self.price_history[0]) / self.price_history[0]
            
        # Scale momentum for NN input
        momentum_5_norm = momentum_5 * 100.0  # scale %
        momentum_20_norm = momentum_20 * 100.0
        
        # 7. realized volatility
        # rolling std of log returns of last 10 steps
        if len(self.price_history) >= 2:
            prices = np.array(self.price_history[-11:])
            returns = np.diff(np.log(prices))
            realized_vol = np.std(returns) if len(returns) > 1 else 0.0
        else:
            realized_vol = 0.0
            
        realized_vol_norm = realized_vol * 100.0 # scale %
        
        return np.array([
            spread_bps_norm,
            imbalance,
            time_pct,
            inventory_pct,
            momentum_5_norm,
            momentum_20_norm,
            realized_vol_norm
        ], dtype=np.float32)

    def _get_info(self):
        bids, asks = self._get_order_book_depth()
        # Compute current metrics
        arrival_price = self.initial_price
        
        avg_fill_price = 0.0
        if self.total_executed > 0:
            avg_fill_price = self.total_cost / self.total_executed
            
        shortfall_bps = 0.0
        if avg_fill_price > 0:
            # shortfall for buy order: (avg_fill - arrival) / arrival * 10000
            shortfall_bps = ((avg_fill_price - arrival_price) / arrival_price) * 10000.0
            
        return {
            "step": self.current_step,
            "inventory_remaining": self.inventory_remaining,
            "total_executed": self.total_executed,
            "mid_price": self.mid_price,
            "avg_fill_price": avg_fill_price,
            "shortfall_bps": shortfall_bps,
            "bids": bids,
            "asks": asks,
            "trades": self.trades
        }

    def step(self, action):
        # Action is a continuous value [0, 1] representing fraction of remaining inventory to trade
        action_val = float(action[0])
        action_val = clip_action = np.clip(action_val, 0.0, 1.0)
        
        # Is this the final step?
        is_last_step = (self.current_step == self.horizon - 1)
        
        if is_last_step:
            # Force completion of all remaining inventory
            shares_to_trade = self.inventory_remaining
        else:
            # Calculate shares to trade
            shares_to_trade = action_val * self.inventory_remaining
            # Let's round to nearest integer shares for realism
            shares_to_trade = round(shares_to_trade)
            # Ensure we don't trade more than remaining
            shares_to_trade = min(shares_to_trade, self.inventory_remaining)
            
        # Mid price for this step (already generated in reset)
        self.current_step += 1
        self.mid_price = self.sim_mid_prices[self.current_step]
        self.price_history.append(self.mid_price)
        
        # Execute the trade and calculate fill price with market impact
        # We model temporary and permanent impact.
        # Fill price is: Mid + spread/2 + impact * shares_to_trade
        # The permanent impact shifts the mid price for the next steps
        spread = (self._get_spread() / 10000.0) * self.mid_price
        
        fill_price = 0.0
        slippage_bps = 0.0
        
        if shares_to_trade > 0:
            # Temporary impact
            temp_impact = self.market_impact * (shares_to_trade / self.order_size) * self.mid_price
            # For buying, crossing the half spread + temporary impact
            fill_price = self.mid_price + (spread / 2.0) + temp_impact
            
            # Permanent impact: shifts subsequent simulated prices
            # E.g. shift the rest of the price path by perm impact
            perm_impact = 0.3 * self.market_impact * (shares_to_trade / self.order_size) * self.mid_price
            self.sim_mid_prices[self.current_step:] += perm_impact
            self.mid_price = self.sim_mid_prices[self.current_step]
            
            # Calculate cost
            cost = fill_price * shares_to_trade
            self.total_cost += cost
            self.total_executed += shares_to_trade
            self.inventory_remaining -= shares_to_trade
            
            # Calculate slippage for this trade: (fill_price - initial_price) / initial_price * 10000
            slippage_bps = ((fill_price - self.initial_price) / self.initial_price) * 10000.0
            
            self.trades.append({
                "step": self.current_step,
                "qty": float(shares_to_trade),
                "fill_price": float(fill_price),
                "slippage_bps": float(slippage_bps)
            })
        else:
            fill_price = 0.0
            slippage_bps = 0.0
            
        # Calculate Reward
        # Reward components:
        # 1. Slippage penalty: - (slippage_bps_t * qty_fraction_t)
        # Note: if slippage is positive (fill > arrival), reward is negative
        qty_fraction = shares_to_trade / self.order_size
        slippage_penalty = - (slippage_bps * qty_fraction)
        
        # 2. Urgency penalty: penalty for holding inventory (keeps the agent trading)
        # urgency_penalty = - lambda * (inventory_pct)^2
        urgency_coef = 0.05
        inventory_pct = self.inventory_remaining / self.order_size
        urgency_penalty = - urgency_coef * (inventory_pct ** 2)
        
        # 3. Terminal completion bonus
        # If the order is fully executed, add a bonus
        completion_bonus = 0.0
        if self.inventory_remaining == 0 and is_last_step:
            completion_bonus = 10.0
        elif is_last_step and self.inventory_remaining > 0:
            # Large penalty if we failed to complete (should be 0 since we force it, but let's have it just in case)
            completion_bonus = -50.0
            
        reward = slippage_penalty + urgency_penalty + completion_bonus
        
        # Check if finished
        terminated = (self.current_step >= self.horizon) or (self.inventory_remaining <= 0)
        truncated = False
        
        obs = self._get_observation()
        info = self._get_info()
        
        # Add reward breakdown to info for Page 2 dashboard
        info["reward_components"] = {
            "slippage_penalty": float(slippage_penalty),
            "urgency_penalty": float(urgency_penalty),
            "completion_bonus": float(completion_bonus),
            "total_reward": float(reward)
        }
        
        return obs, reward, terminated, truncated, info
