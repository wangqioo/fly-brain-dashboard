import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Fly3DView - Full 3D Drosophila melanogaster with 42 joints,
 * tripod gait animation, arena, trail, WASD + joystick control.
 *
 * NeuroMechFly v2 joint layout per leg (7 DOF):
 *   Coxa, Coxa_roll, Coxa_yaw, Femur, Femur_roll, Tibia, Tarsus
 * 6 legs x 7 = 42 joints total
 */

// -- Constants --
const LEG_NAMES = [
  'LF', 'RF',  // front
  'LM', 'RM',  // mid
  'LH', 'RH',  // hind
];

// Tripod A (LF, RM, LH), Tripod B (RF, LM, RH)
const TRIPOD_A = new Set(['LF', 'RM', 'LH']);

// Body segment dimensions (mm scale -> Three.js units, 1 unit = 1mm)
const BODY = {
  abdomen:  { rx: 0.65, ry: 0.42, rz: 0.40, x: -0.55 },
  thorax:   { rx: 0.45, ry: 0.38, rz: 0.36, x: 0.1 },
  head:     { rx: 0.28, ry: 0.26, rz: 0.24, x: 0.58 },
};

// Leg attachment points on thorax (x, y, z) in body-local coords
const LEG_ORIGINS = {
  LF: [0.25,  0.30, -0.10],
  RF: [0.25, -0.30, -0.10],
  LM: [0.05,  0.35, -0.12],
  RM: [0.05, -0.35, -0.12],
  LH: [-0.15,  0.30, -0.10],
  RH: [-0.15, -0.30, -0.10],
};

// Segment lengths per leg part (mm)
const SEG = {
  coxa: 0.25,
  femur: 0.55,
  tibia: 0.50,
  tarsus1: 0.20,
  tarsus2: 0.12,
  tarsus3: 0.08,
};

// Rest angles for tripod gait (degrees)
const LEG_REST = {
  LF:  { spread: -40,  lift: -15 },
  RF:  { spread:  40,  lift: -15 },
  LM:  { spread: -85,  lift: -18 },
  RM:  { spread:  85,  lift: -18 },
  LH:  { spread: -135, lift: -15 },
  RH:  { spread:  135, lift: -15 },
};

// Colors
const COLORS = {
  body:      0x1a2a3a,
  bodyEdge:  0x22d3ee,
  thorax:    0x1e3a4d,
  head:      0x1e3a4d,
  eye:       0xef4444,
  antenna:   0x4a8a9e,
  wingFill:  0x22d3ee,
  legStance: 0x22d3ee,
  legSwing:  0x2a4a5e,
  footDot:   0x22d3ee,
  arena:     0x080a0f,
  grid:      0x111827,
  trail:     0x22d3ee,
  ground:    0x0a0e14,
};

