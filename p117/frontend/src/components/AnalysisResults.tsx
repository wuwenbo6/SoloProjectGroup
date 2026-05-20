import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface AnalysisResultsProps {
  data: any
}

function AnalysisResults({ data }: AnalysisResultsProps) {
  const orientationData = data.orientation?.fiber_count_by_orientation?.map((item: any) => ({
    name: item.angle,
    count: item.count
  })) || []

  const featureContributions = data.durability?.feature_contributions ? [
    { name: '纤维密度', value: (data.durability.feature_contributions.fiber_density_score || 0) * 100 },
    { name: '排列对齐', value: (data.durability.feature_contributions.fiber_alignment_score || 0) * 100 },
    { name: '抗老化性', value: (data.durability.feature_contributions.aging_resistance_score || 0) * 100 },
    { name: '纤维强度', value: (data.durability.feature_contributions.fiber_strength_score || 0) * 100 },
    { name: '抗损伤性', value: (data.durability.feature_contributions.damage_resistance_score || 0) * 100 }
  ] : []

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']

  const getDurabilityColor = (level: string) => {
    switch (level) {
      case 'Excellent': return 'text-green-600 bg-green-100'
      case 'Good': return 'text-blue-600 bg-blue-100'
      case 'Moderate': return 'text-yellow-600 bg-yellow-100'
      case 'Poor': return 'text-orange-600 bg-orange-100'
      case 'Critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDurabilityText = (level: string) => {
    switch (level) {
      case 'Excellent': return '优秀'
      case 'Good': return '良好'
      case 'Moderate': return '一般'
      case 'Poor': return '较差'
      case 'Critical': return '危急'
      default: return level
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🔬</span> 纤维分割结果
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">纤维数量</p>
              <p className="text-2xl font-bold text-purple-600">
                {data.segmentation?.fiber_count || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">纤维密度</p>
              <p className="text-2xl font-bold text-purple-600">
                {((data.segmentation?.fiber_density || 0) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">平均长度</p>
              <p className="text-2xl font-bold text-purple-600">
                {(data.segmentation?.average_length || 0).toFixed(2)} px
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">平均宽度</p>
              <p className="text-2xl font-bold text-purple-600">
                {(data.segmentation?.average_width || 0).toFixed(2)} px
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">📊</span> 老化等级评估
          </h3>
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">老化等级</p>
                <p className="text-3xl font-bold text-blue-600">
                  Grade {data.aging_level?.level || 1}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">置信度</p>
                <p className="text-2xl font-bold text-blue-600">
                  {((data.aging_level?.confidence || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-gray-600 mt-2">{data.aging_level?.level_description}</p>
            <div className="mt-3 bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-500"
                style={{ width: `${(data.aging_level?.score || 0) * 20}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">老化评分: {(data.aging_level?.score || 0).toFixed(2)}/5</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 card-shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">🧭</span> 纤维方向分布
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orientationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">主导方向</p>
              <p className="text-xl font-bold text-purple-600">
                {data.orientation?.dominant_orientation || 'N/A'}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">排列对齐度</p>
              <p className="text-xl font-bold text-blue-600">
                {((data.orientation?.alignment_score || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">方向均匀性</p>
              <p className="text-xl font-bold text-green-600">
                {((data.orientation?.orientation_uniformity || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 card-shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">⚡</span> 耐久性预测
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className={`rounded-lg p-6 text-center ${getDurabilityColor(data.durability?.durability_level)}`}>
              <p className="text-sm mb-2">耐久性等级</p>
              <p className="text-3xl font-bold">{getDurabilityText(data.durability?.durability_level)}</p>
            </div>
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">耐久性评分</span>
                <span className="font-bold">{((data.durability?.durability_score || 0) * 100).toFixed(0)}/100</span>
              </div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-full"
                  style={{ width: `${(data.durability?.durability_score || 0) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">预估剩余寿命</p>
              <p className="text-2xl font-bold text-blue-600">
                {(data.durability?.lifespan_prediction?.estimated_years || 0).toFixed(1)} 年
              </p>
              <p className="text-xs text-gray-500 mt-1">
                置信度: {((data.durability?.lifespan_prediction?.confidence || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <p className="text-sm font-medium text-gray-700 mb-3">特征贡献雷达图</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={featureContributions}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    name="贡献度"
                    dataKey="value"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-1">
            <p className="text-sm font-medium text-gray-700 mb-3">风险提示</p>
            {data.durability?.failure_risks?.length > 0 ? (
              <div className="space-y-2">
                {data.durability.failure_risks.map((risk: any, idx: number) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-medium text-red-700">{risk.description}</p>
                    <p className="text-xs text-red-500 mt-1">概率: {(risk.probability * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700">✅ 未检测到明显风险</p>
              </div>
            )}
          </div>
        </div>
        
        {data.durability?.recommendations?.length > 0 && (
          <div className="mt-6 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <p className="font-medium text-yellow-800 mb-2">💡 建议</p>
            <ul className="space-y-1">
              {data.durability.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-yellow-700">• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 card-shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">🔍</span> 纸张溯源分析
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">匹配状态</p>
                  <p className={`text-xl font-bold ${data.tracing?.match_found ? 'text-green-600' : 'text-gray-600'}`}>
                    {data.tracing?.match_found ? '匹配成功' : '未找到匹配'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">最佳匹配度</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {((data.tracing?.best_match?.similarity_score || data.tracing?.similarity_score || 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            
            {data.tracing?.possible_origins?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">可能的来源</p>
                <div className="space-y-2">
                  {data.tracing.possible_origins.map((origin: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{origin.origin?.manufacturer || '未知厂商'}</p>
                        <p className="text-xs text-gray-500">{origin.sample_id}</p>
                      </div>
                      <span className="text-sm font-medium text-purple-600">
                        {(origin.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {data.tracing?.recommendation && (
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                ℹ️ {data.tracing.recommendation}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">指纹特征</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">纹理均值</p>
                <p className="text-lg font-bold text-gray-700">
                  {(data.fingerprint?.texture?.mean_intensity || 0).toFixed(1)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">纹理标准差</p>
                <p className="text-lg font-bold text-gray-700">
                  {(data.fingerprint?.texture?.std_intensity || 0).toFixed(1)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">纹理熵</p>
                <p className="text-lg font-bold text-gray-700">
                  {(data.fingerprint?.texture?.entropy || 0).toFixed(3)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">纹理偏度</p>
                <p className="text-lg font-bold text-gray-700">
                  {(data.fingerprint?.texture?.skewness || 0).toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 card-shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">⚠️</span> 破损风险评估
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-center mb-4">
              <div className={`inline-block px-6 py-3 rounded-lg font-semibold text-lg ${
                data.damage_prediction?.overall_risk_level === 'low' ? 'risk-low' :
                data.damage_prediction?.overall_risk_level === 'medium' ? 'risk-medium' :
                data.damage_prediction?.overall_risk_level === 'high' ? 'risk-high' : 'risk-critical'
              }`}>
                总体风险: {data.damage_prediction?.overall_risk_level === 'low' ? '低' : 
                           data.damage_prediction?.overall_risk_level === 'medium' ? '中' :
                           data.damage_prediction?.overall_risk_level === 'high' ? '高' : '极高'}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: '裂纹风险', value: (data.damage_prediction?.risk_assessment?.crack_risk || 0) * 100 },
                      { name: '空洞风险', value: (data.damage_prediction?.risk_assessment?.void_risk || 0) * 100 },
                      { name: '断裂风险', value: (data.damage_prediction?.risk_assessment?.breakage_risk || 0) * 100 },
                      { name: '降解风险', value: (data.damage_prediction?.risk_assessment?.degradation_risk || 0) * 100 },
                      { name: '分层风险', value: (data.damage_prediction?.risk_assessment?.delamination_risk || 0) * 100 },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-3">检测到的问题</h4>
            {data.damage_prediction?.predictions?.length > 0 ? (
              <div className="space-y-3">
                {data.damage_prediction.predictions.map((pred: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">
                        {pred.type_description}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pred.severity === 'high' ? 'bg-red-100 text-red-700' :
                        pred.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        严重程度: {pred.severity === 'high' ? '高' : pred.severity === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm text-gray-500 mb-1">
                        <span>发生概率</span>
                        <span>{(pred.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            pred.probability > 0.6 ? 'bg-red-500' :
                            pred.probability > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${pred.probability * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">💡 {pred.recommendation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg p-6 text-center">
                <p className="text-green-600 font-medium">✅ 未检测到明显破损风险</p>
                <p className="text-sm text-green-500 mt-1">材料状态良好，请继续保持监测</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-500 flex justify-between items-center">
        <div>
          🕒 分析时间: {new Date(data.timestamp).toLocaleString('zh-CN')}
          <span className="mx-2">|</span>
          🔍 文件ID: {data.file_id?.substring(0, 8)}...
        </div>
        <span className="text-xs text-gray-400">
          分析系统 v1.1.0
        </span>
      </div>
    </div>
  )
}

export default AnalysisResults
