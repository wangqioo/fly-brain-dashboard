import { useRef, useEffect } from 'react';

const LEGS = [
  { id: 'left_front', label: 'LF', side: 'left' },
  { id: 'right_front', label: 'RF', side: 'right' },
  { id: 'left_mid', label: 'LM', side: 'left' },
  { id: 'right_mid', label: 'RM', side: 'right' },
  { id: 'left_hind', label: 'LH', side: 'left' },
  { id: 'right_hind', label: 'RH', side: 'right' },
];

const CONTACT_THRESHOLD = 0.1;

export default function GaitDiagramPanel({ gaitHistory }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height - 28;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    if (!gaitHistory || gaitHistory.length < 2) {
      ctx.fillStyle = '#475569';
      ctx.font = '12px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for gait data...', w / 2, h / 2);
      return;
    }

    const labelW = 28;
    const chartW = w - labelW - 8;
    const rowH = Math.floor((h - 16) / LEGS.length);
    const topPad = 8;

    // Time range
    const tStart = gaitHistory[0].time;
    const tEnd = gaitHistory[gaitHistory.length - 1].time;
    const tRange = Math.max(tEnd - tStart, 0.001);
    const toX = (t) => labelW + ((t - tStart) / tRange) * chartW;

    // Draw each leg row
    LEGS.forEach((leg, i) => {
      const y = topPad + i * rowH;

      // Label
      ctx.fillStyle = leg.side === 'left' ? '#22d3ee' : '#f59e0b';
      ctx.font = 'bold 9px Inter, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(leg.label, labelW - 4, y + rowH / 2 + 3);

      // Row background
      ctx.fillStyle = i % 2 === 0 ? '#12141c' : '#0f1117';
      ctx.fillRect(labelW, y, chartW, rowH);

      // Contact blocks (stance phase)
      let inContact = false;
      let contactStart = 0;

      for (let j = 0; j < gaitHistory.length; j++) {
        const forces = gaitHistory[j].forces;
        const force = forces?.[leg.id] || 0;
        const contact = force > CONTACT_THRESHOLD;

        if (contact && !inContact) {
          contactStart = gaitHistory[j].time;
          inContact = true;
        } else if ((!contact || j === gaitHistory.length - 1) && inContact) {
          const endTime = contact ? gaitHistory[j].time : gaitHistory[j].time;
          const x1 = toX(contactStart);
          const x2 = toX(endTime);
          const barH = rowH * 0.6;
          const barY = y + (rowH - barH) / 2;

          ctx.fillStyle = leg.side === 'left' ? '#22d3ee50' : '#f59e0b50';
          ctx.fillRect(x1, barY, Math.max(x2 - x1, 1), barH);
          ctx.fillStyle = leg.side === 'left' ? '#22d3ee' : '#f59e0b';
          ctx.fillRect(x1, barY, Math.max(x2 - x1, 1), 2);

          inContact = false;
        }
      }

      // Row separator
      ctx.strokeStyle = '#1e2030';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(labelW, y + rowH);
      ctx.lineTo(w, y + rowH);
      ctx.stroke();
    });

    // Time axis
    ctx.fillStyle = '#475569';
    ctx.font = '8px Inter, system-ui';
    ctx.textAlign = 'center';
    const nTicks = 5;
    for (let i = 0; i <= nTicks; i++) {
      const t = tStart + (tRange * i) / nTicks;
      const x = toX(t);
      ctx.fillText(`${(t / 1000).toFixed(2)}s`, x, h - 2);
    }

    // Legend
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = '8px Inter, system-ui';
    ctx.fillText('stance=filled, swing=empty', w - 4, 8);

  }, [gaitHistory]);

  if (!gaitHistory || gaitHistory.length === 0) {
    return (
      <div className="panel gait-panel">
        <h3 className="panel-title">Gait Diagram</h3>
        <div className="panel-empty">Brain-only mode (no gait)</div>
      </div>
    );
  }

  return (
    <div className="panel gait-panel">
      <h3 className="panel-title">Gait Diagram</h3>
      <div className="gait-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