function createFlyGroup() {
  const flyGroup = new THREE.Group();
  flyGroup.name = 'fly';

  const bodyMat = new THREE.MeshPhongMaterial({
    color: COLORS.body,
    emissive: 0x0a1520,
    specular: 0x334455,
    shininess: 40,
    transparent: true,
    opacity: 0.92,
  });

  const bodyEdgeMat = new THREE.MeshPhongMaterial({
    color: COLORS.bodyEdge,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });

  // -- Abdomen --
  const abdGeo = new THREE.SphereGeometry(1, 24, 16);
  abdGeo.scale(BODY.abdomen.rx, BODY.abdomen.ry, BODY.abdomen.rz);
  const abdomen = new THREE.Mesh(abdGeo, bodyMat);
  abdomen.position.x = BODY.abdomen.x;
  flyGroup.add(abdomen);
  // Abdomen glow
  const abdGlow = new THREE.Mesh(abdGeo.clone(), bodyEdgeMat);
  abdGlow.scale.multiplyScalar(1.05);
  abdGlow.position.copy(abdomen.position);
  flyGroup.add(abdGlow);

  // Abdomen stripes
  for (let i = 0; i < 4; i++) {
    const ringGeo = new THREE.TorusGeometry(BODY.abdomen.ry * 0.95, 0.012, 8, 24);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshPhongMaterial({
      color: 0x334455, transparent: true, opacity: 0.3,
    }));
    ring.position.x = BODY.abdomen.x - 0.25 + i * 0.16;
    ring.rotation.y = Math.PI / 2;
    flyGroup.add(ring);
  }

  // -- Thorax --
  const thorGeo = new THREE.SphereGeometry(1, 24, 16);
  thorGeo.scale(BODY.thorax.rx, BODY.thorax.ry, BODY.thorax.rz);
  const thorax = new THREE.Mesh(thorGeo, new THREE.MeshPhongMaterial({
    color: COLORS.thorax,
    emissive: 0x0a1520,
    specular: 0x445566,
    shininess: 50,
  }));
  thorax.position.x = BODY.thorax.x;
  flyGroup.add(thorax);

  // -- Head --
  const headGeo = new THREE.SphereGeometry(1, 20, 14);
  headGeo.scale(BODY.head.rx, BODY.head.ry, BODY.head.rz);
  const head = new THREE.Mesh(headGeo, new THREE.MeshPhongMaterial({
    color: COLORS.head,
    emissive: 0x0a1520,
    specular: 0x445566,
    shininess: 50,
  }));
  head.position.x = BODY.head.x;
  flyGroup.add(head);

  // -- Compound Eyes --
  const eyeMat = new THREE.MeshPhongMaterial({
    color: COLORS.eye,
    emissive: 0x881111,
    specular: 0xffffff,
    shininess: 80,
  });
  const eyeGeo = new THREE.SphereGeometry(0.10, 16, 12);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.68, 0.14, 0.08);
  leftEye.scale.set(1, 0.8, 0.7);
  flyGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.68, -0.14, 0.08);
  rightEye.scale.set(1, 0.8, 0.7);
  flyGroup.add(rightEye);

  // -- Antennae --
  const antMat = new THREE.MeshPhongMaterial({ color: COLORS.antenna });
  const antCurve1 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.72, 0.06, 0.1),
    new THREE.Vector3(0.85, 0.15, 0.22),
    new THREE.Vector3(0.90, 0.20, 0.30),
    new THREE.Vector3(0.82, 0.24, 0.35),
  );
  const antGeo1 = new THREE.TubeGeometry(antCurve1, 12, 0.012, 6, false);
  flyGroup.add(new THREE.Mesh(antGeo1, antMat));

  const antCurve2 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.72, -0.06, 0.1),
    new THREE.Vector3(0.85, -0.15, 0.22),
    new THREE.Vector3(0.90, -0.20, 0.30),
    new THREE.Vector3(0.82, -0.24, 0.35),
  );
  const antGeo2 = new THREE.TubeGeometry(antCurve2, 12, 0.012, 6, false);
  flyGroup.add(new THREE.Mesh(antGeo2, antMat));

  // -- Wings --
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(-0.15, 0.35, -0.55, 0.55, -0.35, 0.80);
  wingShape.bezierCurveTo(-0.10, 0.90, 0.20, 0.70, 0.30, 0.40);
  wingShape.bezierCurveTo(0.25, 0.20, 0.10, 0.05, 0, 0);

  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = new THREE.MeshPhongMaterial({
    color: COLORS.wingFill,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    emissive: 0x112233,
  });
  const wingEdgeMat = new THREE.LineBasicMaterial({
    color: COLORS.wingFill,
    transparent: true,
    opacity: 0.2,
  });

  // Left wing
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(-0.05, 0.20, 0.28);
  leftWing.rotation.set(0.15, 0.2, 0.3);
  leftWing.scale.set(0.9, 0.9, 1);
  leftWing.name = 'wing_left';
  flyGroup.add(leftWing);
  const lwEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(wingGeo), wingEdgeMat
  );
  lwEdge.position.copy(leftWing.position);
  lwEdge.rotation.copy(leftWing.rotation);
  lwEdge.scale.copy(leftWing.scale);
  flyGroup.add(lwEdge);

  // Right wing (mirrored)
  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(-0.05, -0.20, 0.28);
  rightWing.rotation.set(-0.15, 0.2, -0.3);
  rightWing.scale.set(0.9, -0.9, 1);
  rightWing.name = 'wing_right';
  flyGroup.add(rightWing);
  const rwEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(wingGeo), wingEdgeMat
  );
  rwEdge.position.copy(rightWing.position);
  rwEdge.rotation.copy(rightWing.rotation);
  rwEdge.scale.copy(rightWing.scale);
  flyGroup.add(rwEdge);

  // -- Legs (6 legs, each with multiple segments) --
  const legGroups = {};
  LEG_NAMES.forEach(name => {
    const legGroup = createLeg(name);
    const origin = LEG_ORIGINS[name];
    legGroup.position.set(origin[0], origin[1], origin[2]);
    legGroup.name = `leg_${name}`;
    flyGroup.add(legGroup);
    legGroups[name] = legGroup;
  });
  flyGroup.userData.legs = legGroups;

  return flyGroup;
}

