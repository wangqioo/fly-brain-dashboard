import { useRef, useEffect } from 'react';

const COLORS = {
  bg: '#0f1117',
  grid: '#1e2030',
  line: '#22d3ee',
  fill: 'rgba(34, 211, 238, 0.15)',
  cumLine: '#10b981',
  text: '#94a3b8',
  axis: '#334155',
};

export default function SpikeTimeSeriesPanel({ history }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const margin = { top: 10, right: 60, bottom: 28, left: 50 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (!history.length) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for spike data...', w / 2, h / 2);
      return;
    }

    const tMin = history[0].time_ms;
    const tMax = history[history.length - 1].time_ms;
    const tRange = Math.max(tMax - tMin, 1);
    const maxSpikes = Math.max(...history.map(h => h.brain_spikes), 1);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();
    }

    // Fill area
    ctx.fillStyle = COLORS.fill;
    ctx.beginPath();
    ctx.moveTo(margin.left, h - margin.bottom);
    for (let i = 0; i < history.length; i++) {
      const x = margin.left + ((history[i].time_ms - tMin) / tRange) * plotW;
      const y = margin.top + (1 - history[i].brain_spikes / maxSpikes) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(margin.left + plotW, h - margin.bottom);
    ctx.closePath();
    ctx.fill();

    // Spike line
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = margin.left + ((history[i].time_ms - tMin) / tRange) * plotW;
      const y = margin.top + (1 - history[i].brain_spikes / maxSpikes) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Cumulative spikes (secondary axis)
    const maxCum = Math.max(...history.map(h => h.cumulative_spikes), 1);
    ctx.strokeStyle = COLORS.cumLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = margin.left + ((history[i].time_ms - tMin) / tRange) * plotW;
      const y = margin.top + (1 - history[i].cumulative_spikes / maxCum) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, h - margin.bottom);
    ctx.lineTo(w - margin.right, h - margin.bottom);
    ctx.stroke();

    // Y labels (left - spikes/cycle)
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxSpikes / 4) * (4 - i));
      const y = margin.top + (plotH / 4) * i;
      ctx.fillText(val.toString(), margin.left - 6, y + 4);
    }

    // Time labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = tMin + (tRange / 4) * i;
      const x = margin.left + (plotW / 4) * i;
      ctx.fillText(`${(t / 1000).toFixed(2)}s`, x, h - margin.bottom + 14);
    }

    // Legend
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const lx = w - margin.right + 6;
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(lx, margin.top + 4, 10, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Per', lx, margin.top + 18);
    ctx.fillText('cycle', lx, margin.top + 30);

    ctx.fillStyle = COLORS.cumLine;
    ctx.fillRect(lx, margin.top + 40, 10, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Total', lx, margin.top + 54);

  }, [history]);

  return (
    <div className="panel spike-ts-panel">
      <h3 className="panel-title">Brain Spikes</h3>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'calc(100% - 32px)', display: 'block' }}
      />
    </div>
  );
}
