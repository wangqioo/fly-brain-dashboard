"""
Mock simulation that generates realistic data matching the embodied-fly output format.
Used when the full simulation stack (PyTorch, FlyWire data, flygym) is unavailable.
"""

import asyncio
import math
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


EXPERIMENTS = {
    "sugar_200hz": {
        "name": "sugar_200hz",
        "description": "Activate 21 sugar GRNs at 200 Hz (canonical Shiu et al.)",
        "stim_rate": 200.0,
        "duration_ms": 1000.0,
        "n_stim_neurons": 21,
        "brain_only": True,
    },
    "sugar_100hz": {
        "name": "sugar_100hz",
        "description": "Activate 21 sugar GRNs at 100 Hz",
        "stim_rate": 100.0,
        "duration_ms": 1000.0,
        "n_stim_neurons": 21,
        "brain_only": True,
    },
    "p9_forward": {
        "name": "p9_forward",
        "description": "Activate P9 descending neurons for forward walking at 100 Hz",
        "stim_rate": 100.0,
        "duration_ms": 1000.0,
        "n_stim_neurons": 2,
        "brain_only": True,
    },
    "p9_forward_embodied": {
        "name": "p9_forward_embodied",
        "description": "P9 activation with embodied body simulation (forward walking)",
        "stim_rate": 100.0,
        "duration_ms": 5000.0,
        "n_stim_neurons": 2,
        "brain_only": False,
    },
    "sugar_embodied": {
        "name": "sugar_embodied",
        "description": "Sugar stimulus with full brain-body coupling",
        "stim_rate": 200.0,
        "duration_ms": 10000.0,
        "n_stim_neurons": 21,
        "brain_only": False,
    },
    "sugar_quick": {
        "name": "sugar_quick",
        "description": "Quick sugar test (100ms, 1 trial)",
        "stim_rate": 200.0,
        "duration_ms": 100.0,
        "n_stim_neurons": 21,
        "brain_only": True,
    },
    "p9_quick": {
        "name": "p9_quick",
        "description": "Quick P9 test (100ms, 1 trial)",
        "stim_rate": 100.0,
        "duration_ms": 100.0,
        "n_stim_neurons": 2,
        "brain_only": True,
    },
}

NUM_NEURONS = 139255
SYNC_INTERVAL_MS = 15.0


