import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { GameCanvas } from './components/GameCanvas';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { WaterLevelControl } from './components/WaterLevelControl';
import { TopBar } from './components/TopBar';

function App() {
  const { isPlaying, elapsedTime, updateElapsedTime } = useGameStore();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isPlaying) {
      interval = setInterval(() => {
        updateElapsedTime(elapsedTime + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, elapsedTime, updateElapsedTime]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      <GameCanvas />
      <Toolbar />
      <PropertyPanel />
      <WaterLevelControl />
      <TopBar />
    </div>
  );
}

export default App;
