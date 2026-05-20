import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, CheckCircle, Clock, Users, TrendingUp } from 'lucide-react';
import useStore from '../store';
import { imageAPI, projectAPI } from '../services/api';
import { Image as ImageType, Project } from '../../shared/types';

const Dashboard: React.FC = () => {
  const { setImages, setProjects, projects, images: storeImages } = useStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await imageAPI.getAll();
        setImages(data);
        const projectsData = await projectAPI.getAll();
        setProjects(projectsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    { label: '总图片数', value: storeImages.length, icon: Image, color: 'bg-blue-500' },
    { label: '已标注', value: storeImages.filter((i: any) => i.status === 'recognized').length, icon: CheckCircle, color: 'bg-green-500' },
    { label: '待处理', value: storeImages.filter((i: any) => i.status === 'uploaded').length, icon: Clock, color: 'bg-amber-500' },
    { label: '项目数', value: projects.length, icon: Users, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-serif">仪表盘</h1>
        <p className="text-gray-600 mt-2">欢迎回来，查看您的古籍碑文处理进度</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-4 rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">最近上传</h2>
          <button
            onClick={() => navigate('/upload')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-all"
          >
            上传图像
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        ) : storeImages.length === 0 ? (
          <div className="text-center py-12">
            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无图片，开始上传您的第一张古籍图片吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeImages.slice(0, 6).map((image: any) => (
              <div
                key={image.id}
                onClick={() => navigate(`/annotate/${image.id}`)}
                className="border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500 transition-all group"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                  {image.thumbnail_path ? (
                    <img
                      src={`/uploads/${image.thumbnail_path}`}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium text-gray-900 truncate">{image.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{image.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
