import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../store/userStore';
import { craftAPI, uploadFile } from '../services/api';
import './CraftEditor.css';

const CraftEditor = () => {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    materials: [''],
    steps: [''],
    images: [],
    videos: [],
    temperature: 1200,
    duration: 8,
    isPublic: true,
  });

  useEffect(() => {
    if (id) {
      loadCraft();
    }
  }, [id]);

  const loadCraft = async () => {
    try {
      const craft = await craftAPI.getById(id);
      setFormData({
        title: craft.title,
        description: craft.description,
        materials: craft.materials.length ? craft.materials : [''],
        steps: craft.steps.length ? craft.steps : [''],
        images: craft.images || [],
        videos: craft.videos || [],
        temperature: craft.temperature,
        duration: craft.duration,
        isPublic: craft.isPublic,
      });
    } catch (error) {
      console.error('加载工艺失败:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await uploadFile(file);
      if (result.path) {
        if (result.type === 'video') {
          setFormData(prev => ({
            ...prev,
            videos: [...prev.videos, result.path]
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, result.path]
          }));
        }
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const removeVideo = (index) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index)
    }));
  };

  const handleMaterialChange = (index, value) => {
    const newMaterials = [...formData.materials];
    newMaterials[index] = value;
    setFormData(prev => ({ ...prev, materials: newMaterials }));
  };

  const addMaterial = () => {
    setFormData(prev => ({ ...prev, materials: [...prev.materials, ''] }));
  };

  const removeMaterial = (index) => {
    if (formData.materials.length > 1) {
      setFormData(prev => ({
        ...prev,
        materials: prev.materials.filter((_, i) => i !== index)
      }));
    }
  };

  const handleStepChange = (index, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = value;
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    setFormData(prev => ({ ...prev, steps: [...prev.steps, ''] }));
  };

  const removeStep = (index) => {
    if (formData.steps.length > 1) {
      setFormData(prev => ({
        ...prev,
        steps: prev.steps.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      navigate('/login');
      return;
    }
    if (!formData.title.trim()) {
      alert('请输入工艺名称');
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        userId: user.id,
        materials: formData.materials.filter(m => m.trim()),
        steps: formData.steps.filter(s => s.trim()),
      };

      if (id) {
        await craftAPI.update(id, data);
      } else {
        await craftAPI.create(data);
      }
      navigate('/');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="editor-container card">
        <h1 className="editor-title">
          {id ? '编辑工艺' : '创建新工艺'}
        </h1>

        <form onSubmit={handleSubmit} className="editor-form">
          <section className="form-section">
            <h3>基本信息</h3>
            <div className="form-group">
              <label>工艺名称 *</label>
              <input
                type="text"
                className="input"
                placeholder="例如：青花瓷烧制工艺"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>工艺描述</label>
              <textarea
                className="input textarea"
                placeholder="简要描述这个工艺的特点..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </section>

          <section className="form-section">
            <h3>图片展示</h3>
            <div className="images-grid">
              {formData.images.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img} alt="" />
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => removeImage(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="add-image-btn">
                {uploading ? <span>上传中...</span> : <span>+ 添加图片</span>}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>视频展示</h3>
            <div className="images-grid">
              {formData.videos.map((video, index) => (
                <div key={index} className="video-item">
                  <video src={video} controls />
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => removeVideo(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="add-image-btn">
                {uploading ? <span>上传中...</span> : <span>+ 添加视频</span>}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>材料清单</h3>
            {formData.materials.map((material, index) => (
              <div key={index} className="input-row">
                <input
                  type="text"
                  className="input"
                  placeholder={`材料 ${index + 1}`}
                  value={material}
                  onChange={(e) => handleMaterialChange(index, e.target.value)}
                />
                {formData.materials.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removeMaterial(index)}
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addMaterial}>
              + 添加材料
            </button>
          </section>

          <section className="form-section">
            <h3>制作步骤</h3>
            {formData.steps.map((step, index) => (
              <div key={index} className="input-row">
                <span className="step-number">步骤 {index + 1}</span>
                <textarea
                  className="input textarea"
                  placeholder="描述这一步的操作..."
                  value={step}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                />
                {formData.steps.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removeStep(index)}
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addStep}>
              + 添加步骤
            </button>
          </section>

          <section className="form-section">
            <h3>烧制参数</h3>
            <div className="params-row">
              <div className="form-group">
                <label>烧制温度 (°C)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>烧制时长 (小时)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                />
                公开分享这个工艺
              </label>
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
            >
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '保存中...' : '保存工艺'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CraftEditor;
