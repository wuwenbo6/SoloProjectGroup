import { useEffect, useState } from 'react';
import { Plus, Search, Edit, RefreshCw, MapPin, Calendar } from 'lucide-react';
import { collectionAPI, materialAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';

interface Collection {
  id: string;
  materialId: string;
  materialName: string;
  collectorId: string;
  collectionTime: string;
  location: string;
  quantity: number;
  unit: string;
  weather?: string;
  notes?: string;
  syncStatus: string;
  createdAt: string;
}

interface Material {
  id: string;
  name: string;
}

const Collection = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState({
    materialId: '',
    collectionTime: '',
    location: '',
    quantity: '',
    unit: 'kg',
    weather: '',
    notes: '',
  });

  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'collector' || user?.role === 'material_manager';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [collectionsRes, materialsRes] = await Promise.all([
        collectionAPI.getAll({ pageSize: 100 }),
        materialAPI.getAll({ pageSize: 100 }),
      ]);
      setCollections(collectionsRes.data.data.list || []);
      setMaterials(materialsRes.data.data.list || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        quantity: parseFloat(formData.quantity),
      };

      if (editingCollection) {
        await collectionAPI.update(editingCollection.id, data);
      } else {
        await collectionAPI.create(data);
      }

      setShowModal(false);
      setEditingCollection(null);
      setFormData({
        materialId: '',
        collectionTime: '',
        location: '',
        quantity: '',
        unit: 'kg',
        weather: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Failed to save collection:', error);
    }
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({
      materialId: collection.materialId,
      collectionTime: dayjs(collection.collectionTime).format('YYYY-MM-DDTHH:mm'),
      location: collection.location,
      quantity: collection.quantity.toString(),
      unit: collection.unit,
      weather: collection.weather || '',
      notes: collection.notes || '',
    });
    setShowModal(true);
  };

  const handleSync = async (ids: string[]) => {
    try {
      await collectionAPI.sync(ids);
      loadData();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const getMaterialName = (materialId: string) => {
    return materials.find((m) => m.id === materialId)?.name || materialId;
  };

  const filteredCollections = collections.filter(
    (c) =>
      getMaterialName(c.materialId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = filteredCollections.filter((c) => c.syncStatus === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">采集管理</h1>
          <p className="text-primary-600">记录和管理原料采集数据</p>
        </div>
        <div className="flex gap-3">
          {canEdit && pendingCount > 0 && (
            <button
              onClick={() =>
                handleSync(filteredCollections.filter((c) => c.syncStatus === 'pending').map((c) => c.id))
              }
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors shadow-lg"
            >
              <RefreshCw size={20} />
              全部同步 ({pendingCount})
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => {
                setEditingCollection(null);
                setFormData({
                  materialId: '',
                  collectionTime: '',
                  location: '',
                  quantity: '',
                  unit: 'kg',
                  weather: '',
                  notes: '',
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-bamboo-500 text-white px-4 py-2 rounded-lg hover:bg-bamboo-600 transition-colors shadow-lg"
            >
              <Plus size={20} />
              新增采集
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜索原料名称、采集地点..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-gray-700"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">原料名称</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">采集时间</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">采集地点</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">数量</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">天气</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">同步状态</th>
              {canEdit && (
                <th className="px-6 py-4 text-right text-sm font-semibold text-primary-700">操作</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  加载中...
                </td>
              </tr>
            ) : filteredCollections.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  暂无采集数据
                </td>
              </tr>
            ) : (
              filteredCollections.map((collection) => (
                <tr key={collection.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">
                      {getMaterialName(collection.materialId)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={16} />
                      {dayjs(collection.collectionTime).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} />
                      {collection.location}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">
                      {collection.quantity} {collection.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{collection.weather || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        collection.syncStatus === 'synced'
                          ? 'bg-green-100 text-green-700'
                          : collection.syncStatus === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {collection.syncStatus === 'synced' ? '已同步' : collection.syncStatus === 'failed' ? '同步失败' : '待同步'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(collection)}
                        className="text-primary-600 hover:text-primary-800 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingCollection ? '编辑采集记录' : '新增采集记录'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原料 *</label>
                <select
                  value={formData.materialId}
                  onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">请选择原料</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">采集时间 *</label>
                <input
                  type="datetime-local"
                  value={formData.collectionTime}
                  onChange={(e) => setFormData({ ...formData, collectionTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">采集地点 *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="如：安徽省泾县丁家桥镇"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量 *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单位 *</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  >
                    <option value="kg">千克 (kg)</option>
                    <option value="g">克 (g)</option>
                    <option value="ton">吨 (ton)</option>
                    <option value="bundle">捆</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">天气情况</label>
                <input
                  type="text"
                  value={formData.weather}
                  onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="如：晴朗、多云、小雨..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCollection(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-bamboo-500 text-white rounded-lg hover:bg-bamboo-600 transition-colors"
                >
                  {editingCollection ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