class MockSimulation:
    """Generates realistic simulation data streams."""

    def __init__(self):
        self.running = False
        self.paused = False
        self.experiment: Optional[str] = None
        self.current_time_ms = 0.0
        self.sync_count = 0
        self._start_wall_time = 0.0
        self._base_spike_rate = 0.0
        self._stim_neurons = 0
        self._brain_only = True
        self._sensory_channels: List[str] = []
        self._speed = 1.0

    def configure(self, experiment_name: str):
        exp = EXPERIMENTS.get(experiment_name)
        if not exp:
            raise ValueError(f"Unknown experiment: {experiment_name}")
        self.experiment = experiment_name
        self._base_spike_rate = exp["stim_rate"] * exp["n_stim_neurons"] * 0.8
        self._stim_neurons = exp["n_stim_neurons"]
        self._brain_only = exp["brain_only"]
        if not self._brain_only:
            self._sensory_channels = ["sugar", "head_bristle", "johnston_organ"]
        else:
            self._sensory_channels = []

    def start(self, speed: float = 1.0):
        self.running = True
        self.paused = False
        self.current_time_ms = 0.0
        self.sync_count = 0
        self._start_wall_time = time.time()
        self._speed = speed

    def pause(self):
        self.paused = True

    def resume(self):
        self.paused = False

    def stop(self):
        self.running = False
        self.paused = False

    def generate_cycle(self) -> Dict:
        """Generate one sync cycle of mock data."""
        self.sync_count += 1
        self.current_time_ms += SYNC_INTERVAL_MS
        t = self.current_time_ms / 1000.0

        # Realistic spike count with ramp-up and noise
        ramp = min(1.0, t / 0.2)  # 200ms ramp-up
        noise = random.gauss(0, 0.15)
        oscillation = 0.1 * math.sin(2 * math.pi * 0.5 * t)
        base = self._base_spike_rate * SYNC_INTERVAL_MS / 1000.0
        brain_spikes = max(0, int(base * ramp * (1.0 + noise + oscillation)))

        # CPG parameters (smooth with some dynamics)
        if self._brain_only:
            freq_mod = 1.0
            turn_bias = 0.0
        else:
            freq_mod = 1.0 + 0.3 * ramp * math.sin(2 * math.pi * 0.2 * t) + random.gauss(0, 0.02)
            freq_mod = max(0.5, min(2.0, freq_mod))
            turn_bias = 0.15 * math.sin(2 * math.pi * 0.1 * t + 0.5) + random.gauss(0, 0.03)
            turn_bias = max(-1.0, min(1.0, turn_bias))

        # Wall time (simulate ~0.3x real-time ratio)
        cycle_wall_time = (SYNC_INTERVAL_MS / 1000.0) / 0.3 + random.gauss(0, 0.005)

        # Generate spike raster data (subset of neurons for visualization)
        n_display = min(500, NUM_NEURONS)
        spikes = []
        for i in range(brain_spikes):
            neuron_idx = random.randint(0, n_display - 1)
            spike_time = self.current_time_ms - SYNC_INTERVAL_MS + random.uniform(0, SYNC_INTERVAL_MS)
            spikes.append({"neuron": neuron_idx, "time": round(spike_time, 2)})

        # Top firing neurons
        n_top = 20
        top_neurons = []
        for i in range(n_top):
            rate = max(0, random.gauss(50 - i * 2, 8) * ramp)
            top_neurons.append({
                "neuron_idx": random.randint(0, NUM_NEURONS - 1),
                "rate": round(rate, 1),
                "label": f"N{random.randint(1000, 9999)}"
            })
        top_neurons.sort(key=lambda x: x["rate"], reverse=True)

        # Firing rate distribution
        rate_bins = [0, 5, 10, 20, 50, 100, 200, 500]
        rate_hist = []
        total_active = int(200 * ramp + random.gauss(0, 20))
        remaining = max(0, total_active)
        for i in range(len(rate_bins) - 1):
            frac = max(0, (0.4 / (i + 1)) + random.gauss(0, 0.05))
            count = max(0, int(remaining * frac))
            rate_hist.append({
                "bin": f"{rate_bins[i]}-{rate_bins[i+1]}",
                "count": count
            })
            remaining -= count
        if remaining > 0:
            rate_hist.append({"bin": "500+", "count": remaining})

        # Body state (position, velocity)
        body_state = None
        if not self._brain_only:
            speed_val = 0.5 * freq_mod * ramp
            body_state = {
                "position": {
                    "x": round(speed_val * t * math.cos(turn_bias * 0.5), 3),
                    "y": round(speed_val * t * math.sin(turn_bias * 0.5), 3),
                    "z": round(0.002 + random.gauss(0, 0.0001), 5),
                },
                "velocity": round(speed_val + random.gauss(0, 0.02), 3),
                "orientation": round(turn_bias * t * 30, 1) % 360,
                "contact_forces": {
                    "left_front": round(random.uniform(0, 0.5), 3),
                    "right_front": round(random.uniform(0, 0.5), 3),
                    "left_mid": round(random.uniform(0, 0.5), 3),
                    "right_mid": round(random.uniform(0, 0.5), 3),
                    "left_hind": round(random.uniform(0, 0.5), 3),
                    "right_hind": round(random.uniform(0, 0.5), 3),
                },
            }

        # Active sensory channels
        active_sensory = []
        if not self._brain_only:
            for ch in self._sensory_channels:
                if random.random() > 0.2:
                    active_sensory.append(ch)

        elapsed = time.time() - self._start_wall_time
        rt_ratio = (self.current_time_ms / 1000.0) / elapsed if elapsed > 0 else 0

        return {
            "type": "cycle",
            "sync": self.sync_count,
            "time_ms": round(self.current_time_ms, 1),
            "brain_spikes": brain_spikes,
            "cycle_wall_time": round(cycle_wall_time, 4),
            "cpg_params": {
                "freq_modulation": round(freq_mod, 4),
                "turn_bias": round(turn_bias, 4),
            },
            "active_sensory": active_sensory,
            "spikes": spikes,
            "top_neurons": top_neurons,
            "rate_histogram": rate_hist,
            "body_state": body_state,
            "cumulative_spikes": 0,  # filled by caller
            "rt_ratio": round(rt_ratio, 3),
            "total_neurons": NUM_NEURONS,
            "display_neurons": min(500, NUM_NEURONS),
        }
