import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, XCircle, Clock, Thermometer, Droplets, FlaskConical, Beaker, Star, TrendingUp, Filter, ChevronDown } from 'lucide-react';

interface BatchData {
    id: string;
    name: string;
    startTime: string;
    endTime?: string;
    status: 'fermenting' | 'completed' | 'failed';
    avgTemperature: number;
    avgHumidity: number;
    avgSalinity: number;
    avgPh: number;
    qualityScore?: number;
}

export const BatchComparison = () => {
    const [batches, setBatches] = useState<BatchData[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/ai/batch-comparison');
                const data = await res.json();
                setBatches(data);
                setSelectedBatches(data.slice(0, 3).map((b: BatchData) => b.id));
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const toggleBatch = (batchId: string) => {
        setSelectedBatches(prev =>
            prev.includes(batchId)
                ? prev.filter(id => id !== batchId)
                : [...prev, batchId]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700 border-green-200';
            case 'fermenting': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'failed': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'completed': return 'from-green-400 to-emerald-500';
            case 'fermenting': return 'from-blue-400 to-cyan-500';
            case 'failed': return 'from-red-400 to-rose-500';
            default: return 'from-gray-400 to-gray-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-5 h-5" />;
            case 'fermenting': return <Clock className="w-5 h-5" />;
            case 'failed': return <XCircle className="w-5 h-5" />;
            default: return null;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed': return '已完成';
            case 'fermenting': return '发酵中';
            case 'failed': return '失败';
            default: return status;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 75) return 'text-blue-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getBatchColor = (index: number) => {
        const colors = [
            { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
            { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-500' },
            { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' },
            { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' },
            { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-600', bar: 'bg-pink-500' },
        ];
        return colors[index % colors.length];
    };

    const filteredBatches = statusFilter === 'all'
        ? batches
        : batches.filter(b => b.status === statusFilter);

    const selectedBatchData = batches.filter(b => selectedBatches.includes(b.id));

    const maxTemp = Math.max(...selectedBatchData.map(b => b.avgTemperature), 30);
    const maxHumidity = Math.max(...selectedBatchData.map(b => b.avgHumidity), 100);
    const maxSalinity = Math.max(...selectedBatchData.map(b => b.avgSalinity), 40);
    const maxPh = Math.max(...selectedBatchData.map(b => b.avgPh), 8);
    const maxScore = Math.max(...selectedBatchData.map(b => b.qualityScore || 0), 100);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    <p className="text-gray-500">正在加载批次数据...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-emerald-500" />
                        多批次对比
                    </h1>
                    <p className="text-gray-500 mt-1">对比不同批次的发酵参数和品质差异</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="all">全部状态</option>
                            <option value="fermenting">发酵中</option>
                            <option value="completed">已完成</option>
                            <option value="failed">失败</option>
                        </select>
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 左侧批次列表 */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-4">选择批次对比</h3>
                        <p className="text-sm text-gray-500 mb-4">已选择 {selectedBatches.length} 个批次</p>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {filteredBatches.map((batch) => (
                                <button
                                    key={batch.id}
                                    onClick={() => toggleBatch(batch.id)}
                                    className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                                        selectedBatches.includes(batch.id)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-gray-800">{batch.name}</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(batch.status)}`}>
                                            {getStatusIcon(batch.status)}
                                            {getStatusText(batch.status)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <span>ID: {batch.id}</span>
                                        {batch.qualityScore && (
                                            <span className={`font-bold ${getScoreColor(batch.qualityScore)}`}>
                                                得分 {batch.qualityScore}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧对比图表 */}
                <div className="lg:col-span-3 space-y-6">
                    {selectedBatchData.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500">请选择至少一个批次进行对比</p>
                        </div>
                    ) : (
                        <>
                            {/* 参数对比图表 */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-blue-500" />
                                    发酵参数对比
                                </h3>
                                <div className="space-y-8">
                                    {/* 温度对比 */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Thermometer className="w-5 h-5 text-orange-500" />
                                            <span className="font-medium text-gray-700">平均温度 (°C)</span>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedBatchData.map((batch, index) => {
                                                const colors = getBatchColor(index);
                                                return (
                                                    <div key={batch.id} className="flex items-center gap-4">
                                                        <span className="w-32 text-sm font-medium text-gray-600 truncate">{batch.name}</span>
                                                        <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${colors.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                                                                style={{ width: `${(batch.avgTemperature / maxTemp) * 100}%` }}
                                                            >
                                                                <span className="text-white text-sm font-bold">{batch.avgTemperature.toFixed(1)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 湿度对比 */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Droplets className="w-5 h-5 text-blue-500" />
                                            <span className="font-medium text-gray-700">平均湿度 (%)</span>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedBatchData.map((batch, index) => {
                                                const colors = getBatchColor(index);
                                                return (
                                                    <div key={batch.id} className="flex items-center gap-4">
                                                        <span className="w-32 text-sm font-medium text-gray-600 truncate">{batch.name}</span>
                                                        <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${colors.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                                                                style={{ width: `${(batch.avgHumidity / maxHumidity) * 100}%` }}
                                                            >
                                                                <span className="text-white text-sm font-bold">{batch.avgHumidity.toFixed(1)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 盐度对比 */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <FlaskConical className="w-5 h-5 text-teal-500" />
                                            <span className="font-medium text-gray-700">平均盐度 (ppt)</span>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedBatchData.map((batch, index) => {
                                                const colors = getBatchColor(index);
                                                return (
                                                    <div key={batch.id} className="flex items-center gap-4">
                                                        <span className="w-32 text-sm font-medium text-gray-600 truncate">{batch.name}</span>
                                                        <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${colors.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                                                                style={{ width: `${(batch.avgSalinity / maxSalinity) * 100}%` }}
                                                            >
                                                                <span className="text-white text-sm font-bold">{batch.avgSalinity.toFixed(1)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* pH值对比 */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Beaker className="w-5 h-5 text-purple-500" />
                                            <span className="font-medium text-gray-700">平均pH值</span>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedBatchData.map((batch, index) => {
                                                const colors = getBatchColor(index);
                                                return (
                                                    <div key={batch.id} className="flex items-center gap-4">
                                                        <span className="w-32 text-sm font-medium text-gray-600 truncate">{batch.name}</span>
                                                        <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${colors.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                                                                style={{ width: `${(batch.avgPh / maxPh) * 100}%` }}
                                                            >
                                                                <span className="text-white text-sm font-bold">{batch.avgPh.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 品质评分对比 */}
                            {selectedBatchData.some(b => b.qualityScore) && (
                                <div className="bg-white rounded-2xl shadow-lg p-6">
                                    <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                        <Star className="w-5 h-5 text-yellow-500" />
                                        品质评分对比
                                    </h3>
                                    <div className="space-y-4">
                                        {selectedBatchData.filter(b => b.qualityScore).map((batch, index) => {
                                            const colors = getBatchColor(index);
                                            return (
                                                <div key={batch.id} className="flex items-center gap-4">
                                                    <span className="w-32 text-sm font-medium text-gray-600 truncate">{batch.name}</span>
                                                    <div className="flex-1 h-10 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full bg-gradient-to-r ${colors.bar.replace('bg-', 'from-').replace('500', '400')} to-${colors.bar.includes('blue') ? 'cyan-500' : colors.bar.includes('green') ? 'emerald-500' : colors.bar.includes('orange') ? 'amber-500' : 'violet-500'} rounded-full transition-all duration-500 flex items-center justify-end pr-4`}
                                                            style={{ width: `${(batch.qualityScore! / maxScore) * 100}%` }}
                                                        >
                                                            <span className={`text-2xl font-bold ${getScoreColor(batch.qualityScore!)}`}>
                                                                {batch.qualityScore}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 批次详情卡片 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedBatchData.map((batch, index) => {
                                    const colors = getBatchColor(index);
                                    return (
                                        <div key={batch.id} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-t-4 ${colors.border}`}>
                                            <div className={`bg-gradient-to-r ${getStatusBg(batch.status)} p-4 text-white`}>
                                                <h4 className="font-bold text-lg">{batch.name}</h4>
                                                <p className="text-sm opacity-80">ID: {batch.id}</p>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 flex items-center gap-2">
                                                        <Thermometer className="w-4 h-4" /> 温度
                                                    </span>
                                                    <span className="font-semibold text-gray-800">{batch.avgTemperature.toFixed(1)}°C</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 flex items-center gap-2">
                                                        <Droplets className="w-4 h-4" /> 湿度
                                                    </span>
                                                    <span className="font-semibold text-gray-800">{batch.avgHumidity.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 flex items-center gap-2">
                                                        <FlaskConical className="w-4 h-4" /> 盐度
                                                    </span>
                                                    <span className="font-semibold text-gray-800">{batch.avgSalinity.toFixed(1)} ppt</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 flex items-center gap-2">
                                                        <Beaker className="w-4 h-4" /> pH值
                                                    </span>
                                                    <span className="font-semibold text-gray-800">{batch.avgPh.toFixed(2)}</span>
                                                </div>
                                                {batch.qualityScore && (
                                                    <div className="border-t pt-3 mt-3 flex items-center justify-between">
                                                        <span className="text-gray-500 flex items-center gap-2">
                                                            <Star className="w-4 h-4 text-yellow-500" /> 品质得分
                                                        </span>
                                                        <span className={`text-2xl font-bold ${getScoreColor(batch.qualityScore)}`}>
                                                            {batch.qualityScore}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
