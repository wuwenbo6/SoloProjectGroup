import { useState, useEffect } from 'react';
import { AlertTriangle, Search, HelpCircle, Wrench, Shield, ChevronDown, ChevronUp, FileQuestion } from 'lucide-react';

interface AnomalyAnalysis {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    possibleCauses: string[];
    solutions: string[];
    preventionMeasures: string[];
}

const alertTypes = [
    { id: 'temperature_high', name: '温度过高', icon: '🌡️' },
    { id: 'temperature_low', name: '温度过低', icon: '❄️' },
    { id: 'humidity_high', name: '湿度过高', icon: '💧' },
    { id: 'humidity_low', name: '湿度过低', icon: '🏜️' },
    { id: 'salinity_high', name: '盐度过高', icon: '🧂' },
    { id: 'salinity_low', name: '盐度过低', icon: '🧪' },
    { id: 'ph_high', name: 'pH值偏高', icon: '⚗️' },
    { id: 'ph_low', name: 'pH值偏低', icon: '🧬' },
];

export const Anomaly = () => {
    const [selectedType, setSelectedType] = useState('temperature_high');
    const [analysis, setAnalysis] = useState<AnomalyAnalysis | null>(null);
    const [expandedSections, setExpandedSections] = useState({ causes: true, solutions: true, prevention: true });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/ai/anomaly-analysis/${selectedType}`);
                const data = await res.json();
                setAnalysis(data);
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [selectedType]);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500';
            case 'warning': return 'bg-yellow-500';
            case 'info': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case 'critical': return 'from-red-400 to-rose-500';
            case 'warning': return 'from-yellow-400 to-orange-500';
            case 'info': return 'from-blue-400 to-cyan-500';
            default: return 'from-gray-400 to-gray-500';
        }
    };

    const getSeverityText = (severity: string) => {
        switch (severity) {
            case 'critical': return '严重';
            case 'warning': return '警告';
            case 'info': return '提示';
            default: return severity;
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section as keyof typeof prev] }));
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Search className="w-8 h-8 text-orange-500" />
                    异常原因分析
                </h1>
                <p className="text-gray-500 mt-1">智能诊断异常原因并提供专业解决方案</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 左侧异常类型选择 */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            选择异常类型
                        </h3>
                        <div className="space-y-2">
                            {alertTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                                        selectedType === type.id
                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    <span className="text-xl">{type.icon}</span>
                                    <span className="font-medium">{type.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧分析结果 */}
                <div className="lg:col-span-3 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                        </div>
                    ) : analysis ? (
                        <>
                            {/* 异常概览卡片 */}
                            <div className={`bg-gradient-to-r ${getSeverityBg(analysis.severity)} rounded-2xl shadow-lg p-6 text-white`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <AlertTriangle className="w-8 h-8" />
                                            <h2 className="text-2xl font-bold">{analysis.type}</h2>
                                        </div>
                                        <p className="text-white/80">异常诊断分析报告</p>
                                    </div>
                                    <div className="text-center">
                                        <div className={`px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm`}>
                                            <span className="font-bold text-lg">{getSeverityText(analysis.severity)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 可能原因 */}
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <button
                                    onClick={() => toggleSection('causes')}
                                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-100 rounded-lg">
                                            <HelpCircle className="w-6 h-6 text-orange-500" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-800">可能原因</h3>
                                            <p className="text-sm text-gray-500">分析导致该异常的潜在因素</p>
                                        </div>
                                    </div>
                                    {expandedSections.causes ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                                {expandedSections.causes && (
                                    <div className="px-6 pb-6 border-t">
                                        <ul className="space-y-3 pt-4">
                                            {analysis.possibleCauses.map((cause, index) => (
                                                <li key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
                                                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-gray-700">{cause}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* 解决方案 */}
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <button
                                    onClick={() => toggleSection('solutions')}
                                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <Wrench className="w-6 h-6 text-green-500" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-800">解决方案</h3>
                                            <p className="text-sm text-gray-500">推荐的解决步骤和方法</p>
                                        </div>
                                    </div>
                                    {expandedSections.solutions ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                                {expandedSections.solutions && (
                                    <div className="px-6 pb-6 border-t">
                                        <ul className="space-y-3 pt-4">
                                            {analysis.solutions.map((solution, index) => (
                                                <li key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                                                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        ✓
                                                    </div>
                                                    <span className="text-gray-700">{solution}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* 预防措施 */}
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <button
                                    onClick={() => toggleSection('prevention')}
                                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Shield className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-800">预防措施</h3>
                                            <p className="text-sm text-gray-500">避免类似问题再次发生的建议</p>
                                        </div>
                                    </div>
                                    {expandedSections.prevention ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                                {expandedSections.prevention && (
                                    <div className="px-6 pb-6 border-t">
                                        <ul className="space-y-3 pt-4">
                                            {analysis.preventionMeasures.map((measure, index) => (
                                                <li key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                                                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Shield className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-gray-700">{measure}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
