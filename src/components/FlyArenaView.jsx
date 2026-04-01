import { useRef, useEffect, useCallback } from 'react';

/**
 * FlyArenaView - Real-time animated top-down view of the fly in its arena.
 * Shows: fly body with 6 legs (tripod gait), heading arrow, movement trail,
 * arena boundaries, and optional stimulus markers.
 */

// Leg layout for Drosophila (top-down, relative to body center)
// Pairs: LF/RF, LM/RM, LH/RH
const LEG_ANCHORS = [
  { id: 'left_front',  side: 'L', pair: 0, angle: -35,  len: 1.0, restAngle: -40 },
  { id: 'right_front', side: 'R', pair: 0, angle:  35,  len: 1.0, restAngle:  40 },
  { id: 'left_mid',    side: 'L', pair: 1, angle: -90,  len: 1.1, restAngle: -85 },
  { id: 'right_mid',   side: 'R', pair: 1, angle:  90,  len: 1.1, restAngle:  85 },
  { id: 'left_hind',   side: 'L', pair: 2, angle: -145, len: 1.0, restAngle: -130 },
  { id: 'right_hind',  side: 'R', pair: 2, angle:  145, len: 1.0, restAngle:  130 },
];

const CONTACT_THRESHOLD = 0.1;

function drawFly(ctx, x, y, heading, bodyScale, contactForces, gaitPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-heading); // canvas Y is inverted

  const s = bodyScale;

  // --- Draw legs ---
  LEG_ANCHORS.forEach((leg) => {
    const force = contactForces?.[leg.id] || 0;
    const inStance = force > CONTACT_THRESHOLD;

    // Animate leg angle based on gait phase for tripod pattern
    // Tripod A (LF, RM, LH) vs Tripod B (RF, LM, RH)
    const isTripodA = (leg.id === 'left_front' || leg.id === 'right_mid' || leg.id === 'left_hind');
    const legPhase = isTripodA ? gaitPhase : gaitPhase + Math.PI;
    const swingOffset = Math.sin(legPhase) * 15; // degrees of swing

    const anchorAngleRad = (leg.restAngle + swingOffset) * Math.PI / 180;
    const legLen = leg.len * s * 0.9;

    // Coxa (base) position on body
    const bodyAngleRad = leg.angle * Math.PI / 180;
    const coxaX = Math.cos(bodyAngleRad) * s * 0.35;
    const coxaY = Math.sin(bodyAngleRad) * s * 0.2;

    // Tip position
    const tipX = coxaX + Math.cos(anchorAngleRad) * legLen;
    const tipY = coxaY + Math.sin(anchorAngleRad) * legLen;

    // Mid joint (femur-tibia)
    const midX = coxaX + Math.cos(anchorAngleRad) * legLen * 0.5;
    const midY = coxaY + Math.sin(anchorAngleRad) * legLen * 0.5;
    // offset mid joint slightly outward
    const perpAngle = anchorAngleRad + (leg.side === 'L' ? -Math.PI / 2 : Math.PI / 2);
    const jointOffX = midX + Math.cos(perpAngle) * legLen * 0.12;
    const jointOffY = midY + Math.sin(perpAngle) * legLen * 0.12;

    // Draw leg segments
    ctx.lineWidth = inStance ? 1.8 : 1.2;
    ctx.strokeStyle = inStance ? '#22d3ee' : '#3b5a6e';
    ctx.lineCap = 'round';

    // Coxa to joint
    ctx.beginPath();
    ctx.moveTo(coxaX, coxaY);
    ctx.lineTo(jointOffX, jointOffY);
    ctx.stroke();

    // Joint to tip
    ctx.beginPath();
    ctx.moveTo(jointOffX, jointOffY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Foot dot (stance = bright, swing = dim)
    if (inStance) {
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // --- Draw body (ellipse) ---
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.4, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1a3040';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee60';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Thorax segment
  ctx.beginPath();
  ctx.ellipse(s * 0.05, 0, s * 0.15, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e3a4d';
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.32, 0, s * 0.1, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e3a4d';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee80';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Eyes (compound eyes)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(s * 0.35, -s * 0.06, s * 0.035, s * 0.025, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.35, s * 0.06, s * 0.035, s * 0.025, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Antennae
  ctx.strokeStyle = '#4a8a9e';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(s * 0.38, -s * 0.03);
  ctx.quadraticCurveTo(s * 0.52, -s * 0.12, s * 0.48, -s * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.38, s * 0.03);
  ctx.quadraticCurveTo(s * 0.52, s * 0.12, s * 0.48, s * 0.18);
  ctx.stroke();

  // Wings (semi-transparent)
  ctx.fillStyle = '#22d3ee10';
  ctx.strokeStyle = '#22d3ee25';
  ctx.lineWidth = 0.5;
  // Left wing
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.15, s * 0.22, s * 0.08, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Right wing
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, s * 0.15, s * 0.22, s * 0.08, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Heading indicator (small arrow at nose)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.42, 0);
  ctx.lineTo(s * 0.52, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.52, 0);
  ctx.lineTo(s * 0.48, -s * 0.03);
  ctx.moveTo(s * 0.52, 0);
  ctx.lineTo(s * 0.48, s * 0.03);
  ctx.stroke();

  ctx.restore();
}

function drawArena(ctx, w, h, arenaScale, centerX, centerY) {
  // Grid
  const gridSpacing = 50;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Origin crosshair
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(w, centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Origin label
  ctx.fillStyle = '#334155';
  ctx.font = '9px Inter, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('(0,0)', centerX + 4, centerY - 4);
}

function drawTrail(ctx, trajectory, toScreen, maxPoints) {
  if (!trajectory || trajectory.length < 2) return;

  const points = trajectory.slice(-maxPoints);

  for (let i = 1; i < points.length; i++) {
    const alpha = (i / points.length) * 0.6;
    const [x0, y0] = toScreen(points[i - 1].x, points[i - 1].y);
    const [x1, y1] = toScreen(points[i].x, points[i].y);

    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
    ctx.lineWidth = 1 + (i / points.length) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawStimulusMarkers(ctx, activeSensory, w, h) {
  if (!activeSensory || activeSensory.length === 0) return;

  const markerY = h - 14;
  const colors = {
    sugar: '#22d3ee',
    bitter: '#ef4444',
    head_bristle: '#f59e0b',
    johnston_organ: '#a78bfa',
    wind_gravity: '#34d399',
    grooming: '#fb923c',
    eye_bristle: '#f472b6',
    taste_peg: '#38bdf8',
  };

  ctx.font = '8px Inter, system-ui';
  ctx.textAlign = 'left';
  let xOff = 6;
  activeSensory.forEach(ch => {
    const color = colors[ch] || '#64748b';
    ctx.fillStyle = color + '30';
    const textW = ctx.measureText(ch).width + 8;
    ctx.fillRect(xOff - 2, markerY - 8, textW, 12);
    ctx.fillStyle = color;
    ctx.fillText(ch, xOff + 2, markerY);
    xOff += textW + 4;
  });
}

export default function FlyArenaView({
  bodyState,
  trajectoryHistory,
  currentCycle,
  activeSensory,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const gaitPhaseRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height - 28;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, w, h);

    // Update gait phase animation
    const now = Date.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    if (currentCycle?.cpg_params?.freq_modulation) {
      gaitPhaseRef.current += currentCycle.cpg_params.freq_modulation * dt * 12;
    }

    if (!bodyState) {
      // No body data -- show placeholder
      drawArena(ctx, w, h, 1, w / 2, h / 2);
      ctx.fillStyle = '#334155';
      ctx.font = '13px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for embodied simulation...', w / 2, h / 2);
      ctx.fillStyle = '#1e293b';
      ctx.font = '11px Inter, system-ui';
      ctx.fillText('Select an embodied experiment to see the fly', w / 2, h / 2 + 20);
      return;
    }

    // Compute view transform (auto-follow the fly)
    const flyX = bodyState.position.x;
    const flyY = bodyState.position.y;

    // Determine arena scale from trajectory extent
    let viewRadius = 0.02; // minimum view radius in meters
    if (trajectoryHistory && trajectoryHistory.length > 1) {
      for (const p of trajectoryHistory) {
        const dx = p.x - flyX;
        const dy = p.y - flyY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > viewRadius) viewRadius = dist;
      }
    }
    viewRadius = Math.max(viewRadius * 1.3, 0.015); // add margin
    const arenaScale = Math.min(w, h) / (viewRadius * 2);

    const centerX = w / 2;
    const centerY = h / 2;

    const toScreen = (wx, wy) => [
      centerX + (wx - flyX) * arenaScale,
      centerY - (wy - flyY) * arenaScale,
    ];

    // Draw arena grid
    drawArena(ctx, w, h, arenaScale, ...toScreen(0, 0));

    // Scale indicator
    const scaleBarMeters = viewRadius > 0.05 ? 0.05 : viewRadius > 0.01 ? 0.01 : 0.005;
    const scaleBarPx = scaleBarMeters * arenaScale;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 12 - scaleBarPx, h - 24);
    ctx.lineTo(w - 12, h - 24);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '8px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${(scaleBarMeters * 1000).toFixed(0)}mm`, w - 12 - scaleBarPx / 2, h - 14);

    // Draw trail
    drawTrail(ctx, trajectoryHistory, toScreen, 300);

    // Draw the fly
    const [screenX, screenY] = toScreen(flyX, flyY);
    const headingRad = (bodyState.orientation * Math.PI) / 180;
    const bodyScale = Math.max(30, Math.min(60, arenaScale * 0.004));

    drawFly(
      ctx,
      screenX,
      screenY,
      headingRad,
      bodyScale,
      bodyState.contact_forces,
      gaitPhaseRef.current,
    );

    // Active sensory markers
    drawStimulusMarkers(ctx, activeSensory, w, h);

    // Info overlay
    ctx.fillStyle = '#64748b';
    ctx.font = '9px Inter, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(
      `pos: (${flyX.toFixed(3)}, ${flyY.toFixed(3)})  vel: ${bodyState.velocity.toFixed(3)} m/s  hdg: ${bodyState.orientation.toFixed(1)}`,
      6, 12
    );

    // Request next frame
    animFrameRef.current = requestAnimationFrame(render);
  }, [bodyState, trajectoryHistory, currentCycle, activeSensory]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  return (
    <div className="panel fly-arena-panel">
      <h3 className="panel-title">Fly Arena (Live)</h3>
      <div className="fly-arena-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