function createLeg(name) {
  const group = new THREE.Group();
  const isLeft = name.startsWith('L');
  const side = isLeft ? 1 : -1;
  const rest = LEG_REST[name];

  const legMat = new THREE.MeshPhongMaterial({
    color: COLORS.legSwing,
    emissive: 0x0a1520,
    specular: 0x334455,
    shininess: 30,
  });

  const segments = ['coxa', 'femur', 'tibia', 'tarsus1', 'tarsus2', 'tarsus3'];
  const segData = {};

  let prevEnd = new THREE.Vector3(0, 0, 0);

  segments.forEach((segName, i) => {
    const len = SEG[segName] || 0.15;
    const radius = 0.025 - i * 0.003;
    const geo = new THREE.CylinderGeometry(
      Math.max(0.008, radius),
      Math.max(0.006, radius - 0.005),
      len, 8
    );
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, len / 2);

    const mesh = new THREE.Mesh(geo, legMat.clone());
    mesh.name = `${name}_${segName}`;
    mesh.position.copy(prevEnd);
    group.add(mesh);
    segData[segName] = mesh;

    prevEnd = new THREE.Vector3(0, 0, len);
    // Next segment is relative to this one
  });

  // Foot contact dot
  const footGeo = new THREE.SphereGeometry(0.025, 8, 6);
  const footMat = new THREE.MeshPhongMaterial({
    color: COLORS.footDot,
    emissive: COLORS.footDot,
    emissiveIntensity: 0.5,
  });
  const foot = new THREE.Mesh(footGeo, footMat);
  foot.name = `${name}_foot`;
  foot.visible = false;
  group.add(foot);

  group.userData = { segments: segData, foot, rest, side, name };
  return group;
}

function animateLeg(legGroup, gaitPhase, freqMod, isStance) {
  const { segments, foot, rest, side, name } = legGroup.userData;
  const isTripodA = TRIPOD_A.has(name);
  const legPhase = isTripodA ? gaitPhase : gaitPhase + Math.PI;
  const swing = Math.sin(legPhase);
  const stance = swing > 0;

  const spreadRad = (rest.spread) * Math.PI / 180;
  const swingAngle = swing * 0.35 * freqMod;
  const liftAngle = stance ? 0 : Math.abs(swing) * 0.25;

  // Set coxa rotation (spread + swing)
  if (segments.coxa) {
    segments.coxa.rotation.z = spreadRad + swingAngle * side;
    segments.coxa.rotation.x = liftAngle;
  }

  // Femur flexion
  if (segments.femur) {
    const femurFlex = -0.6 + (stance ? 0.1 : -0.2 * Math.abs(swing));
    segments.femur.rotation.x = femurFlex;
    segments.femur.position.z = SEG.coxa;
  }

  // Tibia extension
  if (segments.tibia) {
    const tibiaExt = 0.8 + (stance ? -0.1 : 0.3 * Math.abs(swing));
    segments.tibia.rotation.x = tibiaExt;
    segments.tibia.position.z = SEG.femur;
  }

  // Tarsus segments - slight curl
  if (segments.tarsus1) {
    segments.tarsus1.rotation.x = 0.3 + (stance ? 0.2 : 0);
    segments.tarsus1.position.z = SEG.tibia;
  }
  if (segments.tarsus2) {
    segments.tarsus2.rotation.x = 0.15;
    segments.tarsus2.position.z = SEG.tarsus1;
  }
  if (segments.tarsus3) {
    segments.tarsus3.rotation.x = 0.1;
    segments.tarsus3.position.z = SEG.tarsus2;
  }

  // Color legs based on stance/swing
  const color = stance ? COLORS.legStance : COLORS.legSwing;
  Object.values(segments).forEach(mesh => {
    mesh.material.color.setHex(color);
    mesh.material.emissive.setHex(stance ? 0x0a2030 : 0x0a1520);
  });

  // Foot dot visibility
  foot.visible = stance;
}

