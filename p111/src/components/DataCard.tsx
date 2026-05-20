import { Thermometer, Droplets, Wind, Clock } from 'lucide-react';

interface DataCardProps {
  title: string;
  value: number;
  unit: string;
  icon: 'temperature' | 'humidity' | 'oxygen' | 'time';
  status?: 'normal' | 'warning' | 'critical';
}

const iconMap = {
  temperature: Thermometer,
  humidity: Droplets,
  oxygen: Wind,
  time: Clock,
};

const statusColors = {
  normal: 'from-emerald-500 to-teal-600',
  warning: 'from-amber-500 to-orange-600',
  critical: 'from-red-500 to-rose-600',
};

const statusBorders = {
  normal: 'border-emerald-500/30',
  warning: 'border-amber-500/30',
  critical: 'border-red-500/30',
};

export const DataCard = ({ title, value, unit, icon: iconType, status = 'normal' }: DataCardProps) => {
  const Icon = iconMap[iconType];

  return (
    <div className={`bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border ${statusBorders[status]} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-900/50`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">{value.toFixed(2)}</span>
            <span className="text-slate-400 text-lg">{unit}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${statusColors[status]} shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${statusColors[status]} animate-pulse`} />
        <span className="text-xs text-slate-500">实时数据</span>
      </div>
    </div>
  );
};
