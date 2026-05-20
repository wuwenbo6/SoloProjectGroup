
import { useEffect, useState } from 'react';
import { SensorCard } from '../components/SensorCard';
import { ChartView } from '../components/ChartView';
import { useSSE } from '../hooks/useSSE';
import { useSensorStore } from '../store/sensorStore';
import type { SensorData } from '../../shared/types';

export const Dashboard = () => {
    useSSE();
    const latestData = useSensorStore((state) => state.latestData);
    const [historyData, setHistoryData] = useState<SensorData[]>([]);

    useEffect(() => {
        fetch('/api/sensor/history?limit=50')
            .then((res) => res.json())
            .then((data) => setHistoryData(data));
    }, []);

    useEffect(() => {
        if (latestData) {
            setHistoryData((prev) => [latestData, ...prev.slice(0, 49)]);
        }
    }, [latestData]);

    if (!latestData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">实时监控面板</h1>
                <p className="text-gray-500 mt-1">实时监测环境数据，数据每2秒更新一次</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SensorCard
                    title="温度"
                    value={latestData.temperature}
                    unit="°C"
                    icon="temperature"
                    minThreshold={22}
                    maxThreshold={28}
                />
                <SensorCard
                    title="湿度"
                    value={latestData.humidity}
                    unit="%"
                    icon="humidity"
                    minThreshold={45}
                    maxThreshold={75}
                />
                <SensorCard
                    title="盐度"
                    value={latestData.salinity}
                    unit="ppt"
                    icon="salinity"
                    minThreshold={25}
                    maxThreshold={35}
                />
                <SensorCard
                    title="pH值"
                    value={latestData.ph}
                    unit=""
                    icon="ph"
                    minThreshold={6.5}
                    maxThreshold={7.5}
                />
            </div>

            <ChartView data={historyData} />
        </div>
    );
};

