# ExecAgent — AI-Powered Order Execution Simulator & Dashboard

ExecAgent is a production-quality, fully functional web application demonstrating a Reinforcement Learning (RL) agent that learns to optimally execute large stock orders (e.g., buying 10,000 shares) on a simulated stock market. 

By utilizing **Soft Actor-Critic (SAC)** on a custom **Gymnasium** environment, the agent minimizes implementation shortfall (slippage vs. arrival price) and outperforms naive benchmarks (Time-Weighted Average Price, Volume-Weighted Average Price, Random).

---

## Architecture Diagram

```
                 +---------------------------------------------+
                 |            REACT 18 FRONTEND (Vite)         |
                 |  (Port: 5173 - pnpm dev / production build) |
                 +----------------------+--------------+-------+
                                        ^              |
                      JSON Steps Stream |              | HTTP REST requests
                            (WebSocket) |              | (stats, CSV uploads)
                                        |              v
                 +----------------------+--------------+-------+
                 |             FASTAPI BACKEND (Python)        |
                 |                (Port: 8000 - uv run)        |
                 +----------------------+----------------------+
                                        |
                 +----------------------+----------------------+
                 |               BACKEND ENGINE MODULES        |
                 |  * env.py   - Custom Gymnasium Environment   |
                 |  * agent.py - PyTorch SAC Actor-Critic Model|
                 |  * train.py - Model Trainer & Evaluator     |
                 +---------------------------------------------+
```

---

## Interface Pages & Features

### Page 1 — Live Execution Simulator
* **Live Order Book Depth Ladder**: A real-time vertical bid/ask queue display with centered mid-price, dynamic spreads, and visual volume depth bars (Framer Motion 100ms slide transition animations).
* **"Run Episode" Button**: Opens a WebSocket stream to run a fresh simulation step-by-step.
* **Side-by-Side Execution Curves**: Recharts line chart graphing cumulative average fill prices for the SAC Agent (solid indigo), TWAP baseline (dashed gray), and VWAP baseline (dashed emerald).
* **Live Metrics Panel**: Displays shares remaining, shortfall in basis points (with green/red delta badges comparing vs. TWAP), average fill price, and elapsed time.
* **Order Blotter Table**: Displays alternating rows showing individual fills. Clicking a row highlights the corresponding step index across all graphs.
* **Strategy Toggle**: Swaps the active display strategy mid-episode to inspect individual policy stats.
* **Confetti Celebration**: Fires a confetti burst on episode completion if the SAC Agent beats the TWAP baseline.

### Page 2 — Training Dashboard
* **Training Reward Curve**: Displays the raw and smoothed episode rewards across 150 training epochs.
* **Shortfall Distribution Box Plot**: Displays a custom range-bar chart showing Min, Q1, Median, Q3, and Max values for each policy over 500 test trials.
* **Reward Components Breakdown**: Stacked bar chart showing slippage penalty vs. urgency penalty.
* **Ablation Study Selector**: Switches stats to compare rewards under Slippage-Only, Slippage + Urgency, and Full Reward configurations.
* **Regime Analysis**: Compares average basis points slippage in Low Volatility (10%) vs. High Volatility (30%) market conditions.

### Page 3 — Agent Inspector
* **State Observation Radar Chart**: Displays the 7 state inputs (spread, imbalance, time, inventory, 5s momentum, 20s momentum, and volatility) for the selected or active step.
* **Action Timeline Distribution**: Shows the fraction of inventory traded at each step, demonstrating how the agent accelerates trades near the horizon.
* **Policy Heatmap Grid**: A 10x10 color-coded grid representing Inventory Remaining vs. Time Elapsed, illustrating the policy's action magnitudes.
* **Q-Value Estimates**: Lines charting $Q_1$ and $Q_2$ critic networks over the episode.

### Page 4 — Configuration
* **Interactive Sliders**: Adjust Order Size, Horizon steps, and Market Impact Coefficient.
* **Live Preview Curve**: Changing any slider immediately runs a local simulation to display a preview execution curve instantly.
* **CSV Tick Upload Zone**: Drag-and-drop csv files containing historical tick prices (requires a column named `price`).
* **Episode Log Export**: Downloads the complete comparison statistics of the latest run in a clean CSV format.

---

## Setup & Running Instructions

### Prerequisites
* **Python 3.12+** (Backend packages require Python)
* **Node.js 18+** & **pnpm** (Frontend client packages)
* **uv** package manager for Python

### 1. Backend Setup
Initialize the virtual environment, install dependencies, and generate weights/statistics:
```bash
# Navigate to backend directory
cd backend

# Install dependencies (CPU-only PyTorch for speed and size)
uv add fastapi uvicorn torch gymnasium numpy pandas websockets --index https://download.pytorch.org/whl/cpu

# Run training to generate pre-trained weights & stats files (takes ~15 seconds)
uv run train.py
```
This writes `sac_weights.pth` and `training_stats.json` in the `backend/` directory.

Start the FastAPI application:
```bash
# From workspace root
uv run backend/main.py
```
The server will start running at `http://127.0.0.1:8000`.

### 2. Frontend Setup
Install frontend libraries and start the Vite development server:
```bash
# Navigate to frontend directory
cd frontend

# Install node modules
pnpm install

# Start Vite dev server
pnpm dev
```
The client dashboard will open at `http://localhost:5173`.
