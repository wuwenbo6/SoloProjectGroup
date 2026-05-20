import React, { useState } from 'react'
import { Search, Filter, Grid, List, Eye, Edit3, Trash2, Tag } from 'lucide-react'
import { Link } from 'react-router-dom'
import LazyImage from '../../components/LazyImage'

const Materials: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const materials = [
    {
      id: '1',
      name: '苗族蜡染云纹',
      category: '云纹',
      ethnicity: '苗族',
      status: 'processed',
      thumbnail: 'https://picsum.photos/200/200?random=10',
      uploadedBy: '张三',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      name: '彝族刺绣花卉',
      category: '花卉纹',
      ethnicity: '彝族',
      status: 'processed',
      thumbnail: 'https://picsum.photos/200/200?random=11',
      uploadedBy: '李四',
      createdAt: '2024-01-14',
    },
    {
      id: '3',
      name: '壮族织锦几何纹',
      category: '几何纹',
      ethnicity: '壮族',
      status: 'processing',
      thumbnail: 'https://picsum.photos/200/200?random=12',
      uploadedBy: '王五',
      createdAt: '2024-01-13',
    },
    {
      id: '4',
      name: '傣族水纹图案',
      category: '水纹',
      ethnicity: '傣族',
      status: 'pending',
      thumbnail: 'https://picsum.photos/200/200?random=13',
      uploadedBy: '赵六',
      createdAt: '2024-01-12',
    },
    {
      id: '5',
      name: '藏族吉祥纹样',
      category: '动物纹',
      ethnicity: '藏族',
      status: 'error',
      thumbnail: 'https://picsum.photos/200/200?random=14',
      uploadedBy: '钱七',
      createdAt: '2024-01-11',
    },
    {
      id: '6',
      name: '苗族蝴蝶妈妈纹',
      category: '蜡染纹',
      ethnicity: '苗族',
      status: 'processed',
      thumbnail: 'https://picsum.photos/200/200?random=15',
      uploadedBy: '张三',
      createdAt: '2024-01-10',
    },
  ]

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      processed: 'bg-green-100 text-green-700',
      processing: 'bg-yellow-100 text-yellow-700',
      pending: 'bg-gray-100 text-gray-700',
      error: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      processed: '已处理',
      processing: '处理中',
      pending: '待处理',
      error: '处理失败',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-indigo-dark">素材库</h1>
          <p className="text-gray-500 mt-2">管理所有纹样素材</p>
        </div>
        <Link to="/capture" className="btn-primary flex items-center gap-2">
          <Tag size={20} />
          上传素材
        </Link>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="搜索纹样名称、上传者..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-dark"
          >
            <option value="all">全部分类</option>
            <option value="云纹">云纹</option>
            <option value="水纹">水纹</option>
            <option value="花卉纹">花卉纹</option>
            <option value="动物纹">动物纹</option>
            <option value="几何纹">几何纹</option>
            <option value="蜡染纹">蜡染纹</option>
            <option value="刺绣纹">刺绣纹</option>
            <option value="织锦纹">织锦纹</option>
          </select>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Grid size={20} className={viewMode === 'grid' ? 'text-indigo-dark' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <List size={20} className={viewMode === 'list' ? 'text-indigo-dark' : 'text-gray-500'} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {materials.map((material) => (
            <div key={material.id} className="card group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4 relative">
                <LazyImage
                  src={material.thumbnail}
                  alt={material.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="p-2 bg-white rounded-full hover:bg-gray-100" title="查看详情">
                    <Eye size={18} className="text-gray-800" />
                  </button>
                  <Link
                    to={`/editor/${material.id}`}
                    className="p-2 bg-gold-earth rounded-full hover:bg-yellow-700"
                    title="编辑"
                  >
                    <Edit3 size={18} className="text-white" />
                  </Link>
                  <button className="p-2 bg-red-vermilion rounded-full hover:bg-red-700" title="删除">
                    <Trash2 size={18} className="text-white" />
                  </button>
                </div>
              </div>
              <h3 className="font-medium text-gray-800 mb-2 truncate">{material.name}</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{material.ethnicity}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-xs text-gray-500">{material.category}</span>
                </div>
                {getStatusBadge(material.status)}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {material.uploadedBy} · {material.createdAt}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  纹样
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  民族
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  上传者
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  上传时间
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <LazyImage
                          src={material.thumbnail}
                          alt={material.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-medium text-gray-800">{material.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{material.category}</td>
                  <td className="px-6 py-4 text-gray-600">{material.ethnicity}</td>
                  <td className="px-6 py-4">{getStatusBadge(material.status)}</td>
                  <td className="px-6 py-4 text-gray-600">{material.uploadedBy}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{material.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded" title="查看">
                        <Eye size={16} className="text-gray-500" />
                      </button>
                      <Link to={`/editor/${material.id}`} className="p-1 hover:bg-gray-100 rounded" title="编辑">
                        <Edit3 size={16} className="text-gold-earth" />
                      </Link>
                      <button className="p-1 hover:bg-gray-100 rounded" title="删除">
                        <Trash2 size={16} className="text-red-vermilion" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Materials
