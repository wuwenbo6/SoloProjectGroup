import { useEffect, useState } from 'react';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Clock, Star, CheckCircle, XCircle, Zap, Target } from 'lucide-react';

interface QualityPrediction {
    score: number;
    level: 'excellent' | 'good' | 'normal' | 'poor';
    confidence: number;
    factors: {
        name: string;
        impact: 'positive' | 'negative' | 'neutral';
        description: string;
    }[];
    estimatedDays: number;
}

interface ParameterRecommendation {
    parameter: string;
    currentValue: number;
    recommendedValue: number;
    unit: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export const Analytics = () => {
    const [prediction, setPrediction] = useState<QualityPrediction | null>(null);
    const [recommendations, setRecommendations] = useState<ParameterRecommendation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [predRes, recRes] = await Promise.all([
                    fetch('/api/ai/quality-prediction'),
                    fetch('/api/ai/parameter-recommendations')
                ]);
                
                const predData = await predRes.json();
                const recData = await recRes.json();
                
                setPrediction(predData);
                setRecommendations(recData);
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'excellent': return 'text-green-600';
            case 'good': return 'text-blue-600';
            case 'normal': return 'text-yellow-600';
            case 'poor': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getLevelBg = (level: string) => {
        switch (level) {
            case 'excellent': return 'from-green-400 to-emerald-500';
            case 'good': return 'from-blue-400 to-cyan-500';
            case 'normal': return 'from-yellow-400 to-amber-500';
            case 'poor': return 'from-red-400 to-rose-500';
            default: return 'from-gray-400 to-gray-500';
        }
    };

    const getLevelText = (level: string) => {
        switch (level) {
            case 'excellent': return '优秀';
            case 'good': return '良好';
            case 'normal': return '一般';
            case 'poor': return '较差';
            default: return '未知';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getPriorityText = (priority: string) => {
        switch (priority) {
            case 'high': return '高优先级';
            case 'medium': return '中优先级';
            case 'low': return '低优先级';
            default: return priority;
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    <p className="text-gray-500">正在进行智能分析...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Brain className="w-8 h-8 text-blue-500" />
                    智能分析中心
                </h1>
                <p className="text-gray-500 mt-1">基于AI算法的酱菜品质预测与发酵优化建议</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 品质预测卡片 */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className={`bg-gradient-to-r ${getLevelBg(prediction?.level || 'normal')} p-6 text-white`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-6 h-6" />
                                    <span className="text-lg font-semibold">酱菜品质预测</span>
                                </div>
                                <p className="text-white/80 text-sm">基于实时传感器数据分析</p>
                            </div>
                            <div className="text-right">
                                <div className="text-5xl font-bold">{prediction?.score || 0}</div>
                                <p className="text-sm opacity-80">预测得分</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">品质等级</span>
                            <span className={`text-2xl font-bold ${getLevelColor(prediction?.level || 'normal')}`}>
                                {getLevelText(prediction?.level || 'normal')}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">预测置信度</span>
                            <div className="flex items-center gap-2">
                                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${prediction?.confidence || 0}%` }}
                                    />
                                </div>
                                <span className="font-semibold text-blue-600">{prediction?.confidence.toFixed(1)}%</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">预计发酵完成</span>
                            <div className="flex items-center gap-2 text-blue-600">
                                <Clock className="w-5 h-5" />
                                <span className="font-semibold">约 {prediction?.estimatedDays || 0} 天</span>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Star className="w-5 h-5 text-yellow-500" />
                                影响因素分析
                            </h3>
                            <div className="space-y-3">
                                {prediction?.factors.map((factor, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                        {factor.impact === 'positive' ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        ) : factor.impact === 'negative' ? (
                                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <div className="w-5 h-5 bg-gray-400 rounded-full flex-shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <span className="font-medium text-gray-800">{factor.name}</span>
                                            <p className="text-sm text-gray-600">{factor.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 参数推荐卡片 */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-6 h-6" />
                            <span className="text-lg font-semibold">发酵参数推荐</span>
                        </div>
                        <p className="text-white/80 text-sm">AI智能优化建议，提升发酵品质</p>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {recommendations.length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                <p className="text-gray-600">当前参数均在最佳范围内，无需调整</p>
                            </div>
                        ) : (
                            recommendations.map((rec, index) => (
                                <div key={index} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Zap className={`w-5 h-5 ${rec.priority === 'high' ? 'text-red-500' : rec.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'}`} />
                                            <span className="font-semibold text-gray-800">{rec.parameter}调整</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(rec.priority)}`}>
                                            {getPriorityText(rec.priority)}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4 mb-3">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500">当前值</p>
                                            <p className="text-lg font-bold text-gray-800">{rec.currentValue.toFixed(1)}{rec.unit}</p>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="w-8 h-0.5 bg-gray-300" />
                                            <TrendingUp className={`w-5 h-5 mx-1 ${rec.currentValue < rec.recommendedValue ? 'text-green-500' : 'text-red-500'}`} />
                                            <div className="w-8 h-0.5 bg-gray-300" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500">建议值</p>
                                            <p className="text-lg font-bold text-blue-600">{rec.recommendedValue}{rec.unit}</p>
                                        </div>
                                    </div>
                                    
                                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                                        💡 {rec.reason}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
