
import { Thermometer, Droplets, FlaskConical, Beaker } from 'lucide-react';

interface SensorCardProps {
    title: string;
    value: number;
    unit: string;
    icon: 'temperature' | 'humidity' | 'salinity' | 'ph';
    minThreshold?: number;
    maxThreshold?: number;
    trend?: 'up' | 'down' | 'stable';
}

const iconMap = {
    temperature: Thermometer,
    humidity: Droplets,
    salinity: FlaskConical,
    ph: Beaker,
};

const gradientMap = {
    temperature: 'from-orange-400 to-red-500',
    humidity: 'from-blue-400 to-cyan-500',
    salinity: 'from-emerald-400 to-teal-500',
    ph: 'from-violet-400 to-purple-500',
};

export const SensorCard = ({ title, value, unit, icon, minThreshold, maxThreshold, trend }: SensorCardProps) => {
    const Icon = iconMap[icon];
    const gradient = gradientMap[icon];

    const isNormal = minThreshold !== undefined && maxThreshold !== undefined
        ? value >= minThreshold && value <= maxThreshold
        : true;

    const statusColor = isNormal ? 'bg-green-500' : 'bg-red-500';

    return (
        <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg transform transition-all hover:scale-105`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Icon className="w-8 h-8" />
                    </div>
                    <span className="text-lg font-medium opacity-90">{title}</span>
                </div>
                <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`} />
            </div>

            <div className="flex items-end gap-2">
                <span className="text-5xl font-bold">{value.toFixed(2)}</span>
                <span className="text-xl opacity-80 mb-1">{unit}</span>
            </div>

            {trend && (
                <div className="mt-4 flex items-center gap-2 text-sm opacity-80">
                    {trend === 'up' && <span>↑ 上升</span>}
                    {trend === 'down' && <span>↓ 下降</span>}
                    {trend === 'stable' && <span>→ 稳定</span>}
                </div>
            )}
        </div>
    );
};

