import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, MapPin } from 'lucide-react';
import { materialAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Material {
  id: string;
  name: string;
  category: string;
  origin: string;
  originCoords?: { lat: number; lng: number };
  description: string;
  specifications: Record<string, string>;
  status: string;
  createdAt: string;
}

const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    origin: '',
    description: '',
    specifications: '{}',
  });

  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'material_manager';

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const response = await materialAPI.getAll({ pageSize: 100 });
      setMaterials(response.data.data.list || []);
    } catch (error) {
      console.error('Failed to load materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        specifications: JSON.parse(formData.specifications),
      };

      if (editingMaterial) {
        await materialAPI.update(editingMaterial.id, data);
      } else {
        await materialAPI.create(data);
      }

      setShowModal(false);
      setEditingMaterial(null);
      setFormData({ name: '', category: '', origin: '', description: '', specifications: '{}' });
      loadMaterials();
    } catch (error) {
      console.error('Failed to save material:', error);
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category: material.category,
      origin: material.origin,
      description: material.description,
      specifications: JSON.stringify(material.specifications, null, 2),
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此原料吗？')) {
      try {
        await materialAPI.delete(id);
        loadMaterials();
      } catch (error) {
        console.error('Failed to delete material:', error);
      }
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.origin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary-800 mb-2">原料管理</h1>
          <p className="text-primary-600">管理古法造纸的所有原料信息</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingMaterial(null);
              setFormData({ name: '', category: '', origin: '', description: '', specifications: '{}' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-bamboo-500 text-white px-4 py-2 rounded-lg hover:bg-bamboo-600 transition-colors shadow-lg"
          >
            <Plus size={20} />
            新增原料
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜索原料名称、分类、产地..."
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">分类</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">产地</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">规格参数</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">状态</th>
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
            ) : filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  暂无原料数据
                </td>
              </tr>
            ) : (
              filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{material.name}</div>
                    <div className="text-sm text-gray-500">{material.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-bamboo-100 text-bamboo-700">
                      {material.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} />
                      {material.origin}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 space-y-1">
                      {Object.entries(material.specifications || {}).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-gray-500">{key}:</span> {value as string}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        material.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {material.status === 'active' ? '启用' : '禁用'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(material)}
                        className="text-primary-600 hover:text-primary-800 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors ml-1"
                      >
                        <Trash2 size={18} />
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
                {editingMaterial ? '编辑原料' : '新增原料'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原料名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类 *</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">产地 *</label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规格参数 (JSON)</label>
                <textarea
                  value={formData.specifications}
                  onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingMaterial(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-bamboo-500 text-white rounded-lg hover:bg-bamboo-600 transition-colors"
                >
                  {editingMaterial ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Materials;
