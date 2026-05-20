import { useEffect, useState } from 'react';
import { Plus, Search, Edit, FileCheck, Building2 } from 'lucide-react';
import { inspectionAPI, collectionAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';

interface Inspection {
  id: string;
  collectionId: string;
  inspectorId: string;
  inspectionType: string;
  items: { name: string; value: string; standard?: string }[];
  conclusion: string;
  reportUrl?: string;
  agencyId?: string;
  createdAt: string;
}

interface CollectionItem {
  id: string;
  materialName: string;
}

const Inspection = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [formData, setFormData] = useState({
    collectionId: '',
    inspectionType: 'internal',
    items: '[{"name":"","value":"","standard":""}]',
    conclusion: 'pending',
    reportUrl: '',
  });

  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'inspector';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [inspectionsRes, collectionsRes] = await Promise.all([
        inspectionAPI.getAll({ pageSize: 100 }),
        collectionAPI.getAll({ pageSize: 100 }),
      ]);
      setInspections(inspectionsRes.data.data.list || []);
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
        items: JSON.parse(formData.items),
      };

      if (editingInspection) {
        await inspectionAPI.update(editingInspection.id, data);
      } else {
        await inspectionAPI.create(data);
      }

      setShowModal(false);
      setEditingInspection(null);
      setFormData({
        collectionId: '',
        inspectionType: 'internal',
        items: '[{"name":"","value":"","standard":""}]',
        conclusion: 'pending',
        reportUrl: '',
      });
      loadData();
    } catch (error) {
      console.error('Failed to save inspection:', error);
    }
  };

  const handleEdit = (inspection: Inspection) => {
    setEditingInspection(inspection);
    setFormData({
      collectionId: inspection.collectionId,
      inspectionType: inspection.inspectionType,
      items: JSON.stringify(inspection.items, null, 2),
      conclusion: inspection.conclusion,
      reportUrl: inspection.reportUrl || '',
    });
    setShowModal(true);
  };

  const getCollectionInfo = (collectionId: string) => {
    return collections.find((c) => c.id === collectionId);
  };

  const filteredInspections = inspections.filter((i) => {
    const collection = getCollectionInfo(i.collectionId);
    return (
      (collection?.materialName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.inspectionType.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">品质检测</h1>
          <p className="text-primary-600">管理原料品质检测报告和第三方机构对接</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingInspection(null);
              setFormData({
                collectionId: '',
                inspectionType: 'internal',
                items: '[{"name":"","value":"","standard":""}]',
                conclusion: 'pending',
                reportUrl: '',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-bamboo-500 text-white px-4 py-2 rounded-lg hover:bg-bamboo-600 transition-colors shadow-lg"
          >
            <Plus size={20} />
            新增检测
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜索原料名称、检测类型..."
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">检测类型</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">检测项目</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">结论</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">检测时间</th>
              {canEdit && (
                <th className="px-6 py-4 text-right text-sm font-semibold text-primary-700">操作</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  加载中...
                </td>
              </tr>
            ) : filteredInspections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  暂无检测数据
                </td>
              </tr>
            ) : (
              filteredInspections.map((inspection) => {
                const collection = getCollectionInfo(inspection.collectionId);
                return (
                  <tr key={inspection.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{collection?.materialName || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium gap-1 ${
                          inspection.inspectionType === 'internal'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {inspection.inspectionType === 'internal' ? (
                          <FileCheck size={12} />
                        ) : (
                          <Building2 size={12} />
                        )}
                        {inspection.inspectionType === 'internal' ? '内部检测' : '第三方检测'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {inspection.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="truncate">
                            {item.name}: {item.value}
                          </div>
                        ))}
                        {inspection.items.length > 3 && (
                          <div className="text-primary-500">+{inspection.items.length - 3} 更多</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          inspection.conclusion === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : inspection.conclusion === 'fail'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {inspection.conclusion === 'pass'
                          ? '通过'
                          : inspection.conclusion === 'fail'
                          ? '不通过'
                          : '待定'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {dayjs(inspection.createdAt).format('YYYY-MM-DD HH:mm')}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(inspection)}
                          className="text-primary-600 hover:text-primary-800 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingInspection ? '编辑检测报告' : '新增检测报告'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联采集 *</label>
                <select
                  value={formData.collectionId}
                  onChange={(e) => setFormData({ ...formData, collectionId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">请选择采集记录</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.materialName} - {c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">检测类型 *</label>
                <select
                  value={formData.inspectionType}
                  onChange={(e) => setFormData({ ...formData, inspectionType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="internal">内部检测</option>
                  <option value="third_party">第三方检测</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">检测项目 (JSON) *</label>
                <textarea
                  value={formData.items}
                  onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">检测结论 *</label>
                <select
                  value={formData.conclusion}
                  onChange={(e) => setFormData({ ...formData, conclusion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="pending">待定</option>
                  <option value="pass">通过</option>
                  <option value="fail">不通过</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报告链接</label>
                <input
                  type="url"
                  value={formData.reportUrl}
                  onChange={(e) => setFormData({ ...formData, reportUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingInspection(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-bamboo-500 text-white rounded-lg hover:bg-bamboo-600 transition-colors"
                >
                  {editingInspection ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inspection;
