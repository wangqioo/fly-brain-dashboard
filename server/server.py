"""
FastAPI server for the Fly Brain Dashboard.
Provides REST endpoints, WebSocket streaming, and serves the built frontend.
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from mock_simulation import MockSimulation, EXPERIMENTS, NUM_NEURONS, SENSORY_CHANNELS

# Path to built frontend (vite build output)
DIST_DIR = Path(__file__).parent.parent / "dist"

active_connections: Dict[str, WebSocket] = {}
simulation = MockSimulation()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    simulation.stop()


app = FastAPI(title="Fly Brain Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/experiments")
async def list_experiments():
    return {"experiments": EXPERIMENTS}


@app.get("/api/config")
async def get_config():
    return {
        "num_neurons": NUM_NEURONS,
        "sync_interval_ms": 15.0,
        "brain_dt_ms": 0.1,
        "brain_steps_per_sync": 150,
        "body_timestep_ms": 0.1,
        "body_steps_per_sync": 150,
    }


@app.get("/api/status")
async def get_status():
    return {
        "running": simulation.running,
        "paused": simulation.paused,
        "experiment": simulation.experiment,
        "time_ms": simulation.current_time_ms,
        "sync_count": simulation.sync_count,
    }


@app.get("/api/sensory_channels")
async def get_sensory_channels():
    """Return available sensory channels and their current state."""
    return {
        "channels": SENSORY_CHANNELS,
        "state": simulation.get_sensory_summary(),
    }


@app.websocket("/ws/simulation")
async def simulation_ws(websocket: WebSocket):
    await websocket.accept()
    conn_id = str(id(websocket))
    active_connections[conn_id] = websocket

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            cmd = msg.get("command")

            if cmd == "start":
                exp_name = msg.get("experiment", "sugar_200hz")
                speed = msg.get("speed", 1.0)
                simulation.configure(exp_name)
                simulation.start(speed)
                await websocket.send_json({
                    "type": "status",
                    "status": "running",
                    "experiment": exp_name,
                })
                asyncio.create_task(_stream_data(websocket, speed))

            elif cmd == "pause":
                simulation.pause()
                await websocket.send_json({"type": "status", "status": "paused"})

            elif cmd == "resume":
                simulation.resume()
                await websocket.send_json({"type": "status", "status": "running"})

            elif cmd == "stop":
                simulation.stop()
                await websocket.send_json({"type": "status", "status": "stopped"})

            elif cmd == "set_stimulus":
                channel = msg.get("channel", "")
                active = msg.get("active", False)
                intensity = msg.get("intensity", 1.0)
                success = simulation.set_stimulus(channel, active, intensity)
                await websocket.send_json({
                    "type": "stimulus_ack",
                    "channel": channel,
                    "active": active,
                    "intensity": intensity,
                    "success": success,
                })

            elif cmd == "motor_override":
                mode = msg.get("mode", "brain")
                freq = msg.get("freq_modulation", 1.0)
                turn = msg.get("turn_bias", 0.0)
                simulation.set_motor_override(mode, freq, turn)
                await websocket.send_json({
                    "type": "motor_ack",
                    "mode": mode,
                    "freq_modulation": freq,
                    "turn_bias": turn,
                })

            elif cmd == "get_sensory":
                await websocket.send_json({
                    "type": "sensory_update",
                    "channels": simulation.get_sensory_summary(),
                })

    except WebSocketDisconnect:
        pass
    finally:
        active_connections.pop(conn_id, None)
        simulation.stop()


async def _stream_data(websocket: WebSocket, speed: float = 1.0):
    """Stream simulation data at realistic pace."""
    cumulative_spikes = 0
    interval = max(0.02, (15.0 / 1000.0) / speed)

    while simulation.running:
        if simulation.paused:
            await asyncio.sleep(0.1)
            continue

        try:
            cycle = simulation.generate_cycle()
            cumulative_spikes += cycle["brain_spikes"]
            cycle["cumulative_spikes"] = cumulative_spikes
            await websocket.send_json(cycle)
        except Exception:
            break

        await asyncio.sleep(interval)


# Serve built frontend static files (must be after API routes)
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the SPA - return index.html for all non-API routes."""
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(DIST_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
