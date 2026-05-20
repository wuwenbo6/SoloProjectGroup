import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Leaf, ClipboardList, Microscope, Package, TrendingUp } from 'lucide-react';
import { materialAPI, collectionAPI, inspectionAPI, batchAPI } from '../services/api';

interface Stats {
  materials: number;
  collections: number;
  inspections: number;
  batches: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    materials: 0,
    collections: 0,
    inspections: 0,
    batches: 0,
  });
  const [collectionStats, setCollectionStats] = useState<any>(null);
  const [inspectionStats, setInspectionStats] = useState<any>(null);
  const [batchStats, setBatchStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [materialsRes, collectionsRes, inspectionRes, batchRes] = await Promise.all([
        materialAPI.getAll({ pageSize: 1 }),
        collectionAPI.getStatistics(),
        inspectionAPI.getStatistics(),
        batchAPI.getStatistics(),
      ]);

      setStats({
        materials: materialsRes.data.data.total || 0,
        collections: collectionsRes.data.data.total || 0,
        inspections: inspectionRes.data.data.total || 0,
        batches: batchRes.data.data.total || 0,
      });

      setCollectionStats(collectionsRes.data.data);
      setInspectionStats(inspectionRes.data.data);
      setBatchStats(batchRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const statCards = [
    {
      title: '原料种类',
      value: stats.materials,
      icon: Leaf,
      color: 'bg-bamboo-500',
      trend: '+5%',
    },
    {
      title: '采集记录',
      value: stats.collections,
      icon: ClipboardList,
      color: 'bg-primary-500',
      trend: '+12%',
    },
    {
      title: '检测报告',
      value: stats.inspections,
      icon: Microscope,
      color: 'bg-gold-500',
      trend: '+8%',
    },
    {
      title: '生产批次',
      value: stats.batches,
      icon: Package,
      color: 'bg-blue-500',
      trend: '+15%',
    },
  ];

  const collectionChartData = [
    { name: '待同步', value: collectionStats?.pending || 0, color: '#f59e0b' },
    { name: '已同步', value: collectionStats?.synced || 0, color: '#10b981' },
  ];

  const inspectionChartData = [
    { name: '通过', value: inspectionStats?.pass || 0, color: '#10b981' },
    { name: '失败', value: inspectionStats?.fail || 0, color: '#ef4444' },
    { name: '待检', value: inspectionStats?.pending || 0, color: '#f59e0b' },
  ];

  const monthlyData = [
    { month: '1月', collections: 45, inspections: 38 },
    { month: '2月', collections: 52, inspections: 47 },
    { month: '3月', collections: 48, inspections: 42 },
    { month: '4月', collections: 61, inspections: 55 },
    { month: '5月', collections: 55, inspections: 50 },
    { month: '6月', collections: 67, inspections: 62 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">数据仪表盘</h1>
        <p className="text-primary-600">实时监控原料溯源全链路数据</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-sm mb-1">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-800">{card.value}</p>
                  <div className="flex items-center gap-1 mt-2 text-bamboo-600">
                    <TrendingUp size={14} />
                    <span className="text-sm font-medium">{card.trend}</span>
                  </div>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">月度数据趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="collections" fill="#815e42" name="采集记录" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inspections" fill="#428c55" name="检测报告" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">采集同步状态</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={collectionChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {collectionChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">检测结果分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={inspectionChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {inspectionChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">批次状态统计</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">生产中</span>
                <span className="text-sm font-medium text-primary-600">{batchStats?.producing || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full"
                  style={{ width: `${((batchStats?.producing || 0) / (batchStats?.total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">已完成</span>
                <span className="text-sm font-medium text-bamboo-600">{batchStats?.completed || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-bamboo-500 h-2 rounded-full"
                  style={{ width: `${((batchStats?.completed || 0) / (batchStats?.total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">已发货</span>
                <span className="text-sm font-medium text-gold-600">{batchStats?.shipped || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gold-500 h-2 rounded-full"
                  style={{ width: `${((batchStats?.shipped || 0) / (batchStats?.total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
