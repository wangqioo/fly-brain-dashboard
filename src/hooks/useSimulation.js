import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_HISTORY = 200;
const MAX_RASTER_SPIKES = 3000;
const MAX_TRAJECTORY = 500;
const MAX_GAIT_HISTORY = 200;

export function useSimulation() {
  const [status, setStatus] = useState('disconnected');
  const [experiment, setExperiment] = useState('sugar_200hz');
  const [experiments, setExperiments] = useState({});
  const [config, setConfig] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [history, setHistory] = useState([]);
  const [rasterSpikes, setRasterSpikes] = useState([]);
  const [cumulativeSpikes, setCumulativeSpikes] = useState(0);
  const [trajectoryHistory, setTrajectoryHistory] = useState([]);
  const [gaitHistory, setGaitHistory] = useState([]);
  const [sensoryState, setSensoryState] = useState({});
  const wsRef = useRef(null);
  const historyRef = useRef([]);
  const rasterRef = useRef([]);
  const trajectoryRef = useRef([]);
  const gaitRef = useRef([]);

  const getWsUrl = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${proto}//${host}/ws/simulation`;
  }, []);

  const fetchExperiments = useCallback(async () => {
    try {
      const res = await fetch('/api/experiments');
      const data = await res.json();
      setExperiments(data.experiments || {});
    } catch (e) {
      console.error('Failed to fetch experiments:', e);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error('Failed to fetch config:', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'status') {
        setStatus(msg.status === 'running' ? 'running' : msg.status === 'paused' ? 'paused' : 'connected');
        return;
      }

      if (msg.type === 'stimulus_ack') {
        setSensoryState(prev => ({
          ...prev,
          [msg.channel]: { active: msg.active, intensity: msg.intensity || 0 }
        }));
        return;
      }

      if (msg.type === 'sensory_update') {
        setSensoryState(msg.channels || {});
        return;
      }

      if (msg.type === 'cycle') {
        setCurrentCycle(msg);
        setCumulativeSpikes(msg.cumulative_spikes);

        const entry = {
          sync: msg.sync,
          time_ms: msg.time_ms,
          brain_spikes: msg.brain_spikes,
          freq_modulation: msg.cpg_params.freq_modulation,
          turn_bias: msg.cpg_params.turn_bias,
          wall_time: msg.cycle_wall_time,
          rt_ratio: msg.rt_ratio,
          cumulative_spikes: msg.cumulative_spikes,
        };

        historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), entry];
        setHistory(historyRef.current);

        if (msg.spikes?.length) {
          const newSpikes = msg.spikes.map(s => ({
            ...s,
            time: s.time,
            neuron: s.neuron,
          }));
          rasterRef.current = [...rasterRef.current, ...newSpikes].slice(-MAX_RASTER_SPIKES);
          setRasterSpikes(rasterRef.current);
        }

        // Track trajectory for embodied mode
        if (msg.body_state?.position) {
          const pos = msg.body_state.position;
          trajectoryRef.current = [
            ...trajectoryRef.current.slice(-(MAX_TRAJECTORY - 1)),
            { x: pos.x, y: pos.y, time: msg.time_ms }
          ];
          setTrajectoryHistory(trajectoryRef.current);
        }

        // Track gait (contact forces) for embodied mode
        if (msg.body_state?.contact_forces) {
          gaitRef.current = [
            ...gaitRef.current.slice(-(MAX_GAIT_HISTORY - 1)),
            { forces: msg.body_state.contact_forces, time: msg.time_ms }
          ];
          setGaitHistory(gaitRef.current);
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };
  }, [getWsUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  const sendCommand = useCallback((command, params = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, ...params }));
    }
  }, []);

  const start = useCallback((speed = 1.0) => {
    historyRef.current = [];
    rasterRef.current = [];
    trajectoryRef.current = [];
    gaitRef.current = [];
    setHistory([]);
    setRasterSpikes([]);
    setCumulativeSpikes(0);
    setCurrentCycle(null);
    setTrajectoryHistory([]);
    setGaitHistory([]);
    setSensoryState({});
    sendCommand('start', { experiment, speed });
  }, [sendCommand, experiment]);

  const pause = useCallback(() => sendCommand('pause'), [sendCommand]);
  const resume = useCallback(() => sendCommand('resume'), [sendCommand]);
  const stop = useCallback(() => {
    sendCommand('stop');
    setStatus('connected');
  }, [sendCommand]);

  const setStimulus = useCallback((channel, active, intensity = 1.0) => {
    sendCommand('set_stimulus', { channel, active, intensity });
  }, [sendCommand]);

  useEffect(() => {
    fetchExperiments();
    fetchConfig();
    connect();
    return () => disconnect();
  }, []);

  return {
    status,
    experiment,
    setExperiment,
    experiments,
    config,
    currentCycle,
    history,
    rasterSpikes,
    cumulativeSpikes,
    trajectoryHistory,
    gaitHistory,
    sensoryState,
    start,
    pause,
    resume,
    stop,
    connect,
    setStimulus,
  };
}
