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

# All sensory channels matching the real embodied-fly SensoryEncoder
SENSORY_CHANNELS = {
    "sugar": {"neurons": 129, "rate_on": 200.0, "modality": "gustatory"},
    "bitter": {"neurons": 65, "rate_on": 200.0, "modality": "gustatory"},
    "taste_peg": {"neurons": 45, "rate_on": 150.0, "modality": "gustatory"},
    "head_bristle": {"neurons": 305, "rate_on": 100.0, "modality": "mechano"},
    "eye_bristle": {"neurons": 120, "rate_on": 80.0, "modality": "mechano"},
    "grooming": {"neurons": 187, "rate_on": 50.0, "modality": "mechano"},
    "johnston_organ": {"neurons": 1095, "rate_on": 60.0, "modality": "proprio"},
    "wind_gravity": {"neurons": 481, "rate_on": 80.0, "modality": "gravity"},
}

NUM_NEURONS = 139255
SYNC_INTERVAL_MS = 15.0


class MockSimulation:
    """Generates realistic simulation data streams with interactive stimulus control."""

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
        self._speed = 1.0

        # Interactive sensory state
        self._sensory_active: Dict[str, bool] = {}
        self._sensory_intensity: Dict[str, float] = {}
        for ch_id in SENSORY_CHANNELS:
            self._sensory_active[ch_id] = False
            self._sensory_intensity[ch_id] = 0.0

        # Body state for embodied mode
        self._body_x = 0.0
        self._body_y = 0.0
        self._body_heading = 0.0
        self._body_speed = 0.0
        # Gait phase for tripod pattern
        self._gait_phase = 0.0

        # Motor override (manual/hybrid control)
        self._motor_mode = "brain"  # brain | manual | hybrid
        self._manual_freq = 1.0
        self._manual_turn = 0.0

    def configure(self, experiment_name: str):
        exp = EXPERIMENTS.get(experiment_name)
        if not exp:
            raise ValueError(f"Unknown experiment: {experiment_name}")
        self.experiment = experiment_name
        self._base_spike_rate = exp["stim_rate"] * exp["n_stim_neurons"] * 0.8
        self._stim_neurons = exp["n_stim_neurons"]
        self._brain_only = exp["brain_only"]

        # Reset sensory channels
        for ch_id in SENSORY_CHANNELS:
            self._sensory_active[ch_id] = False
            self._sensory_intensity[ch_id] = 0.0

        # Auto-activate relevant channels for experiment
        if "sugar" in experiment_name:
            self._sensory_active["sugar"] = True
            self._sensory_intensity["sugar"] = 1.0
        if "p9" in experiment_name:
            pass  # P9 are descending neurons, not sensory

        # Reset body
        self._body_x = 0.0
        self._body_y = 0.0
        self._body_heading = 0.0
        self._body_speed = 0.0
        self._gait_phase = 0.0

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

    def set_motor_override(self, mode: str, freq: float = 1.0, turn: float = 0.0):
        """Set motor control mode and manual override values."""
        self._motor_mode = mode  # brain, manual, hybrid
        self._manual_freq = max(0.0, min(2.0, freq))
        self._manual_turn = max(-1.0, min(1.0, turn))

    def set_stimulus(self, channel: str, active: bool, intensity: float = 1.0):
        """Set a sensory channel's state (called from WebSocket command)."""
        if channel in SENSORY_CHANNELS:
            self._sensory_active[channel] = active
            self._sensory_intensity[channel] = max(0.0, min(1.0, intensity))
            return True
        return False

    def get_sensory_summary(self) -> Dict:
        """Return current state of all sensory channels."""
        result = {}
        for ch_id, ch_info in SENSORY_CHANNELS.items():
            result[ch_id] = {
                "active": self._sensory_active[ch_id],
                "intensity": self._sensory_intensity[ch_id],
                "neurons": ch_info["neurons"],
                "modality": ch_info["modality"],
                "effective_rate": (
                    ch_info["rate_on"] * self._sensory_intensity[ch_id]
                    if self._sensory_active[ch_id] else 0.0
                ),
            }
        return result

    def _compute_stimulus_contribution(self) -> float:
        """Compute extra spike rate from active sensory channels."""
        extra = 0.0
        for ch_id, ch_info in SENSORY_CHANNELS.items():
            if self._sensory_active[ch_id]:
                rate = ch_info["rate_on"] * self._sensory_intensity[ch_id]
                n = ch_info["neurons"]
                extra += rate * n * 0.003  # scale factor for spikes/cycle
        return extra

    def generate_cycle(self) -> Dict:
        """Generate one sync cycle of mock data."""
        self.sync_count += 1
        self.current_time_ms += SYNC_INTERVAL_MS
        t = self.current_time_ms / 1000.0

        # Realistic spike count with ramp-up and noise
        ramp = min(1.0, t / 0.2)
        noise = random.gauss(0, 0.15)
        oscillation = 0.1 * math.sin(2 * math.pi * 0.5 * t)
        base = self._base_spike_rate * SYNC_INTERVAL_MS / 1000.0
        stimulus_extra = self._compute_stimulus_contribution()
        brain_spikes = max(0, int((base + stimulus_extra) * ramp * (1.0 + noise + oscillation)))

        # CPG parameters influenced by sensory state and motor override
        if self._brain_only:
            brain_freq = 1.0
            brain_turn = 0.0
        else:
            # Base CPG dynamics from brain
            brain_freq = 1.0 + 0.3 * ramp * math.sin(2 * math.pi * 0.2 * t) + random.gauss(0, 0.02)

            # Sensory modulation of CPG
            if self._sensory_active.get("sugar"):
                brain_freq += 0.2 * self._sensory_intensity.get("sugar", 0) * ramp
            if self._sensory_active.get("bitter"):
                brain_freq -= 0.3 * self._sensory_intensity.get("bitter", 0) * ramp

            brain_freq = max(0.5, min(2.0, brain_freq))

            brain_turn = 0.15 * math.sin(2 * math.pi * 0.1 * t + 0.5) + random.gauss(0, 0.03)
            if self._sensory_active.get("wind_gravity"):
                brain_turn += 0.2 * self._sensory_intensity.get("wind_gravity", 0) * math.sin(t * 0.3)
            brain_turn = max(-1.0, min(1.0, brain_turn))

        # Apply motor override mode
        if self._motor_mode == "manual":
            freq_mod = self._manual_freq
            turn_bias = self._manual_turn
        elif self._motor_mode == "hybrid":
            # Blend: 50% brain + 50% manual
            freq_mod = 0.5 * brain_freq + 0.5 * self._manual_freq
            turn_bias = 0.5 * brain_turn + 0.5 * self._manual_turn
        else:
            freq_mod = brain_freq
            turn_bias = brain_turn

        freq_mod = max(0.0, min(2.0, freq_mod))
        turn_bias = max(-1.0, min(1.0, turn_bias))

        # Wall time
        cycle_wall_time = (SYNC_INTERVAL_MS / 1000.0) / 0.3 + random.gauss(0, 0.005)

        # Generate spike raster data
        n_display = min(500, NUM_NEURONS)
        spikes = []
        for i in range(brain_spikes):
            neuron_idx = random.randint(0, n_display - 1)
            spike_time = self.current_time_ms - SYNC_INTERVAL_MS + random.uniform(0, SYNC_INTERVAL_MS)
            spikes.append({"neuron": neuron_idx, "time": round(spike_time, 2)})

        # Top firing neurons - influenced by active channels
        n_top = 20
        top_neurons = []
        for i in range(n_top):
            rate = max(0, random.gauss(50 - i * 2, 8) * ramp)
            # Boost rates when more channels are active
            active_count = sum(1 for v in self._sensory_active.values() if v)
            rate *= (1.0 + active_count * 0.1)
            top_neurons.append({
                "neuron_idx": random.randint(0, NUM_NEURONS - 1),
                "rate": round(rate, 1),
                "label": f"N{random.randint(1000, 9999)}"
            })
        top_neurons.sort(key=lambda x: x["rate"], reverse=True)

        # Firing rate distribution
        rate_bins = [0, 5, 10, 20, 50, 100, 200, 500]
        rate_hist = []
        total_active = int((200 + stimulus_extra * 2) * ramp + random.gauss(0, 20))
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

        # Body state with realistic dynamics
        body_state = None
        if not self._brain_only:
            dt = SYNC_INTERVAL_MS / 1000.0
            self._body_speed = 0.5 * freq_mod * ramp + random.gauss(0, 0.01)
            self._body_heading += turn_bias * 30 * dt + random.gauss(0, 0.5)
            heading_rad = math.radians(self._body_heading)
            self._body_x += self._body_speed * dt * math.cos(heading_rad)
            self._body_y += self._body_speed * dt * math.sin(heading_rad)
            self._gait_phase += freq_mod * dt * 10  # CPG phase advance

            # Tripod gait: alternating stance/swing
            phase = self._gait_phase
            # Tripod A: LF, RM, LH (in phase)
            # Tripod B: RF, LM, RH (anti-phase)
            tripod_a_stance = math.sin(phase) > 0  # True when tripod A is in stance
            noise_f = lambda: random.gauss(0, 0.02)

            # Generate per-leg joint angles (7 DOF each, 42 total)
            # Joints: ThC_yaw, ThC_pitch, ThC_roll, CTr_pitch, CTr_roll, FTi_pitch, TiTa_pitch
            joint_angles = {}
            leg_names = ["LF", "RF", "LM", "RM", "LH", "RH"]
            for li, ln in enumerate(leg_names):
                is_tripod_a = ln in ("LF", "RM", "LH")
                lp = phase if is_tripod_a else phase + math.pi
                sw = math.sin(lp)
                st = sw > 0  # stance
                side = 1 if ln.startswith("L") else -1

                joint_angles[ln] = {
                    "ThC_yaw":   round(side * 0.2 * sw, 4),
                    "ThC_pitch": round(-0.3 + (0.15 if st else -0.25 * abs(sw)), 4),
                    "ThC_roll":  round(side * 0.1 * sw, 4),
                    "CTr_pitch": round(-0.6 + (0.1 if st else -0.2 * abs(sw)), 4),
                    "CTr_roll":  round(random.gauss(0, 0.02), 4),
                    "FTi_pitch": round(0.8 + (-0.1 if st else 0.3 * abs(sw)), 4),
                    "TiTa_pitch": round(0.3 + (0.2 if st else 0), 4),
                }

            body_state = {
                "position": {
                    "x": round(self._body_x, 4),
                    "y": round(self._body_y, 4),
                    "z": round(0.002 + random.gauss(0, 0.0001), 5),
                },
                "velocity": round(self._body_speed, 3),
                "orientation": round(self._body_heading % 360, 1),
                "gait_phase": round(phase % (2 * math.pi), 4),
                "joint_angles": joint_angles,
                "contact_forces": {
                    "left_front":  round(max(0, (0.35 if tripod_a_stance else 0.02) + noise_f()), 3),
                    "right_front": round(max(0, (0.02 if tripod_a_stance else 0.35) + noise_f()), 3),
                    "left_mid":    round(max(0, (0.02 if tripod_a_stance else 0.35) + noise_f()), 3),
                    "right_mid":   round(max(0, (0.35 if tripod_a_stance else 0.02) + noise_f()), 3),
                    "left_hind":   round(max(0, (0.35 if tripod_a_stance else 0.02) + noise_f()), 3),
                    "right_hind":  round(max(0, (0.02 if tripod_a_stance else 0.35) + noise_f()), 3),
                },
            }

        # Active sensory channels
        active_sensory = [ch for ch, active in self._sensory_active.items() if active]

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
            "motor_mode": self._motor_mode,
            "active_sensory": active_sensory,
            "sensory_channels": self.get_sensory_summary(),
            "spikes": spikes,
            "top_neurons": top_neurons,
            "rate_histogram": rate_hist,
            "body_state": body_state,
            "cumulative_spikes": 0,
            "rt_ratio": round(rt_ratio, 3),
            "total_neurons": NUM_NEURONS,
            "display_neurons": min(500, NUM_NEURONS),
        }
