import { useState, useCallback } from 'react';

const SENSORY_CHANNELS = [
  { id: 'sugar', label: 'Sugar GRNs', neurons: 129, color: '#22d3ee', modality: 'gustatory', icon: 'S' },
  { id: 'bitter', label: 'Bitter GRNs', neurons: 65, color: '#ef4444', modality: 'gustatory', icon: 'B' },
  { id: 'head_bristle', label: 'Head Bristle', neurons: 305, color: '#f59e0b', modality: 'mechano', icon: 'H' },
  { id: 'johnston_organ', label: "Johnston's Organ", neurons: 1095, color: '#a78bfa', modality: 'proprio', icon: 'J' },
  { id: 'wind_gravity', label: 'Wind / Gravity', neurons: 481, color: '#34d399', modality: 'gravity', icon: 'W' },
  { id: 'grooming', label: 'Grooming', neurons: 187, color: '#fb923c', modality: 'mechano', icon: 'G' },
  { id: 'eye_bristle', label: 'Eye Bristle', neurons: 120, color: '#f472b6', modality: 'mechano', icon: 'E' },
  { id: 'taste_peg', label: 'Taste Peg', neurons: 45, color: '#38bdf8', modality: 'gustatory', icon: 'T' },
];

export default function SensoryControlPanel({ onStimulusChange, status }) {
  const [channels, setChannels] = useState(() =>
    SENSORY_CHANNELS.reduce((acc, ch) => {
      acc[ch.id] = { active: false, intensity: 0.8 };
      return acc;
    }, {})
  );

  const isActive = status === 'running' || status === 'paused';

  const toggleChannel = useCallback((channelId) => {
    setChannels(prev => {
      const next = {
        ...prev,
        [channelId]: { ...prev[channelId], active: !prev[channelId].active }
      };
      onStimulusChange?.(channelId, next[channelId].active, next[channelId].intensity);
      return next;
    });
  }, [onStimulusChange]);

  const setIntensity = useCallback((channelId, value) => {
    setChannels(prev => {
      const next = {
        ...prev,
        [channelId]: { ...prev[channelId], intensity: value }
      };
      if (next[channelId].active) {
        onStimulusChange?.(channelId, true, value);
      }
      return next;
    });
  }, [onStimulusChange]);

  const activateAll = useCallback(() => {
    setChannels(prev => {
      const next = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], active: true };
        onStimulusChange?.(key, true, prev[key].intensity);
      }
      return next;
    });
  }, [onStimulusChange]);

  const deactivateAll = useCallback(() => {
    setChannels(prev => {
      const next = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], active: false };
        onStimulusChange?.(key, false, prev[key].intensity);
      }
      return next;
    });
  }, [onStimulusChange]);

  const activeCount = Object.values(channels).filter(c => c.active).length;

  return (
    <div className="panel sensory-control-panel">
      <div className="sensory-header">
        <h3 className="panel-title">Sensory Stimuli</h3>
        <div className="sensory-count">{activeCount}/{SENSORY_CHANNELS.length}</div>
      </div>

      <div className="sensory-quick-actions">
        <button
          className="btn-mini btn-activate"
          onClick={activateAll}
          disabled={!isActive}
        >All On</button>
        <button
          className="btn-mini btn-deactivate"
          onClick={deactivateAll}
          disabled={!isActive}
        >All Off</button>
      </div>

      <div className="sensory-channel-list">
        {SENSORY_CHANNELS.map(ch => {
          const state = channels[ch.id];
          return (
            <div
              key={ch.id}
              className={`sensory-channel-item ${state.active ? 'active' : ''}`}
              style={{ '--ch-color': ch.color }}
            >
              <div className="channel-toggle-row">
                <button
                  className={`channel-toggle ${state.active ? 'on' : ''}`}
                  onClick={() => toggleChannel(ch.id)}
                  disabled={!isActive}
                  title={state.active ? 'Deactivate' : 'Activate'}
                >
                  <span className="toggle-icon">{ch.icon}</span>
                </button>
                <div className="channel-info">
                  <span className="channel-name">{ch.label}</span>
                  <span className="channel-meta">{ch.neurons}n / {ch.modality}</span>
                </div>
                <div className="channel-rate">
                  {state.active ? `${Math.round(state.intensity * 200)}Hz` : 'OFF'}
                </div>
              </div>

              {state.active && (
                <div className="channel-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(state.intensity * 100)}
                    onChange={(e) => setIntensity(ch.id, parseInt(e.target.value) / 100)}
                    className="channel-slider"
                    disabled={!isActive}
                  />
                  <span className="slider-value">{Math.round(state.intensity * 100)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
