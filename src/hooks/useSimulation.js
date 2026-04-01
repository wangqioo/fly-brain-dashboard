import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_HISTORY = 200;
const MAX_RASTER_SPIKES = 3000;

export function useSimulation() {
  const [status, setStatus] = useState('disconnected');
  const [experiment, setExperiment] = useState('sugar_200hz');
  const [experiments, setExperiments] = useState({});
  const [config, setConfig] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [history, setHistory] = useState([]);
  const [rasterSpikes, setRasterSpikes] = useState([]);
  const [cumulativeSpikes, setCumulativeSpikes] = useState(0);
  const wsRef = useRef(null);
  const historyRef = useRef([]);
  const rasterRef = useRef([]);

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
    setHistory([]);
    setRasterSpikes([]);
    setCumulativeSpikes(0);
    setCurrentCycle(null);
    sendCommand('start', { experiment, speed });
  }, [sendCommand, experiment]);

  const pause = useCallback(() => sendCommand('pause'), [sendCommand]);
  const resume = useCallback(() => sendCommand('resume'), [sendCommand]);
  const stop = useCallback(() => {
    sendCommand('stop');
    setStatus('connected');
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
    start,
    pause,
    resume,
    stop,
    connect,
  };
}
