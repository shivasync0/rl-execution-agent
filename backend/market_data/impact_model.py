"""
Almgren-Chriss Market Impact Model

Industry-standard model for estimating the cost of executing large orders.
Separates market impact into:
  - Permanent impact: lasting price change from information leakage
  - Temporary impact: short-lived cost of demanding liquidity

Uses the empirically-validated square-root law for temporary impact,
calibrated to the stock's average daily volume and volatility.

References:
  - Almgren & Chriss (2001): "Optimal execution of portfolio transactions"
  - Almgren et al. (2005): "Direct estimation of equity market impact"
  - Bouchaud et al. (2018): "Trades, Quotes, and Prices"
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class ImpactParams:
    """
    Calibrated parameters for the Almgren-Chriss impact model.

    Attributes:
        gamma: Permanent impact coefficient (price units per share)
        eta: Temporary impact coefficient (price units * sqrt(time) per share)
        alpha: Power-law exponent for temporary impact (0.5 = square root)
        sigma: Volatility (per-step)
        tau: Time step duration (fraction of trading day)
        adv: Average daily volume
        lambda_risk: Risk aversion coefficient
    """
    gamma: float = 0.0        # permanent impact coefficient
    eta: float = 0.0          # temporary impact coefficient  
    alpha: float = 0.5        # power-law exponent (square root by default)
    sigma: float = 0.01       # per-step volatility
    tau: float = 0.001        # time step as fraction of day
    adv: float = 5_000_000    # average daily volume
    lambda_risk: float = 1e-6 # risk aversion


class AlmgrenChrissModel:
    """
    Almgren-Chriss market impact model with square-root temporary impact.

    The model computes:
      - Permanent impact: Δp_perm = γ * (shares_traded / ADV)
      - Temporary impact: Δp_temp = η * σ * |shares_traded / (ADV * τ)|^α
      - Fill price = mid_price + spread/2 + Δp_temp + Δp_perm

    The square-root law (α=0.5) is empirically well-supported:
    impact scales with the square root of order size relative to ADV.
    """

    def __init__(self, params: Optional[ImpactParams] = None):
        self.params = params or ImpactParams()

    @classmethod
    def calibrate(
        cls,
        mid_price: float,
        avg_daily_volume: float,
        annual_volatility: float,
        horizon_steps: int,
        trading_minutes: int = 30,
    ) -> "AlmgrenChrissModel":
        """
        Auto-calibrate model parameters from observable market data.

        This uses empirical scaling relationships from the academic literature:
          - η is calibrated so that trading 1% of ADV in one step costs ~10-20 bps
          - γ is calibrated as a fraction of η (typically γ ≈ 0.1 * η)
          - σ is derived from annual volatility
        
        Args:
            mid_price: Current mid price of the asset
            avg_daily_volume: Average daily volume in shares
            annual_volatility: Annualized volatility (e.g., 0.25 for 25%)
            horizon_steps: Number of execution steps
            trading_minutes: Total trading window in minutes
        """
        # Time step as fraction of trading day (6.5 hours = 390 minutes)
        total_trading_minutes = 390.0
        tau = trading_minutes / (total_trading_minutes * horizon_steps)

        # Per-step volatility
        # σ_step = σ_annual / √(bars_per_year)
        bars_per_day = total_trading_minutes / (trading_minutes / horizon_steps)
        bars_per_year = bars_per_day * 252
        sigma_step = annual_volatility / np.sqrt(bars_per_year)

        # Permanent impact coefficient
        # γ calibrated so that trading the entire order causes ~5-15 bps permanent shift
        # γ = permanent_bps * mid_price / (10000 * order_fraction_of_adv)
        # We set a baseline and let it scale with volatility
        gamma = 0.1 * sigma_step * mid_price

        # Temporary impact coefficient  
        # η calibrated via the square-root law:
        # temp_impact = η * σ * √(shares / (ADV * τ))
        # For 1% of ADV traded in one step, we want ~10 bps impact
        # η * σ * √(0.01 * ADV / (ADV * τ)) = 10 bps * mid_price / 10000
        # η = (10 * mid_price / 10000) / (σ * √(0.01 / τ))
        target_bps = 12.0  # ~12 bps for 1% ADV
        trade_fraction = 0.01
        sqrt_term = np.sqrt(trade_fraction / tau) if tau > 0 else 1.0
        eta = (target_bps * mid_price / 10000.0) / (sigma_step * sqrt_term + 1e-10)

        # Risk aversion: higher for more volatile stocks
        lambda_risk = 1e-6 * (annual_volatility / 0.20)  # normalized to 20% vol

        params = ImpactParams(
            gamma=gamma,
            eta=eta,
            alpha=0.5,  # square-root law
            sigma=sigma_step,
            tau=tau,
            adv=avg_daily_volume,
            lambda_risk=lambda_risk,
        )

        return cls(params)

    def temporary_impact(self, shares_traded: float, mid_price: float) -> float:
        """
        Calculate temporary market impact for a single trade.

        Uses the square-root law: impact = η * σ * |v / (ADV * τ)|^α * mid_price

        Args:
            shares_traded: Number of shares in this trade
            mid_price: Current mid price

        Returns:
            Price impact in dollars (added to fill price for buy orders)
        """
        if shares_traded <= 0 or self.params.adv <= 0:
            return 0.0

        # Normalize trade rate: shares per unit time relative to ADV
        trade_rate = abs(shares_traded) / (self.params.adv * self.params.tau + 1e-10)

        # Square-root temporary impact
        impact = self.params.eta * self.params.sigma * (trade_rate ** self.params.alpha)

        # Scale by price level
        return impact * mid_price

    def permanent_impact(self, shares_traded: float, mid_price: float) -> float:
        """
        Calculate permanent market impact for a single trade.

        Permanent impact shifts the mid price for all subsequent steps.
        impact = γ * (shares / ADV) * mid_price

        Args:
            shares_traded: Number of shares in this trade
            mid_price: Current mid price

        Returns:
            Permanent price shift in dollars
        """
        if shares_traded <= 0 or self.params.adv <= 0:
            return 0.0

        # Linear permanent impact (proportional to fraction of ADV)
        fraction = shares_traded / self.params.adv
        return self.params.gamma * fraction * mid_price

    def fill_price(
        self,
        shares_traded: float,
        mid_price: float,
        spread: float,
        is_buy: bool = True,
    ) -> float:
        """
        Calculate the all-in fill price including spread and impact.

        For a buy order:
          fill = mid + spread/2 + temporary_impact + permanent_impact/2

        Args:
            shares_traded: Number of shares to trade
            mid_price: Current mid price
            spread: Current bid-ask spread in dollars
            is_buy: True for buy orders, False for sell

        Returns:
            Expected fill price
        """
        if shares_traded <= 0:
            return mid_price

        temp_impact = self.temporary_impact(shares_traded, mid_price)
        perm_impact = self.permanent_impact(shares_traded, mid_price)

        direction = 1.0 if is_buy else -1.0

        # Fill price: cross the half-spread + temporary impact + half permanent impact
        fill = mid_price + direction * (spread / 2.0 + temp_impact + perm_impact / 2.0)

        return fill

    def execution_cost_bps(
        self,
        shares_traded: float,
        mid_price: float,
        spread: float,
        arrival_price: float,
        is_buy: bool = True,
    ) -> float:
        """
        Calculate execution cost in basis points relative to arrival price.

        Args:
            shares_traded: Number of shares
            mid_price: Current mid price
            spread: Current spread in dollars
            arrival_price: Price at decision time
            is_buy: True for buy orders

        Returns:
            Execution cost in basis points
        """
        fill = self.fill_price(shares_traded, mid_price, spread, is_buy)
        direction = 1.0 if is_buy else -1.0
        cost_bps = direction * (fill - arrival_price) / arrival_price * 10000.0
        return cost_bps

    def optimal_trajectory(
        self,
        total_shares: int,
        horizon: int,
        mid_price: float,
    ) -> np.ndarray:
        """
        Compute the Almgren-Chriss optimal execution trajectory.

        For the linear impact case, this has a closed-form exponential decay solution.
        The optimal trade schedule minimizes E[cost] + λ * Var[cost].

        Returns:
            Array of shape (horizon,) with optimal shares to trade at each step.
        """
        if horizon <= 0 or total_shares <= 0:
            return np.zeros(1)

        # For the linear AC model, the optimal strategy is a "tilted TWAP":
        # x_t = X * sinh(κ*(T-t)) / sinh(κ*T)
        # where κ = sqrt(λ * σ² / η)

        sigma = self.params.sigma
        eta = self.params.eta
        lambda_risk = self.params.lambda_risk

        # Urgency parameter
        kappa_sq = lambda_risk * (sigma ** 2) / (eta + 1e-10)
        kappa = np.sqrt(max(kappa_sq, 1e-12))

        # Inventory schedule
        inventory = np.zeros(horizon + 1)
        inventory[0] = total_shares

        for t in range(horizon):
            remaining_time = horizon - t
            if remaining_time > 0:
                inventory[t + 1] = total_shares * np.sinh(kappa * (remaining_time - 1)) / (np.sinh(kappa * remaining_time) + 1e-10)
            else:
                inventory[t + 1] = 0.0

        # Trade schedule is the difference
        trades = -np.diff(inventory)
        trades = np.maximum(trades, 0)  # no negative trades for a buy order

        # Ensure it sums to total_shares
        trades[-1] += total_shares - np.sum(trades)

        return trades

    def to_dict(self) -> dict:
        """Serialize parameters for API response."""
        return {
            "model": "almgren_chriss",
            "gamma": self.params.gamma,
            "eta": self.params.eta,
            "alpha": self.params.alpha,
            "sigma": self.params.sigma,
            "tau": self.params.tau,
            "adv": self.params.adv,
            "lambda_risk": self.params.lambda_risk,
        }
