import unittest
import numpy as np
from env import ExecutionEnv

class TestExecutionEnv(unittest.TestCase):
    def setUp(self):
        self.env = ExecutionEnv(order_size=10000, horizon=20, market_impact=0.0001, volatility_regime="low")

    def test_reset(self):
        state, info = self.env.reset(seed=42)
        
        # Verify state shape (7 features)
        self.assertEqual(state.shape, (7,))
        self.assertEqual(state.dtype, np.float32)
        
        # Verify info fields
        self.assertEqual(info["step"], 0)
        self.assertEqual(info["inventory_remaining"], 10000.0)
        self.assertEqual(info["total_executed"], 0.0)
        self.assertEqual(info["avg_fill_price"], 0.0)
        self.assertEqual(info["shortfall_bps"], 0.0)
        self.assertTrue(len(info["bids"]) > 0)
        self.assertTrue(len(info["asks"]) > 0)

    def test_step_mechanics(self):
        self.env.reset(seed=42)
        
        # Step with 10% inventory execution
        action = np.array([0.1], dtype=np.float32)
        state, reward, terminated, truncated, info = self.env.step(action)
        
        self.assertEqual(info["step"], 1)
        # 10% of 10000 is 1000 shares
        self.assertEqual(info["total_executed"], 1000.0)
        self.assertEqual(info["inventory_remaining"], 9000.0)
        self.assertFalse(terminated)
        self.assertFalse(truncated)
        
        # Verify reward component logging
        self.assertIn("reward_components", info)
        components = info["reward_components"]
        self.assertIn("slippage_penalty", components)
        self.assertIn("urgency_penalty", components)
        self.assertIn("completion_bonus", components)
        self.assertIn("total_reward", components)

    def test_terminal_sweep(self):
        self.env.reset(seed=42)
        
        # Run 19 idle steps
        for _ in range(19):
            action = np.array([0.0], dtype=np.float32)
            state, reward, terminated, truncated, info = self.env.step(action)
            
        self.assertEqual(info["step"], 19)
        self.assertEqual(info["inventory_remaining"], 10000.0)
        
        # Final step: action is ignored and forced sweep is triggered
        action = np.array([0.0], dtype=np.float32)
        state, reward, terminated, truncated, info = self.env.step(action)
        
        self.assertEqual(info["step"], 20)
        self.assertEqual(info["inventory_remaining"], 0.0)
        self.assertEqual(info["total_executed"], 10000.0)
        self.assertTrue(terminated)
        
        # Check that completion bonus is added or final slippage is registered
        self.assertTrue(info["reward_components"]["completion_bonus"] > 0)

if __name__ == "__main__":
    unittest.main()
