import React, { useState, useEffect } from 'react';
import { FolderOpen, Trash2, Plus, ArrowLeft, FileCode } from 'lucide-react';
import { useSimulationStore, Project } from '../store/simulationStore';
import { useNavigate } from 'react-router-dom';

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { projects, setCurrentProject } = useSimulationStore();
  const [localProjects, setLocalProjects] = useState<Project[]>([]);

  useEffect(() => {
    // 从localStorage加载项目
    const saved = localStorage.getItem('plc_projects');
    if (saved) {
      setLocalProjects(JSON.parse(saved));
    }
  }, []);

  const handleLoadProject = (project: Project) => {
    setCurrentProject(project);
    navigate('/');
  };

  const handleDeleteProject = (id: string) => {
    const updated = localProjects.filter(p => p.id !== id);
    setLocalProjects(updated);
    localStorage.setItem('plc_projects', JSON.stringify(updated));
  };

  const handleNewProject = () => {
    setCurrentProject(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-industrial-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-industrial-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <FileCode size={28} className="text-tech-green-400" />
            <h1 className="text-2xl font-bold">项目管理</h1>
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-2 px-4 py-2 bg-tech-green-600 hover:bg-tech-green-700 rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            新建项目
          </button>
        </div>
      </header>

      {/* Project List */}
      <main className="max-w-6xl mx-auto p-6">
        {localProjects.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">暂无项目</h2>
            <p className="text-gray-400 mb-6">创建您的第一个PLC梯形图项目</p>
            <button
              onClick={handleNewProject}
              className="inline-flex items-center gap-2 px-6 py-3 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 transition-colors font-medium"
            >
              <Plus size={20} />
              创建新项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {localProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-industrial-100 rounded-lg">
                    <FileCode size={24} className="text-industrial-600" />
                  </div>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="text-xs text-gray-400 mb-4">
                  创建于: {new Date(project.createdAt).toLocaleDateString()}
                </div>
                <button
                  onClick={() => handleLoadProject(project)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-industrial-600 text-white rounded-lg hover:bg-industrial-700 transition-colors font-medium text-sm"
                >
                  <FolderOpen size={16} />
                  打开项目
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Projects;
