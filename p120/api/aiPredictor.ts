import db from './db';

export interface QualityPrediction {
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

export interface ParameterRecommendation {
    parameter: string;
    currentValue: number;
    recommendedValue: number;
    unit: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export interface AnomalyAnalysis {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    possibleCauses: string[];
    solutions: string[];
    preventionMeasures: string[];
}

export interface BatchData {
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

export const predictQuality = (sensorData: any): QualityPrediction => {
    const { temperature, humidity, salinity, ph } = sensorData;
    
    let score = 100;
    const factors: QualityPrediction['factors'] = [];

    if (temperature >= 24 && temperature <= 26) {
        factors.push({ name: '温度', impact: 'positive', description: '温度处于最佳发酵范围' });
    } else if (temperature >= 22 && temperature <= 28) {
        factors.push({ name: '温度', impact: 'neutral', description: '温度在正常范围内' });
        score -= 5;
    } else {
        factors.push({ name: '温度', impact: 'negative', description: '温度偏离最佳范围，可能影响发酵品质' });
        score -= 15;
    }

    if (humidity >= 55 && humidity <= 65) {
        factors.push({ name: '湿度', impact: 'positive', description: '湿度处于最佳范围' });
    } else if (humidity >= 45 && humidity <= 75) {
        factors.push({ name: '湿度', impact: 'neutral', description: '湿度在可接受范围内' });
        score -= 5;
    } else {
        factors.push({ name: '湿度', impact: 'negative', description: '湿度异常，可能导致杂菌滋生' });
        score -= 20;
    }

    if (salinity >= 28 && salinity <= 32) {
        factors.push({ name: '盐度', impact: 'positive', description: '盐度适中，有利于风味形成' });
    } else if (salinity >= 25 && salinity <= 35) {
        factors.push({ name: '盐度', impact: 'neutral', description: '盐度在正常范围内' });
        score -= 8;
    } else {
        factors.push({ name: '盐度', impact: 'negative', description: '盐度异常，可能影响口感和保质期' });
        score -= 18;
    }

    if (ph >= 6.8 && ph <= 7.2) {
        factors.push({ name: 'pH值', impact: 'positive', description: '酸碱度处于最佳状态' });
    } else if (ph >= 6.5 && ph <= 7.5) {
        factors.push({ name: 'pH值', impact: 'neutral', description: '酸碱度在正常范围内' });
        score -= 5;
    } else {
        factors.push({ name: 'pH值', impact: 'negative', description: '酸碱度异常，可能影响发酵进程' });
        score -= 15;
    }

    let level: QualityPrediction['level'];
    if (score >= 90) level = 'excellent';
    else if (score >= 75) level = 'good';
    else if (score >= 60) level = 'normal';
    else level = 'poor';

    const estimatedDays = Math.round(5 + (100 - score) / 10);
    const confidence = 75 + Math.random() * 20;

    return { score, level, confidence, factors, estimatedDays };
};

export const getParameterRecommendations = (sensorData: any): ParameterRecommendation[] => {
    const recommendations: ParameterRecommendation[] = [];
    const { temperature, humidity, salinity, ph } = sensorData;

    if (temperature < 24) {
        recommendations.push({
            parameter: '温度',
            currentValue: temperature,
            recommendedValue: 25,
            unit: '°C',
            reason: '当前温度偏低，适当提高可加速发酵进程',
            priority: temperature < 22 ? 'high' : 'medium'
        });
    } else if (temperature > 26) {
        recommendations.push({
            parameter: '温度',
            currentValue: temperature,
            recommendedValue: 25,
            unit: '°C',
            reason: '当前温度偏高，适当降低可防止过度发酵',
            priority: temperature > 28 ? 'high' : 'medium'
        });
    }

    if (humidity < 55) {
        recommendations.push({
            parameter: '湿度',
            currentValue: humidity,
            recommendedValue: 60,
            unit: '%',
            reason: '当前湿度偏低，建议增加环境湿度',
            priority: humidity < 50 ? 'high' : 'medium'
        });
    } else if (humidity > 65) {
        recommendations.push({
            parameter: '湿度',
            currentValue: humidity,
            recommendedValue: 60,
            unit: '%',
            reason: '当前湿度偏高，建议降低以防止霉菌生长',
            priority: humidity > 70 ? 'high' : 'medium'
        });
    }

    if (salinity < 28) {
        recommendations.push({
            parameter: '盐度',
            currentValue: salinity,
            recommendedValue: 30,
            unit: 'ppt',
            reason: '当前盐度偏低，可适当补充盐分以提升风味',
            priority: salinity < 26 ? 'high' : 'medium'
        });
    } else if (salinity > 32) {
        recommendations.push({
            parameter: '盐度',
            currentValue: salinity,
            recommendedValue: 30,
            unit: 'ppt',
            reason: '当前盐度偏高，可稀释以避免过咸',
            priority: salinity > 34 ? 'high' : 'medium'
        });
    }

    if (ph < 6.8) {
        recommendations.push({
            parameter: 'pH值',
            currentValue: ph,
            recommendedValue: 7.0,
            unit: '',
            reason: '当前pH偏低，可添加少量碱性物质调节',
            priority: ph < 6.6 ? 'high' : 'medium'
        });
    } else if (ph > 7.2) {
        recommendations.push({
            parameter: 'pH值',
            currentValue: ph,
            recommendedValue: 7.0,
            unit: '',
            reason: '当前pH偏高，可添加少量酸性物质调节',
            priority: ph > 7.4 ? 'high' : 'medium'
        });
    }

    return recommendations;
};

export const analyzeAnomaly = (sensorData: any, alertType: string): AnomalyAnalysis => {
    const analyses: Record<string, AnomalyAnalysis> = {
        temperature_high: {
            type: '温度过高',
            severity: 'warning',
            possibleCauses: [
                '环境温度升高',
                '发酵产热未及时散发',
                '温控系统故障',
                '阳光直射导致升温'
            ],
            solutions: [
                '开启冷却系统降温',
                '增加通风量',
                '检查温控设备是否正常',
                '转移至阴凉处'
            ],
            preventionMeasures: [
                '定期校准温控设备',
                '安装温度报警系统',
                '保持环境通风良好',
                '避免阳光直射发酵区'
            ]
        },
        temperature_low: {
            type: '温度过低',
            severity: 'warning',
            possibleCauses: [
                '环境温度下降',
                '加热系统故障',
                '冷空气侵入'
            ],
            solutions: [
                '启动加热系统',
                '检查加热设备',
                '加强保温措施'
            ],
            preventionMeasures: [
                '做好环境保温',
                '定期检查加热系统',
                '设置低温报警阈值'
            ]
        },
        humidity_high: {
            type: '湿度过高',
            severity: 'critical',
            possibleCauses: [
                '通风不良',
                '环境湿度大',
                '冷凝水回流',
                '杂菌污染风险'
            ],
            solutions: [
                '加强通风排湿',
                '开启除湿设备',
                '检查是否有霉菌生长',
                '清洁消毒发酵容器'
            ],
            preventionMeasures: [
                '保持良好通风',
                '控制环境湿度',
                '定期消毒杀菌',
                '使用防霉材料'
            ]
        },
        humidity_low: {
            type: '湿度过低',
            severity: 'warning',
            possibleCauses: [
                '环境干燥',
                '通风过度',
                '密封不良'
            ],
            solutions: [
                '使用加湿器增湿',
                '减少通风量',
                '检查密封情况'
            ],
            preventionMeasures: [
                '安装湿度监测系统',
                '保持适当通风',
                '确保容器密封良好'
            ]
        },
        salinity_high: {
            type: '盐度过高',
            severity: 'warning',
            possibleCauses: [
                '加盐量过多',
                '水分蒸发浓缩',
                '测量误差'
            ],
            solutions: [
                '添加适量清水稀释',
                '部分替换发酵液',
                '校准测量设备'
            ],
            preventionMeasures: [
                '严格按配方加盐',
                '定期检测盐度',
                '防止水分过度蒸发'
            ]
        },
        salinity_low: {
            type: '盐度过低',
            severity: 'warning',
            possibleCauses: [
                '加盐量不足',
                '加水稀释过多',
                '渗透作用'
            ],
            solutions: [
                '补充适量食盐',
                '调整发酵液浓度'
            ],
            preventionMeasures: [
                '准确计算用盐量',
                '发酵初期定期检测盐度'
            ]
        },
        ph_high: {
            type: 'pH值偏高',
            severity: 'warning',
            possibleCauses: [
                '碱性物质污染',
                '发酵进程异常',
                '测量设备误差'
            ],
            solutions: [
                '添加适量食用酸调节',
                '检查是否有杂菌污染',
                '校准pH计'
            ],
            preventionMeasures: [
                '使用洁净容器和工具',
                '定期校准pH计',
                '每日监测pH变化'
            ]
        },
        ph_low: {
            type: 'pH值偏低',
            severity: 'warning',
            possibleCauses: [
                '产酸过多',
                '发酵过度',
                '杂菌产生酸性物质'
            ],
            solutions: [
                '添加适量碱性物质调节',
                '检查是否有异味异色',
                '考虑提前终止发酵'
            ],
            preventionMeasures: [
                '控制发酵温度和时间',
                '监测pH变化趋势',
                '保持环境卫生'
            ]
        }
    };

    return analyses[alertType] || {
        type: '未知异常',
        severity: 'info',
        possibleCauses: ['需要进一步分析'],
        solutions: ['联系技术支持'],
        preventionMeasures: ['加强日常监测']
    };
};

export const getBatchData = (): BatchData[] => {
    const batches: BatchData[] = [
        {
            id: 'BATCH-001',
            name: '批次A-传统酱菜',
            startTime: '2024-05-01T08:00:00Z',
            endTime: '2024-05-08T16:00:00Z',
            status: 'completed',
            avgTemperature: 25.2,
            avgHumidity: 62,
            avgSalinity: 30.5,
            avgPh: 7.0,
            qualityScore: 92
        },
        {
            id: 'BATCH-002',
            name: '批次B-香辣酱菜',
            startTime: '2024-05-05T10:00:00Z',
            endTime: '2024-05-12T18:00:00Z',
            status: 'completed',
            avgTemperature: 24.8,
            avgHumidity: 58,
            avgSalinity: 31.2,
            avgPh: 6.9,
            qualityScore: 88
        },
        {
            id: 'BATCH-003',
            name: '批次C-低盐酱菜',
            startTime: '2024-05-10T09:00:00Z',
            status: 'fermenting',
            avgTemperature: 25.5,
            avgHumidity: 60,
            avgSalinity: 26.8,
            avgPh: 7.1
        },
        {
            id: 'BATCH-004',
            name: '批次D-甜味酱菜',
            startTime: '2024-05-12T07:00:00Z',
            status: 'fermenting',
            avgTemperature: 26.1,
            avgHumidity: 65,
            avgSalinity: 28.5,
            avgPh: 6.8
        },
        {
            id: 'BATCH-005',
            name: '批次E-测试批次',
            startTime: '2024-04-20T08:00:00Z',
            endTime: '2024-04-25T12:00:00Z',
            status: 'failed',
            avgTemperature: 29.5,
            avgHumidity: 75,
            avgSalinity: 35.2,
            avgPh: 5.8,
            qualityScore: 45
        }
    ];

    return batches;
};
