import SimulationControls from './SimulationControls';
import SensoryControlPanel from './SensoryControlPanel';
import RasterPlot from './RasterPlot';
import FiringRatePanel from './FiringRatePanel';
import CPGPanel from './CPGPanel';
import MetricsPanel from './MetricsPanel';
import SpikeTimeSeriesPanel from './SpikeTimeSeriesPanel';
import BodyStatePanel from './BodyStatePanel';
import TrajectoryPanel from './TrajectoryPanel';
import GaitDiagramPanel from './GaitDiagramPanel';
import FlyArenaView from './FlyArenaView';
import { useSimulation } from '../hooks/useSimulation';

export default function Dashboard() {
  const sim = useSimulation();

  const isEmbodied = sim.currentCycle?.body_state != null;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="header-title">Drosophila Brain</h1>
          <span className="header-subtitle">Embodied Neural Simulation Dashboard</span>
        </div>
        <div className="header-right">
          <span className="header-badge">FlyWire v783</span>
          <span className="header-badge">139,255 neurons</span>
          <span className="header-badge">LIF + NeuroMechFly</span>
          {isEmbodied && <span className="header-badge embodied-badge">Embodied</span>}
        </div>
      </header>

      <div className={`dashboard-grid ${isEmbodied ? 'embodied-layout' : ''}`}>
        <div className="grid-sidebar">
          <SimulationControls
            status={sim.status}
            experiment={sim.experiment}
            setExperiment={sim.setExperiment}
            experiments={sim.experiments}
            onStart={sim.start}
            onPause={sim.pause}
            onResume={sim.resume}
            onStop={sim.stop}
          />
          <SensoryControlPanel
            onStimulusChange={sim.setStimulus}
            status={sim.status}
          />
          <MetricsPanel
            currentCycle={sim.currentCycle}
            cumulativeSpikes={sim.cumulativeSpikes}
            config={sim.config}
          />
        </div>

        <div className="grid-main">
          {isEmbodied && (
            <FlyArenaView
              bodyState={sim.currentCycle?.body_state}
              trajectoryHistory={sim.trajectoryHistory}
              currentCycle={sim.currentCycle}
              activeSensory={sim.currentCycle?.active_sensory}
            />
          )}
          <RasterPlot
            spikes={sim.rasterSpikes}
            currentTime={sim.currentCycle?.time_ms}
            displayNeurons={sim.currentCycle?.display_neurons || 500}
          />
          <SpikeTimeSeriesPanel history={sim.history} />
          {isEmbodied && (
            <GaitDiagramPanel gaitHistory={sim.gaitHistory} />
          )}
        </div>

        <div className="grid-right">
          <FiringRatePanel
            topNeurons={sim.currentCycle?.top_neurons}
            rateHistogram={sim.currentCycle?.rate_histogram}
          />
          <CPGPanel history={sim.history} />
          {isEmbodied ? (
            <>
              <TrajectoryPanel
                bodyState={sim.currentCycle?.body_state}
                trajectoryHistory={sim.trajectoryHistory}
              />
              <BodyStatePanel
                bodyState={sim.currentCycle?.body_state}
                currentCycle={sim.currentCycle}
              />
            </>
          ) : (
            <BodyStatePanel
              bodyState={sim.currentCycle?.body_state}
              currentCycle={sim.currentCycle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
