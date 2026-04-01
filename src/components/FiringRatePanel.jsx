export default function FiringRatePanel({ topNeurons, rateHistogram }) {
  if (!topNeurons?.length) {
    return (
      <div className="panel firing-panel">
        <h3 className="panel-title">Firing Rates</h3>
        <div className="panel-empty">Waiting for data...</div>
      </div>
    );
  }

  const maxRate = Math.max(...topNeurons.map(n => n.rate), 1);

  return (
    <div className="panel firing-panel">
      <h3 className="panel-title">Top Firing Neurons</h3>
      <div className="firing-bars">
        {topNeurons.slice(0, 12).map((n, i) => (
          <div key={i} className="firing-bar-row">
            <span className="firing-label">{n.label}</span>
            <div className="firing-bar-bg">
              <div
                className="firing-bar-fill"
                style={{ width: `${(n.rate / maxRate) * 100}%` }}
              />
            </div>
            <span className="firing-value">{n.rate.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {rateHistogram?.length > 0 && (
        <div className="rate-histogram">
          <h4 className="sub-title">Rate Distribution (Hz)</h4>
          <div className="histogram-bars">
            {rateHistogram.map((bin, i) => {
              const maxCount = Math.max(...rateHistogram.map(b => b.count), 1);
              return (
                <div key={i} className="hist-col">
                  <div className="hist-bar-container">
                    <div
                      className="hist-bar"
                      style={{ height: `${(bin.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="hist-label">{bin.bin}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
