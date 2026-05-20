
import { useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import type { SensorData } from '../../shared/types';

interface ChartViewProps {
    data: SensorData[];
}

const colors = {
    temperature: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
    humidity: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    salinity: { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
    ph: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
};

const sensorKeys = ['temperature', 'humidity', 'salinity', 'ph'] as const;

export const ChartView = ({ data }: ChartViewProps) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const dataRef = useRef<SensorData[]>([]);

    const chartData = useMemo(() => data.slice().reverse(), [data]);
    const timeLabels = useMemo(() =>
        chartData.map((d) =>
            new Date(d.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        ),
        [chartData]
    );

    useEffect(() => {
        if (!chartRef.current || !data.length) return;

        if (chartInstance.current) {
            chartInstance.current.data.labels = timeLabels;
            sensorKeys.forEach((key, index) => {
                if (chartInstance.current?.data.datasets[index]) {
                    chartInstance.current.data.datasets[index].data =
                        chartData.map((d) => d[key as keyof SensorData] as number);
                }
            });
            chartInstance.current.update('none');
            return;
        }

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: sensorKeys.map((key) => ({
                    label: key === 'temperature' ? '温度 (°C)' :
                           key === 'humidity' ? '湿度 (%)' :
                           key === 'salinity' ? '盐度 (ppt)' : 'pH值',
                    data: chartData.map((d) => d[key] as number),
                    borderColor: colors[key].border,
                    backgroundColor: colors[key].bg,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300,
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12 },
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8, font: { size: 11 } },
                    },
                    y: {
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { font: { size: 11 } },
                    },
                },
            },
        });

        dataRef.current = data;

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [chartData, timeLabels, data.length]);

    return (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">实时趋势图</h3>
            <div className="h-80">
                <canvas ref={chartRef} />
            </div>
        </div>
    );
};

