import { Droplets } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

export function WaterLevelControl() {
  const { waterLevel, setTargetWaterLevel } = useGameStore();

  return (
    <div className="absolute right-4 bottom-4 z-10 bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <Droplets className="text-blue-400" size={20} />
        <h3 className="text-white font-semibold">水位控制</h3>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-32 bg-slate-700 rounded-lg overflow-hidden relative">
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300"
            style={{ height: `${(waterLevel.height / waterLevel.maxHeight) * 100}%` }}
          />
        </div>
        
        <input
          type="range"
          min={waterLevel.minHeight}
          max={waterLevel.maxHeight}
          value={waterLevel.targetHeight}
          onChange={(e) => setTargetWaterLevel(Number(e.target.value))}
          className="w-32 h-32 appearance-none"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
          }}
        />
      </div>
      
      <div className="text-center mt-2">
        <span className="text-white text-sm font-mono">
          {Math.round(waterLevel.height)} px
        </span>
      </div>
    </div>
  );
}
