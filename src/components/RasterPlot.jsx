import { useRef, useEffect } from 'react';

const COLORS = {
  bg: '#0f1117',
  grid: '#1e2030',
  spike: '#22d3ee',
  spikeGlow: 'rgba(34, 211, 238, 0.3)',
  text: '#94a3b8',
  axis: '#334155',
};

export default function RasterPlot({ spikes, currentTime, displayNeurons = 500 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

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
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (!spikes.length) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for spike data...', w / 2, h / 2);
      return;
    }

    const timeWindow = 200;
    const tMin = Math.max(0, (currentTime || 0) - timeWindow);
    const tMax = currentTime || timeWindow;

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();
    }

    // Draw spikes
    const visible = spikes.filter(s => s.time >= tMin && s.time <= tMax);
    ctx.fillStyle = COLORS.spike;
    for (const s of visible) {
      const x = margin.left + ((s.time - tMin) / (tMax - tMin)) * plotW;
      const y = margin.top + (s.neuron / displayNeurons) * plotH;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, h - margin.bottom);
    ctx.lineTo(w - margin.right, h - margin.bottom);
    ctx.stroke();

    // Labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const t = tMin + ((tMax - tMin) / ticks) * i;
      const x = margin.left + (plotW / ticks) * i;
      ctx.fillText(`${t.toFixed(0)}`, x, h - margin.bottom + 16);
    }

    ctx.save();
    ctx.translate(12, margin.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Neuron Index', 0, 0);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillText('Time (ms)', margin.left + plotW / 2, h - 2);

  }, [spikes, currentTime, displayNeurons]);

  return (
    <div className="panel raster-panel">
      <h3 className="panel-title">Spike Raster Plot</h3>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'calc(100% - 32px)', display: 'block' }}
      />
    </div>
  );
}
