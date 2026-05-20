import { DataCard } from '../components/DataCard';
import { RealtimeChart } from '../components/RealtimeChart';
import { useMonitorStore } from '../store/monitorStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { AlertBanner } from '../components/AlertBanner';

export const Dashboard = () => {
  useWebSocket();
  const currentData = useMonitorStore((state) => state.currentData);

  const simulateAnomaly = (type: 'temperature' | 'humidity' | 'oxygen') => {
    fetch(`http://localhost:3001/api/sensor/simulate-anomaly/${type}`, {
      method: 'POST',
    }).catch(console.error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AlertBanner />

      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">监控控制台</h1>
          <p className="text-slate-400">实时监控发酵过程中的关键参数</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DataCard
            title="温度"
            value={currentData?.temperature || 0}
            unit="℃"
            icon="temperature"
            status={
              currentData?.temperature && currentData.temperature >= 42
                ? 'critical'
                : currentData?.temperature && currentData.temperature >= 38
                ? 'warning'
                : 'normal'
            }
          />
          <DataCard
            title="湿度"
            value={currentData?.humidity || 0}
            unit="%"
            icon="humidity"
            status={
              currentData?.humidity && currentData.humidity >= 85
                ? 'critical'
                : currentData?.humidity && currentData.humidity >= 80
                ? 'warning'
                : 'normal'
            }
          />
          <DataCard
            title="氧浓度"
            value={currentData?.oxygen || 0}
            unit="%"
            icon="oxygen"
            status={
              currentData?.oxygen && currentData.oxygen <= 6
                ? 'critical'
                : currentData?.oxygen && currentData.oxygen <= 8
                ? 'warning'
                : 'normal'
            }
          />
          <DataCard
            title="发酵时间"
            value={currentData?.fermentationTime || 0}
            unit="小时"
            icon="time"
          />
        </div>

        <RealtimeChart />

        <div className="mt-8">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">测试功能</h3>
            <p className="text-slate-400 text-sm mb-4">点击以下按钮模拟异常告警</p>
            <div className="flex gap-4">
              <button
                onClick={() => simulateAnomaly('temperature')}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/30"
              >
                模拟温度异常
              </button>
              <button
                onClick={() => simulateAnomaly('humidity')}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/30"
              >
                模拟湿度异常
              </button>
              <button
                onClick={() => simulateAnomaly('oxygen')}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors border border-blue-500/30"
              >
                模拟氧浓度异常
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
