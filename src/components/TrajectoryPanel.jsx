import { useRef, useEffect } from 'react';

export default function TrajectoryPanel({ bodyState, trajectoryHistory }) {
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

    if (!trajectoryHistory || trajectoryHistory.length < 2) {
      ctx.fillStyle = '#475569';
      ctx.font = '12px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for body data...', w / 2, h / 2);
      return;
    }

    // Compute bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of trajectoryHistory) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 30;
    const rangeX = Math.max(maxX - minX, 0.01);
    const rangeY = Math.max(maxY - minY, 0.01);
    const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
    const cx = w / 2;
    const cy = h / 2;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const toScreen = (x, y) => [
      cx + (x - midX) * scale,
      cy - (y - midY) * scale,
    ];

    // Grid
    ctx.strokeStyle = '#1e2030';
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(rangeX)));
    const gridMinX = Math.floor(minX / gridStep) * gridStep;
    const gridMinY = Math.floor(minY / gridStep) * gridStep;
    for (let gx = gridMinX; gx <= maxX + gridStep; gx += gridStep) {
      const [sx] = toScreen(gx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, pad);
      ctx.lineTo(sx, h - pad);
      ctx.stroke();
    }
    for (let gy = gridMinY; gy <= maxY + gridStep; gy += gridStep) {
      const [, sy] = toScreen(0, gy);
      ctx.beginPath();
      ctx.moveTo(pad, sy);
      ctx.lineTo(w - pad, sy);
      ctx.stroke();
    }

    // Origin marker
    const [ox, oy] = toScreen(0, 0);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox, oy, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('origin', ox + 6, oy - 4);

    // Trail
    ctx.beginPath();
    const [sx0, sy0] = toScreen(trajectoryHistory[0].x, trajectoryHistory[0].y);
    ctx.moveTo(sx0, sy0);
    for (let i = 1; i < trajectoryHistory.length; i++) {
      const [sx, sy] = toScreen(trajectoryHistory[i].x, trajectoryHistory[i].y);
      ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = '#22d3ee40';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Gradient trail (last 50 points brighter)
    const recent = trajectoryHistory.slice(-50);
    if (recent.length >= 2) {
      ctx.beginPath();
      const [rx0, ry0] = toScreen(recent[0].x, recent[0].y);
      ctx.moveTo(rx0, ry0);
      for (let i = 1; i < recent.length; i++) {
        const [rx, ry] = toScreen(recent[i].x, recent[i].y);
        ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Current position with heading arrow
    if (bodyState) {
      const [px, py] = toScreen(bodyState.position.x, bodyState.position.y);
      const headingRad = (bodyState.orientation * Math.PI) / 180;
      const arrowLen = 12;

      // Direction arrow
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px + Math.cos(-headingRad) * arrowLen,
        py + Math.sin(-headingRad) * arrowLen
      );
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Position dot
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = '#0f1117';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Scale label
    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter, system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`${rangeX.toFixed(3)}m x ${rangeY.toFixed(3)}m`, w - 8, h - 6);

  }, [bodyState, trajectoryHistory]);

  if (!bodyState && (!trajectoryHistory || trajectoryHistory.length === 0)) {
    return (
      <div className="panel trajectory-panel">
        <h3 className="panel-title">Fly Trajectory</h3>
        <div className="panel-empty">Brain-only mode (no trajectory)</div>
      </div>
    );
  }

  return (
    <div className="panel trajectory-panel">
      <h3 className="panel-title">Fly Trajectory</h3>
      <div className="trajectory-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
