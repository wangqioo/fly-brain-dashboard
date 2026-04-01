import { useRef, useEffect } from 'react';

const COLORS = {
  bg: '#0f1117',
  grid: '#1e2030',
  freq: '#a78bfa',
  turn: '#f59e0b',
  text: '#94a3b8',
  axis: '#334155',
  zero: '#475569',
};

export default function CPGPanel({ history }) {
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
      ctx.fillText('Waiting for CPG data...', w / 2, h / 2);
      return;
    }

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

    const tMin = history[0].time_ms;
    const tMax = history[history.length - 1].time_ms;
    const tRange = Math.max(tMax - tMin, 1);

    // Freq modulation line (0.5 - 2.0 range)
    ctx.strokeStyle = COLORS.freq;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = margin.left + ((history[i].time_ms - tMin) / tRange) * plotW;
      const norm = (history[i].freq_modulation - 0.5) / 1.5;
      const y = margin.top + (1 - norm) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Turn bias line (-1 to 1 range, mapped to same plot)
    ctx.strokeStyle = COLORS.turn;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = margin.left + ((history[i].time_ms - tMin) / tRange) * plotW;
      const norm = (history[i].turn_bias + 1) / 2;
      const y = margin.top + (1 - norm) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Zero line for turn bias
    const zeroY = margin.top + plotH * 0.5;
    ctx.strokeStyle = COLORS.zero;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(w - margin.right, zeroY);
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

    // Time labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = tMin + (tRange / 4) * i;
      const x = margin.left + (plotW / 4) * i;
      ctx.fillText(`${(t / 1000).toFixed(2)}s`, x, h - margin.bottom + 14);
    }

    // Legend
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const lx = w - margin.right + 8;

    ctx.fillStyle = COLORS.freq;
    ctx.fillRect(lx, margin.top + 4, 12, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Freq', lx, margin.top + 20);

    ctx.fillStyle = COLORS.turn;
    ctx.fillRect(lx, margin.top + 30, 12, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Turn', lx, margin.top + 46);

  }, [history]);

  return (
    <div className="panel cpg-panel">
      <h3 className="panel-title">CPG Parameters</h3>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'calc(100% - 32px)', display: 'block' }}
      />
    </div>
  );
}
