
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Settings, Check } from 'lucide-react';
import { useSensorStore } from '../store/sensorStore';
import type { AlertRecord, AlertConfig } from '../../shared/types';

const sensorLabels: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    salinity: '盐度',
    ph: 'pH值',
};

export const Alerts = () => {
    const realtimeAlerts = useSensorStore((state) => state.alerts);
    const [alerts, setAlerts] = useState<AlertRecord[]>([]);
    const [configs, setConfigs] = useState<AlertConfig[]>([]);
    const [editingConfig, setEditingConfig] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ min: number; max: number }>({ min: 0, max: 0 });

    useEffect(() => {
        fetch('/api/alerts')
            .then((res) => res.json())
            .then((data) => setAlerts(data));

        fetch('/api/alerts/config')
            .then((res) => res.json())
            .then((data) => setConfigs(data));
    }, []);

    useEffect(() => {
        if (realtimeAlerts.length > 0) {
            setAlerts((prev) => {
                const combined = [...realtimeAlerts, ...prev];
                const unique = Array.from(new Map(combined.map((a) => [a.id, a])).values());
                return unique.slice(0, 100);
            });
        }
    }, [realtimeAlerts]);

    const handleEdit = (config: AlertConfig) => {
        setEditingConfig(config.sensor_type);
        setEditValues({ min: config.min_threshold, max: config.max_threshold });
    };

    const handleSave = async (sensorType: string) => {
        const config = configs.find((c) => c.sensor_type === sensorType);
        if (!config) return;

        const res = await fetch(`/api/alerts/config/${sensorType}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                min_threshold: editValues.min,
                max_threshold: editValues.max,
                enabled: config.enabled,
            }),
        });

        const updated = await res.json();
        setConfigs((prev) => prev.map((c) => (c.sensor_type === sensorType ? updated : c)));
        setEditingConfig(null);
    };

    const toggleEnabled = async (sensorType: string, enabled: boolean) => {
        const config = configs.find((c) => c.sensor_type === sensorType);
        if (!config) return;

        const res = await fetch(`/api/alerts/config/${sensorType}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                min_threshold: config.min_threshold,
                max_threshold: config.max_threshold,
                enabled: !enabled,
            }),
        });

        const updated = await res.json();
        setConfigs((prev) => prev.map((c) => (c.sensor_type === sensorType ? updated : c)));
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">告警中心</h1>
                <p className="text-gray-500 mt-1">查看告警记录和配置告警阈值</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                                <h2 className="text-lg font-semibold text-gray-800">告警记录</h2>
                                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium">
                                    {alerts.length} 条
                                </span>
                            </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {alerts.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                    <p>暂无告警记录，一切正常！</p>
                                </div>
                            ) : (
                                alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="flex items-start gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">
                                                {sensorLabels[alert.sensor_type]} 异常
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                当前值: <span className="font-semibold text-red-600">{alert.current_value}</span>
                                                {' '}，阈值: {alert.threshold_value}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <Clock className="w-3 h-3" />
                                                {new Date(alert.created_at).toLocaleString('zh-CN')}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <Settings className="w-6 h-6 text-blue-500" />
                                <h2 className="text-lg font-semibold text-gray-800">阈值配置</h2>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            {configs.map((config) => (
                                <div key={config.id} className="p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-gray-800">
                                            {sensorLabels[config.sensor_type]}
                                        </span>
                                        <button
                                            onClick={() => toggleEnabled(config.sensor_type, config.enabled)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                                config.enabled
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-gray-200 text-gray-500'
                                            }`}
                                        >
                                            {config.enabled ? '已启用' : '已禁用'}
                                        </button>
                                    </div>

                                    {editingConfig === config.sensor_type ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500 w-12">下限:</span>
                                                <input
                                                    type="number"
                                                    value={editValues.min}
                                                    onChange={(e) => setEditValues((p) => ({ ...p, min: Number(e.target.value) }))}
                                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500 w-12">上限:</span>
                                                <input
                                                    type="number"
                                                    value={editValues.max}
                                                    onChange={(e) => setEditValues((p) => ({ ...p, max: Number(e.target.value) }))}
                                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleSave(config.sensor_type)}
                                                className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                                            >
                                                保存
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">阈值范围:</span>
                                                <span className="font-medium text-gray-800">
                                                    {config.min_threshold} ~ {config.max_threshold}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleEdit(config)}
                                                className="w-full py-2 text-blue-500 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                编辑配置
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