function createArena(size) {
  const group = new THREE.Group();
  group.name = 'arena';

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(size, size);
  const groundMat = new THREE.MeshPhongMaterial({
    color: COLORS.ground,
    specular: 0x111111,
    shininess: 5,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.45;
  ground.receiveShadow = true;
  group.add(ground);

  // Grid lines
  const gridHelper = new THREE.GridHelper(size, size * 2, COLORS.grid, COLORS.grid);
  gridHelper.position.y = -0.44;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  group.add(gridHelper);

  // Origin marker
  const originGeo = new THREE.RingGeometry(0.08, 0.12, 16);
  const originMat = new THREE.MeshBasicMaterial({
    color: 0x334455,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const originMark = new THREE.Mesh(originGeo, originMat);
  originMark.rotation.x = -Math.PI / 2;
  originMark.position.y = -0.43;
  group.add(originMark);

  return group;
}

function createTrail(maxPoints) {
  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    linewidth: 2,
  });

  const line = new THREE.Line(geo, mat);
  line.name = 'trail';
  line.frustumCulled = false;
  return line;
}

function updateTrail(trailLine, trajectory, maxPoints) {
  if (!trajectory || trajectory.length < 2) return;

  const pts = trajectory.slice(-maxPoints);
  const positions = trailLine.geometry.attributes.position.array;
  const colors = trailLine.geometry.attributes.color.array;
  const trailColor = new THREE.Color(COLORS.trail);

  for (let i = 0; i < pts.length; i++) {
    const alpha = i / pts.length;
    positions[i * 3] = pts[i].x * 100; // meters -> mm-ish scale
    positions[i * 3 + 1] = -0.42;
    positions[i * 3 + 2] = -pts[i].y * 100;
    colors[i * 3] = trailColor.r * alpha;
    colors[i * 3 + 1] = trailColor.g * alpha;
    colors[i * 3 + 2] = trailColor.b * alpha;
  }

  trailLine.geometry.attributes.position.needsUpdate = true;
  trailLine.geometry.attributes.color.needsUpdate = true;
  trailLine.geometry.setDrawRange(0, pts.length);
}

// -- Joystick Component --
function Joystick({ onMove, size = 100 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ active: false, x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = size;
    const cx = s / 2, cy = s / 2, r = s * 0.38;
    ctx.clearRect(0, 0, s, s);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#22d3ee40';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner knob
    const { x, y } = stateRef.current;
    const kx = cx + x * r * 0.8;
    const ky = cy - y * r * 0.8;
    ctx.beginPath();
    ctx.arc(kx, ky, r * 0.28, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, r * 0.28);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#22d3ee60');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [size]);

  const handlePointer = useCallback((e, start) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (start) stateRef.current.active = true;
    if (!stateRef.current.active) return;

    const rect = canvas.getBoundingClientRect();
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    let dx = (e.clientX - rect.left - cx) / r;
    let dy = -(e.clientY - rect.top - cy) / r;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) { dx /= dist; dy /= dist; }
    stateRef.current.x = dx;
    stateRef.current.y = dy;
    draw();
    onMove?.(dx, dy);
  }, [size, draw, onMove]);

  const handleUp = useCallback(() => {
    stateRef.current = { active: false, x: 0, y: 0 };
    draw();
    onMove?.(0, 0);
  }, [draw, onMove]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ cursor: 'pointer', touchAction: 'none' }}
      onPointerDown={(e) => handlePointer(e, true)}
      onPointerMove={(e) => handlePointer(e, false)}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
    />
  );
}

