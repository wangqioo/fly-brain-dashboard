export default function MetricsPanel({ currentCycle, cumulativeSpikes, config }) {
  const metrics = [
    {
      label: 'Sim Time',
      value: currentCycle ? `${(currentCycle.time_ms / 1000).toFixed(2)}s` : '--',
      sub: `${currentCycle?.sync || 0} cycles`,
    },
    {
      label: 'Spikes / Cycle',
      value: currentCycle?.brain_spikes?.toLocaleString() || '--',
      sub: `${cumulativeSpikes.toLocaleString()} total`,
    },
    {
      label: 'RT Ratio',
      value: currentCycle ? `${currentCycle.rt_ratio}x` : '--',
      sub: currentCycle ? `${(currentCycle.cycle_wall_time * 1000).toFixed(1)}ms/cycle` : '',
    },
    {
      label: 'Neurons',
      value: config ? config.num_neurons.toLocaleString() : '--',
      sub: `${config?.sync_interval_ms || 15}ms sync`,
    },
  ];

  const cpg = currentCycle?.cpg_params;

  return (
    <div className="panel metrics-panel">
      <h3 className="panel-title">Metrics</h3>

      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {cpg && (
        <div className="cpg-gauges">
          <div className="gauge">
            <div className="gauge-label">Freq Modulation</div>
            <div className="gauge-bar-bg">
              <div
                className="gauge-bar-fill freq"
                style={{ width: `${((cpg.freq_modulation - 0.5) / 1.5) * 100}%` }}
              />
            </div>
            <div className="gauge-value">{cpg.freq_modulation.toFixed(3)}</div>
          </div>
          <div className="gauge">
            <div className="gauge-label">Turn Bias</div>
            <div className="gauge-bar-bg">
              <div
                className="gauge-bar-fill turn"
                style={{
                  width: `${Math.abs(cpg.turn_bias) * 50}%`,
                  marginLeft: cpg.turn_bias >= 0 ? '50%' : `${50 - Math.abs(cpg.turn_bias) * 50}%`,
                }}
              />
            </div>
            <div className="gauge-value">{cpg.turn_bias.toFixed(3)}</div>
          </div>
        </div>
      )}

      {currentCycle?.active_sensory?.length > 0 && (
        <div className="sensory-channels">
          <div className="sensory-label">Active Sensory</div>
          <div className="sensory-tags">
            {currentCycle.active_sensory.map((ch, i) => (
              <span key={i} className="sensory-tag">{ch}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
