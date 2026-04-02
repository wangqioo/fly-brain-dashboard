import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MotorControlPanel - Virtual joystick + WASD controls for manual fly movement.
 * Sends motor_override commands to the backend to directly control
 * freq_modulation (forward/backward) and turn_bias (left/right).
 */

const JOYSTICK_SIZE = 140;
const KNOB_SIZE = 36;
const MAX_DISPLACEMENT = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

export default function MotorControlPanel({ onMotorControl, status }) {
  const [mode, setMode] = useState('brain'); // 'brain' | 'manual' | 'hybrid'
  const [joyX, setJoyX] = useState(0); // -1 to 1 (left/right)
  const [joyY, setJoyY] = useState(0); // -1 to 1 (back/forward)
  const [keysDown, setKeysDown] = useState({});
  const isDragging = useRef(false);
  const joyRef = useRef(null);
  const sendIntervalRef = useRef(null);

  const isActive = status === 'running' && mode !== 'brain';

  // Convert joystick position to motor commands
  const getMotorValues = useCallback(() => {
    // Forward: joyY maps to freq_modulation (0.5 idle .. 2.0 max forward)
    // Backward: joyY negative maps to freq_modulation below 1.0
    const freq = 1.0 + joyY * 1.0; // -1->0.0, 0->1.0, 1->2.0
    const clampedFreq = Math.max(0.0, Math.min(2.0, freq));
    // Turn: joyX maps to turn_bias (-1 left .. 1 right)
    const turn = joyX;
    return { freq_modulation: clampedFreq, turn_bias: turn };
  }, [joyX, joyY]);

  // Send motor commands at regular intervals when active
  useEffect(() => {
    if (isActive) {
      sendIntervalRef.current = setInterval(() => {
        const vals = getMotorValues();
        onMotorControl?.(mode, vals.freq_modulation, vals.turn_bias);
      }, 50); // 20Hz update rate
    }
    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
    };
  }, [isActive, getMotorValues, onMotorControl, mode]);

  // Reset joystick when releasing or switching modes
  const resetJoystick = useCallback(() => {
    setJoyX(0);
    setJoyY(0);
  }, []);

  // Joystick drag handling
  const handleJoystickStart = useCallback((e) => {
    if (!isActive) return;
    isDragging.current = true;
    e.preventDefault();
  }, [isActive]);

  const handleJoystickMove = useCallback((e) => {
    if (!isDragging.current || !joyRef.current) return;
    e.preventDefault();

    const rect = joyRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let dx = (clientX - centerX) / MAX_DISPLACEMENT;
    let dy = -(clientY - centerY) / MAX_DISPLACEMENT; // invert Y

    // Clamp to unit circle
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      dx /= dist;
      dy /= dist;
    }

    setJoyX(Math.round(dx * 100) / 100);
    setJoyY(Math.round(dy * 100) / 100);
  }, []);

  const handleJoystickEnd = useCallback(() => {
    isDragging.current = false;
    resetJoystick();
  }, [resetJoystick]);

  // Global mouse/touch listeners for drag
  useEffect(() => {
    const onMove = (e) => handleJoystickMove(e);
    const onEnd = () => handleJoystickEnd();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [handleJoystickMove, handleJoystickEnd]);

  // WASD keyboard controls
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isActive) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setKeysDown(prev => ({ ...prev, [key]: true }));
      }
    };
    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      setKeysDown(prev => ({ ...prev, [key]: false }));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isActive]);

  // Apply keyboard state to joystick
  useEffect(() => {
    if (!isActive) return;
    let ky = 0, kx = 0;
    if (keysDown['w'] || keysDown['arrowup']) ky += 1;
    if (keysDown['s'] || keysDown['arrowdown']) ky -= 1;
    if (keysDown['a'] || keysDown['arrowleft']) kx -= 1;
    if (keysDown['d'] || keysDown['arrowright']) kx += 1;

    // Only override if keys are pressed and joystick isn't being dragged
    if ((ky !== 0 || kx !== 0) && !isDragging.current) {
      setJoyX(kx);
      setJoyY(ky);
    } else if (ky === 0 && kx === 0 && !isDragging.current) {
      setJoyX(0);
      setJoyY(0);
    }
  }, [keysDown, isActive]);

  // Notify backend when mode changes
  useEffect(() => {
    if (mode === 'brain') {
      onMotorControl?.('brain', 1.0, 0.0);
    }
  }, [mode, onMotorControl]);

  const motorVals = getMotorValues();
  const knobPxX = joyX * MAX_DISPLACEMENT;
  const knobPxY = -joyY * MAX_DISPLACEMENT;

  return (
    <div className="panel motor-control-panel">
      <h3 className="panel-title">Motor Control</h3>

      {/* Mode selector */}
      <div className="motor-mode-selector">
        {['brain', 'manual', 'hybrid'].map(m => (
          <button
            key={m}
            className={`motor-mode-btn ${mode === m ? 'active' : ''}`}
            onClick={() => { setMode(m); resetJoystick(); }}
          >
            {m === 'brain' ? 'Brain' : m === 'manual' ? 'Manual' : 'Hybrid'}
          </button>
        ))}
      </div>

      <div className="motor-mode-desc">
        {mode === 'brain' && 'Neural activity drives movement'}
        {mode === 'manual' && 'Direct joystick/WASD control'}
        {mode === 'hybrid' && 'Brain + manual override blend'}
      </div>

      {/* Virtual joystick */}
      <div className="joystick-container">
        <div
          ref={joyRef}
          className={`joystick-base ${isActive ? 'active' : 'disabled'}`}
          style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
          onMouseDown={handleJoystickStart}
          onTouchStart={handleJoystickStart}
        >
          {/* Crosshair lines */}
          <div className="joystick-cross-h" />
          <div className="joystick-cross-v" />

          {/* Direction labels */}
          <span className="joy-label joy-label-up">W</span>
          <span className="joy-label joy-label-down">S</span>
          <span className="joy-label joy-label-left">A</span>
          <span className="joy-label joy-label-right">D</span>

          {/* Knob */}
          <div
            className="joystick-knob"
            style={{
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              transform: `translate(${knobPxX}px, ${knobPxY}px)`,
            }}
          />
        </div>
      </div>

      {/* Output values */}
      <div className="motor-values">
        <div className="motor-value-row">
          <span className="motor-label">Speed</span>
          <div className="motor-bar-track">
            <div
              className="motor-bar-fill speed"
              style={{ width: `${(motorVals.freq_modulation / 2.0) * 100}%` }}
            />
          </div>
          <span className="motor-num">{motorVals.freq_modulation.toFixed(2)}</span>
        </div>
        <div className="motor-value-row">
          <span className="motor-label">Turn</span>
          <div className="motor-bar-track turn-track">
            <div
              className="motor-bar-fill turn"
              style={{
                left: '50%',
                width: `${Math.abs(motorVals.turn_bias) * 50}%`,
                transform: motorVals.turn_bias < 0 ? 'translateX(-100%)' : 'none',
              }}
            />
            <div className="turn-center-mark" />
          </div>
          <span className="motor-num">{motorVals.turn_bias.toFixed(2)}</span>
        </div>
      </div>

      {mode !== 'brain' && (
        <div className="motor-keys-hint">
          WASD or Arrow keys to control
        </div>
      )}
    </div>
  );
}
