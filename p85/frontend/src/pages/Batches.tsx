import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Search as SearchIcon, Package, Calendar } from 'lucide-react';
import { batchAPI, materialAPI, collectionAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';

interface Batch {
  id: string;
  batchNo: string;
  materialId: string;
  materialName: string;
  collectionIds: string[];
  productionDate: string;
  quantity: number;
  unit: string;
  status: string;
  createdAt: string;
}

interface Material {
  id: string;
  name: string;
}

interface CollectionItem {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
}

const Batches = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [traceBatchNo, setTraceBatchNo] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({
    batchNo: '',
    materialId: '',
    collectionIds: [] as string[],
    productionDate: '',
    quantity: '',
    unit: 'kg',
    status: 'producing',
  });

  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'batch_manager';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [batchesRes, materialsRes, collectionsRes] = await Promise.all([
        batchAPI.getAll({ pageSize: 100 }),
        materialAPI.getAll({ pageSize: 100 }),
        collectionAPI.getAll({ pageSize: 100 }),
      ]);
      setBatches(batchesRes.data.data.list || []);
      setMaterials(materialsRes.data.data.list || []);
      setCollections(collectionsRes.data.data.list || []);
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

      if (editingBatch) {
        await batchAPI.update(editingBatch.id, data);
      } else {
        await batchAPI.create(data);
      }

      setShowModal(false);
      setEditingBatch(null);
      setFormData({
        batchNo: '',
        materialId: '',
        collectionIds: [],
        productionDate: '',
        quantity: '',
        unit: 'kg',
        status: 'producing',
      });
      loadData();
    } catch (error) {
      console.error('Failed to save batch:', error);
    }
  };

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setFormData({
      batchNo: batch.batchNo,
      materialId: batch.materialId,
      collectionIds: batch.collectionIds || [],
      productionDate: dayjs(batch.productionDate).format('YYYY-MM-DD'),
      quantity: batch.quantity.toString(),
      unit: batch.unit,
      status: batch.status,
    });
    setShowModal(true);
  };

  const handleTrace = async () => {
    if (!traceBatchNo.trim()) return;
    try {
      const response = await batchAPI.getTrace(traceBatchNo);
      setTraceResult(response.data.data);
    } catch (error) {
      console.error('Failed to trace batch:', error);
    }
  };

  const getMaterialName = (materialId: string) => {
    return materials.find((m) => m.id === materialId)?.name || materialId;
  };

  const filteredBatches = batches.filter(
    (b) =>
      b.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getMaterialName(b.materialId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">批次管理</h1>
          <p className="text-primary-600">管理生产批次和全链路溯源</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingBatch(null);
              setFormData({
                batchNo: '',
                materialId: '',
                collectionIds: [],
                productionDate: '',
                quantity: '',
                unit: 'kg',
                status: 'producing',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-bamboo-500 text-white px-4 py-2 rounded-lg hover:bg-bamboo-600 transition-colors shadow-lg"
          >
            <Plus size={20} />
            新增批次
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">批次溯源查询</h3>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="输入批次号进行全链路溯源查询..."
              value={traceBatchNo}
              onChange={(e) => setTraceBatchNo(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleTrace()}
            />
          </div>
          <button
            onClick={handleTrace}
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors font-medium"
          >
            查询溯源
          </button>
        </div>

        {traceResult && (
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <h4 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
              <Package size={20} />
              批次 {traceResult.batchNo} - 全链路溯源信息
            </h4>
            
            {traceResult.material && (
              <div className="mb-6">
                <h5 className="font-medium text-gray-700 mb-2">📦 原料信息</h5>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <p><span className="text-gray-500">原料名称：</span>{traceResult.material.name}</p>
                    <p><span className="text-gray-500">产地：</span>{traceResult.material.origin}</p>
                    <p><span className="text-gray-500">分类：</span>{traceResult.material.category}</p>
                    <p><span className="text-gray-500">录入时间：</span>{dayjs(traceResult.material.createdAt).format('YYYY-MM-DD HH:mm')}</p>
                  </div>
                </div>
              </div>
            )}

            {traceResult.collections && traceResult.collections.length > 0 && (
              <div className="mb-6">
                <h5 className="font-medium text-gray-700 mb-2">🌿 采集记录</h5>
                <div className="space-y-3">
                  {traceResult.collections.map((col: any, idx: number) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <p><span className="text-gray-500">采集人员：</span>{col.collectorName}</p>
                        <p><span className="text-gray-500">采集地点：</span>{col.location}</p>
                        <p><span className="text-gray-500">采集数量：</span>{col.quantity} {col.unit}</p>
                        <p><span className="text-gray-500">采集时间：</span>{dayjs(col.collectionDate).format('YYYY-MM-DD HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {traceResult.inspections && traceResult.inspections.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-700 mb-2">🔬 检测记录</h5>
                <div className="space-y-3">
                  {traceResult.inspections.map((ins: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border ${ins.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="grid grid-cols-2 gap-4">
                        <p><span className="text-gray-500">检测类型：</span>{ins.inspectionType === 'internal' ? '内部检测' : '第三方检测'}</p>
                        <p><span className="text-gray-500">检测结果：</span>{ins.passed ? '✅ 合格' : '❌ 不合格'}</p>
                        <p><span className="text-gray-500">检测人员：</span>{ins.inspectorName}</p>
                        <p><span className="text-gray-500">检测时间：</span>{dayjs(ins.inspectionDate).format('YYYY-MM-DD HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索批次号、原料名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">批次号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原料</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生产日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-primary-600">{batch.batchNo}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{getMaterialName(batch.materialId)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {dayjs(batch.productionDate).format('YYYY-MM-DD')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{batch.quantity} {batch.unit}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        batch.status === 'producing' ? 'bg-blue-100 text-blue-800' :
                        batch.status === 'inspecting' ? 'bg-yellow-100 text-yellow-800' :
                        batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {batch.status === 'producing' ? '生产中' :
                         batch.status === 'inspecting' ? '检测中' :
                         batch.status === 'completed' ? '已完成' : '已取消'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(batch)}
                          className="text-bamboo-600 hover:text-bamboo-800 p-1"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      暂无批次数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingBatch ? '编辑批次' : '新增批次'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">批次号</label>
                  <input
                    type="text"
                    value={formData.batchNo}
                    onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生产日期</label>
                  <input
                    type="date"
                    value={formData.productionDate}
                    onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择原料</label>
                <select
                  value={formData.materialId}
                  onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  required
                >
                  <option value="">请选择原料</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联采集记录（可多选）</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {collections.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.collectionIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, collectionIds: [...formData.collectionIds, c.id] });
                          } else {
                            setFormData({ ...formData, collectionIds: formData.collectionIds.filter(id => id !== c.id) });
                          }
                        }}
                        className="rounded text-bamboo-500 focus:ring-bamboo-500"
                      />
                      <span className="text-sm">{c.materialName} - {c.quantity}{c.unit}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="吨">吨</option>
                    <option value="件">件</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                  >
                    <option value="producing">生产中</option>
                    <option value="inspecting">检测中</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-bamboo-500 text-white rounded-lg hover:bg-bamboo-600"
                >
                  {editingBatch ? '保存修改' : '创建批次'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;