// -- Main Component --
export default function Fly3DView({
  bodyState,
  trajectoryHistory,
  currentCycle,
  activeSensory,
  onMotorControl,
  status,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const flyRef = useRef(null);
  const trailRef = useRef(null);
  const gaitPhaseRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const animRef = useRef(null);
  const keysRef = useRef({});
  const [motorMode, setMotorMode] = useState('brain');
  const [cameraFollow, setCameraFollow] = useState(true);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(COLORS.arena);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLORS.arena, 0.08);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 100);
    camera.position.set(2.0, 1.8, 2.0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.48;
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xaabbcc, 1.0);
    dirLight.position.set(3, 5, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x22d3ee, 0.3, 10);
    pointLight.position.set(0, 2, 0);
    scene.add(pointLight);

    // Rim light for dramatic effect
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.25);
    rimLight.position.set(-2, 1, -2);
    scene.add(rimLight);

    // Arena
    const arena = createArena(20);
    scene.add(arena);

    // Fly
    const fly = createFlyGroup();
    scene.add(fly);
    flyRef.current = fly;

    // Trail
    const trail = createTrail(500);
    scene.add(trail);
    trailRef.current = trail;

    // Resize handler
    const onResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    // Cleanup
    return () => {
      resizeObs.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' '].includes(key)) {
        e.preventDefault();
        keysRef.current[key] = true;
      }
    };
    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Process keyboard input
  const processKeys = useCallback(() => {
    const k = keysRef.current;
    let freq = 0, turn = 0;
    if (k['w']) freq += 1.0;
    if (k['s']) freq -= 0.5;
    if (k['a']) turn -= 1.0;
    if (k['d']) turn += 1.0;
    return { freq, turn, active: freq !== 0 || turn !== 0 };
  }, []);

  // Joystick handler
  const handleJoystick = useCallback((dx, dy) => {
    if (motorMode !== 'manual' && motorMode !== 'hybrid') return;
    const freq = Math.max(0, dy) * 2.0;
    const turn = dx;
    onMotorControl?.({ mode: motorMode, freq: freq || 1.0, turn });
  }, [motorMode, onMotorControl]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);

      const now = Date.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const fly = flyRef.current;
      const controls = controlsRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!fly || !renderer || !scene || !camera) return;

      // Process keyboard
      const keys = processKeys();
      if (keys.active && (motorMode === 'manual' || motorMode === 'hybrid')) {
        onMotorControl?.({
          mode: motorMode,
          freq: 1.0 + keys.freq * 0.5,
          turn: keys.turn,
        });
      }

      // Update fly position from body state
      const freqMod = currentCycle?.cpg_params?.freq_modulation || 1.0;
      if (bodyState) {
        const scale = 100; // meters to scene units
        fly.position.x = bodyState.position.x * scale;
        fly.position.z = -bodyState.position.y * scale;
        fly.position.y = (bodyState.position.z || 0.002) * scale - 0.2;
        fly.rotation.y = -(bodyState.orientation || 0) * Math.PI / 180;

        // Advance gait phase
        gaitPhaseRef.current += freqMod * dt * 12;
      } else {
        // Demo mode: gentle idle animation
        gaitPhaseRef.current += dt * 3;
        fly.position.y = -0.2 + Math.sin(now * 0.001) * 0.01;
      }

      // Animate legs
      const legs = fly.userData.legs;
      if (legs) {
        LEG_NAMES.forEach(name => {
          const isStance = bodyState?.contact_forces?.[
            name.replace('L', 'left_').replace('R', 'right_').replace('F', 'front').replace('M', 'mid').replace('H', 'hind')
          ] > 0.1;
          animateLeg(legs[name], gaitPhaseRef.current, freqMod, isStance);
        });
      }

      // Wing flutter
      const wingL = fly.getObjectByName('wing_left');
      const wingR = fly.getObjectByName('wing_right');
      if (wingL && wingR) {
        const flutter = Math.sin(now * 0.02) * 0.08;
        wingL.rotation.z = 0.3 + flutter;
        wingR.rotation.z = -0.3 - flutter;
      }

      // Update trail
      if (trailRef.current && trajectoryHistory) {
        updateTrail(trailRef.current, trajectoryHistory, 500);
      }

      // Camera follow
      if (cameraFollow && bodyState) {
        const target = new THREE.Vector3(fly.position.x, 0, fly.position.z);
        controls.target.lerp(target, 0.05);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [bodyState, trajectoryHistory, currentCycle, processKeys, motorMode, onMotorControl, cameraFollow]);

  return (
    <div className="panel fly-3d-panel">
      <h3 className="panel-title">
        Fly Arena 3D
        <span className="panel-title-badges">
          <span className="badge-small">42 joints</span>
          <span className="badge-small">6 legs</span>
          {bodyState && <span className="badge-small badge-green">Embodied</span>}
        </span>
      </h3>

      <div className="fly-3d-container" ref={containerRef} />

      <div className="fly-3d-controls">
        <div className="fly-3d-mode-select">
          <label>Control:</label>
          {['brain', 'manual', 'hybrid'].map(mode => (
            <button
              key={mode}
              className={`mode-btn ${motorMode === mode ? 'active' : ''}`}
              onClick={() => {
                setMotorMode(mode);
                onMotorControl?.({ mode, freq: 1.0, turn: 0 });
              }}
            >
              {mode === 'brain' ? 'Brain' : mode === 'manual' ? 'Manual' : 'Hybrid'}
            </button>
          ))}
        </div>

        {(motorMode === 'manual' || motorMode === 'hybrid') && (
          <div className="fly-3d-joystick">
            <Joystick onMove={handleJoystick} size={90} />
            <div className="joystick-hint">WASD or drag</div>
          </div>
        )}

        <div className="fly-3d-camera-controls">
          <button
            className={`mode-btn ${cameraFollow ? 'active' : ''}`}
            onClick={() => setCameraFollow(!cameraFollow)}
          >
            {cameraFollow ? 'Follow' : 'Free'}
          </button>
        </div>

        {bodyState && (
          <div className="fly-3d-info">
            <span>x:{bodyState.position.x.toFixed(3)}</span>
            <span>y:{bodyState.position.y.toFixed(3)}</span>
            <span>v:{bodyState.velocity.toFixed(3)}m/s</span>
            <span>hdg:{bodyState.orientation.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
