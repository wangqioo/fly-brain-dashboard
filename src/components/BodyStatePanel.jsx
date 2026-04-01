export default function BodyStatePanel({ bodyState, currentCycle }) {
  if (!bodyState) {
    return (
      <div className="panel body-panel">
        <h3 className="panel-title">Body State</h3>
        <div className="panel-empty">
          {currentCycle ? 'Brain-only mode (no body)' : 'Waiting for data...'}
        </div>
      </div>
    );
  }

  const legs = bodyState.contact_forces || {};
  const maxForce = 0.5;

  return (
    <div className="panel body-panel">
      <h3 className="panel-title">Body State</h3>

      <div className="body-metrics">
        <div className="body-metric">
          <span className="body-metric-label">Position</span>
          <span className="body-metric-value">
            ({bodyState.position.x.toFixed(2)}, {bodyState.position.y.toFixed(2)})
          </span>
        </div>
        <div className="body-metric">
          <span className="body-metric-label">Velocity</span>
          <span className="body-metric-value">{bodyState.velocity.toFixed(3)} m/s</span>
        </div>
        <div className="body-metric">
          <span className="body-metric-label">Heading</span>
          <span className="body-metric-value">{bodyState.orientation.toFixed(1)} deg</span>
        </div>
      </div>

      <div className="leg-forces">
        <div className="leg-label">Contact Forces</div>
        <div className="leg-grid">
          {Object.entries(legs).map(([leg, force]) => (
            <div key={leg} className="leg-item">
              <div className="leg-name">{leg.replace(/_/g, ' ')}</div>
              <div className="leg-bar-bg">
                <div
                  className="leg-bar-fill"
                  style={{
                    width: `${(force / maxForce) * 100}%`,
                    opacity: 0.4 + (force / maxForce) * 0.6,
                  }}
                />
              </div>
              <div className="leg-value">{force.toFixed(3)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
