
import { useEffect, useState, useCallback } from 'react';
import { Calendar, TrendingUp, Download, AlertCircle, Loader2 } from 'lucide-react';
import type { SensorData } from '../../shared/types';

const sensorLabels: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    salinity: '盐度',
    ph: 'pH值',
};

const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const History = () => {
    const [data, setData] = useState<SensorData[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = '/api/sensor/history?limit=200';
            if (startDate && endDate) {
                url += `&startTime=${encodeURIComponent(startDate)}&endTime=${encodeURIComponent(endDate)}`;
            }
            const dataPromise = fetchWithTimeout(url);

            let statsUrl = '/api/sensor/stats';
            if (startDate && endDate) {
                statsUrl += `?startTime=${encodeURIComponent(startDate)}&endTime=${encodeURIComponent(endDate)}`;
            }
            const statsPromise = fetchWithTimeout(statsUrl);

            const [sensorData, statsData] = await Promise.all([dataPromise, statsPromise]);
            setData(sensorData);
            setStats(statsData);
        } catch (err) {
            console.error('Fetch error:', err);
            setError(err instanceof Error ? err.message : '请求超时，请稍后重试');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const exportCSV = () => {
        const headers = ['时间', '温度(°C)', '湿度(%)', '盐度(ppt)', 'pH值'];
        const rows = data.map((d) => [
            new Date(d.created_at).toLocaleString('zh-CN'),
            d.temperature,
            d.humidity,
            d.salinity,
            d.ph,
        ]);

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sensor_data_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">历史数据</h1>
                    <p className="text-gray-500 mt-1">查看和分析历史传感器数据</p>
                </div>
                <button
                    onClick={exportCSV}
                    disabled={loading || data.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" />
                    导出CSV
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={fetchData}
                        className="ml-auto px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                    >
                        重试
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-gray-800">时间筛选</h3>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">开始时间:</span>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">结束时间:</span>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? '查询中...' : '查询'}
                    </button>
                    <button
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                        }}
                        disabled={loading}
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        重置
                    </button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { key: 'temp', label: '温度', unit: '°C', color: 'orange' },
                        { key: 'hum', label: '湿度', unit: '%', color: 'cyan' },
                        { key: 'sal', label: '盐度', unit: 'ppt', color: 'teal' },
                        { key: 'ph', label: 'pH值', unit: '', color: 'purple' },
                    ].map((item) => (
                        <div key={item.key} className="bg-white rounded-2xl p-5 shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                <span className="font-medium text-gray-800">{item.label}统计</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">最小值:</span>
                                    <span className="font-medium">{(stats as any)[`${item.key}_min`]?.toFixed(2) || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">最大值:</span>
                                    <span className="font-medium">{(stats as any)[`${item.key}_max`]?.toFixed(2) || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">平均值:</span>
                                    <span className="font-medium text-blue-600">
                                        {(stats as any)[`${item.key}_avg`]?.toFixed(2) || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-gray-500">正在加载数据...</p>
                    </div>
                </div>
            )}

            {!loading && data.length === 0 && !error && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">暂无数据记录</p>
                </div>
            )}

            {!loading && data.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-800">数据记录 ({data.length} 条)</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">温度 (°C)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">湿度 (%)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">盐度 (ppt)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">pH值</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((row, index) => (
                                    <tr key={row.id || index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-sm text-gray-600">
                                            {new Date(row.created_at).toLocaleString('zh-CN')}
                                        </td>
                                        <td className="px-6 py-3 text-sm font-medium text-orange-600">{row.temperature.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-sm font-medium text-cyan-600">{row.humidity.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-sm font-medium text-teal-600">{row.salinity.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-sm font-medium text-purple-600">{row.ph.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

