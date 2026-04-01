import { useState } from 'react';

export default function SimulationControls({
  status,
  experiment,
  setExperiment,
  experiments,
  onStart,
  onPause,
  onResume,
  onStop,
}) {
  const [speed, setSpeed] = useState(1.0);
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const canStart = status === 'connected';

  return (
    <div className="panel controls-panel">
      <h3 className="panel-title">Simulation Controls</h3>

      <div className="control-row">
        <label className="control-label">Experiment</label>
        <select
          className="control-select"
          value={experiment}
          onChange={(e) => setExperiment(e.target.value)}
          disabled={isRunning || isPaused}
        >
          {Object.entries(experiments).map(([key, exp]) => (
            <option key={key} value={key}>{exp.name}</option>
          ))}
        </select>
      </div>

      {experiments[experiment] && (
        <div className="experiment-info">
          <p>{experiments[experiment].description}</p>
          <div className="experiment-tags">
            <span className="tag">{experiments[experiment].stim_rate} Hz</span>
            <span className="tag">{experiments[experiment].n_stim_neurons} neurons</span>
            <span className="tag">{experiments[experiment].brain_only ? 'Brain Only' : 'Embodied'}</span>
          </div>
        </div>
      )}

      <div className="control-row">
        <label className="control-label">Speed</label>
        <select
          className="control-select"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          disabled={isRunning || isPaused}
        >
          <option value={0.5}>0.5x (Slow)</option>
          <option value={1.0}>1x (Normal)</option>
          <option value={2.0}>2x (Fast)</option>
          <option value={5.0}>5x (Very Fast)</option>
        </select>
      </div>

      <div className="control-buttons">
        {canStart && (
          <button className="btn btn-start" onClick={() => onStart(speed)}>
            Start
          </button>
        )}
        {isRunning && (
          <>
            <button className="btn btn-pause" onClick={onPause}>Pause</button>
            <button className="btn btn-stop" onClick={onStop}>Stop</button>
          </>
        )}
        {isPaused && (
          <>
            <button className="btn btn-start" onClick={onResume}>Resume</button>
            <button className="btn btn-stop" onClick={onStop}>Stop</button>
          </>
        )}
        {status === 'disconnected' && (
          <div className="status-badge disconnected">Disconnected</div>
        )}
      </div>

      <div className="status-row">
        <span className={`status-dot ${isRunning ? 'active' : isPaused ? 'paused' : ''}`} />
        <span className="status-text">
          {status === 'disconnected' ? 'Offline' :
           isRunning ? 'Running' :
           isPaused ? 'Paused' : 'Ready'}
        </span>
      </div>
    </div>
  );
}
