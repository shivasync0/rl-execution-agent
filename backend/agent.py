import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class Actor(nn.Module):
    """
    Gaussian Actor (Policy) network for continuous action space [0, 1].
    """
    def __init__(self, state_dim=7, action_dim=1, hidden_dim=256, log_std_min=-20, log_std_max=2):
        super(Actor, self).__init__()
        self.log_std_min = log_std_min
        self.log_std_max = log_std_max
        
        self.fc1 = nn.Linear(state_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        
        self.mean_linear = nn.Linear(hidden_dim, action_dim)
        self.log_std_linear = nn.Linear(hidden_dim, action_dim)
        
    def forward(self, state):
        x = F.relu(self.fc1(state))
        x = F.relu(self.fc2(x))
        
        mean = self.mean_linear(x)
        log_std = self.log_std_linear(x)
        log_std = torch.clamp(log_std, min=self.log_std_min, max=self.log_std_max)
        
        return mean, log_std

    def sample(self, state, deterministic=False):
        """
        Samples an action from the policy.
        Returns:
          - action: scaled to [0, 1]
          - log_prob: log probability of action
          - mean: mean of distribution
          - std: standard deviation
        """
        mean, log_std = self.forward(state)
        std = log_std.exp()
        
        if deterministic:
            # Deterministic: use the mean action squashed by tanh
            tanh_mean = torch.tanh(mean)
            # Map [-1, 1] -> [0, 1]
            action = (tanh_mean + 1.0) / 2.0
            log_prob = torch.zeros_like(mean)
        else:
            # Sample using reparameterization trick
            normal = torch.distributions.Normal(mean, std)
            x_t = normal.rsample()  # for reparameterization trick (mean + std * N(0,1))
            y_t = torch.tanh(x_t)
            
            # Map [-1, 1] -> [0, 1]
            action = (y_t + 1.0) / 2.0
            
            # Adjust log_prob for tanh squashing and scaling
            # Scale factor: action = (y + 1)/2 => dy/da = 2 => log(2) addition
            # Log prob of normal distribution
            log_prob = normal.log_prob(x_t) - torch.log(1.0 - y_t.pow(2) + 1e-6) - np.log(2.0)
            log_prob = log_prob.sum(-1, keepdim=True)
            
        return action, log_prob, mean, std


class Critic(nn.Module):
    """
    Q-value Critic network. Takes state and action, returns Q(s, a).
    """
    def __init__(self, state_dim=7, action_dim=1, hidden_dim=256):
        super(Critic, self).__init__()
        
        # Q1 network
        self.q1_fc1 = nn.Linear(state_dim + action_dim, hidden_dim)
        self.q1_fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.q1_out = nn.Linear(hidden_dim, 1)
        
        # Q2 network
        self.q2_fc1 = nn.Linear(state_dim + action_dim, hidden_dim)
        self.q2_fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.q2_out = nn.Linear(hidden_dim, 1)
        
    def forward(self, state, action):
        sa = torch.cat([state, action], dim=-1)
        
        # Q1 forward
        x1 = F.relu(self.q1_fc1(sa))
        x1 = F.relu(self.q1_fc2(x1))
        q1 = self.q1_out(x1)
        
        # Q2 forward
        x2 = F.relu(self.q2_fc1(sa))
        x2 = F.relu(self.q2_fc2(x2))
        q2 = self.q2_out(x2)
        
        return q1, q2


class SACAgent:
    """
    SACAgent encapsulates Actor and Critic networks and manages inference and weight loading.
    """
    def __init__(self, state_dim=7, action_dim=1, device="cpu"):
        self.device = torch.device(device)
        self.actor = Actor(state_dim, action_dim).to(self.device)
        self.critic = Critic(state_dim, action_dim).to(self.device)
        
    def select_action(self, state, deterministic=True):
        """
        Select action for environment step. State is a numpy array.
        """
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            action_t, _, _, _ = self.actor.sample(state_t, deterministic=deterministic)
        return action_t.cpu().numpy()[0]
        
    def get_q_values(self, state, action):
        """
        Get Q1 and Q2 values for a state and action (numpy arrays).
        """
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        action_t = torch.FloatTensor([action]).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q1, q2 = self.critic(state_t, action_t)
        return float(q1.cpu().numpy()[0][0]), float(q2.cpu().numpy()[0][0])
        
    def save_weights(self, path):
        torch.save({
            'actor_state_dict': self.actor.state_dict(),
            'critic_state_dict': self.critic.state_dict()
        }, path)
        
    def load_weights(self, path):
        checkpoint = torch.load(path, map_location=self.device, weights_only=True)
        self.actor.load_state_dict(checkpoint['actor_state_dict'])
        self.critic.load_state_dict(checkpoint['critic_state_dict'])
        self.actor.eval()
        self.critic.eval()
