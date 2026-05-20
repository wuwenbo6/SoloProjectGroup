import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ProcessForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '啤酒',
    isPublic: true,
    ingredients: [],
    steps: [],
    images: [],
    videos: [],
    existingImages: [],
    existingVideos: []
  });

  useEffect(() => {
    if (id) {
      fetchProcess();
    }
  }, [id]);

  const fetchProcess = async () => {
    try {
      const response = await api.get(`/process/${id}`);
      const process = response.data;
      
      if (process.userId._id !== user.id) {
        navigate('/');
        return;
      }

      setFormData({
        title: process.title,
        description: process.description,
        type: process.type,
        isPublic: process.isPublic,
        ingredients: process.ingredients || [],
        steps: process.steps || [],
        images: [],
        videos: [],
        existingImages: process.images || [],
        existingVideos: process.videos || []
      });
    } catch (error) {
      console.error('获取工艺失败:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', quantity: '', unit: '' }]
    }));
  };

  const updateIngredient = (index, field, value) => {
    setFormData(prev => {
      const ingredients = [...prev.ingredients];
      ingredients[index][field] = value;
      return { ...prev, ingredients };
    });
  };

  const removeIngredient = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { title: '', description: '', duration: '', temperature: '' }]
    }));
  };

  const updateStep = (index, field, value) => {
    setFormData(prev => {
      const steps = [...prev.steps];
      steps[index][field] = value;
      return { ...prev, steps };
    });
  };

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...files]
    }));
  };

  const removeImage = (index, isExisting = false) => {
    if (isExisting) {
      setFormData(prev => ({
        ...prev,
        existingImages: prev.existingImages.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    }
  };

  const handleVideoChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      videos: [...prev.videos, ...files]
    }));
  };

  const removeVideo = (index, isExisting = false) => {
    if (isExisting) {
      setFormData(prev => ({
        ...prev,
        existingVideos: prev.existingVideos.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        videos: prev.videos.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formDataObj = new FormData();
      formDataObj.append('title', formData.title);
      formDataObj.append('description', formData.description);
      formDataObj.append('type', formData.type);
      formDataObj.append('isPublic', formData.isPublic);
      formDataObj.append('ingredients', JSON.stringify(formData.ingredients));
      formDataObj.append('steps', JSON.stringify(formData.steps));
      formDataObj.append('existingImages', JSON.stringify(formData.existingImages));
      formDataObj.append('existingVideos', JSON.stringify(formData.existingVideos));
      
      formData.images.forEach(image => {
        formDataObj.append('images', image);
      });
      
      formData.videos.forEach(video => {
        formDataObj.append('videos', video);
      });

      if (id) {
        await api.put(`/process/${id}`, formDataObj);
      } else {
        await api.post('/process', formDataObj);
      }

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">{id ? '编辑工艺' : '发布新工艺'}</h2>
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">工艺名称</label>
          <input
            type="text"
            name="title"
            className="form-input"
            value={formData.title}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">工艺类型</label>
            <select
              name="type"
              className="form-select"
              value={formData.type}
              onChange={handleInputChange}
            >
              <option value="啤酒">啤酒</option>
              <option value="葡萄酒">葡萄酒</option>
              <option value="威士忌">威士忌</option>
              <option value="清酒">清酒</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">公开状态</label>
            <select
              name="isPublic"
              className="form-select"
              value={formData.isPublic}
              onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.value === 'true' }))}
            >
              <option value={true}>公开</option>
              <option value={false}>私密</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">工艺描述</label>
          <textarea
            name="description"
            className="form-textarea"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="ingredients-section">
          <div className="section-title">
            <span>原料清单</span>
            <button type="button" className="add-btn" onClick={addIngredient}>
              + 添加原料
            </button>
          </div>
          {formData.ingredients.map((ingredient, index) => (
            <div key={index} className="ingredient-item">
              <div className="ingredient-input">
                <input
                  type="text"
                  placeholder="原料名称"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                />
              </div>
              <div className="ingredient-input">
                <input
                  type="text"
                  placeholder="数量"
                  value={ingredient.quantity}
                  onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                />
              </div>
              <div className="ingredient-input">
                <input
                  type="text"
                  placeholder="单位"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                />
              </div>
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeIngredient(index)}
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className="steps-section">
          <div className="section-title">
            <span>酿造步骤</span>
            <button type="button" className="add-btn" onClick={addStep}>
              + 添加步骤
            </button>
          </div>
          {formData.steps.map((step, index) => (
            <div key={index} className="step-item">
              <div className="step-number">{index + 1}</div>
              <div className="step-content">
                <input
                  type="text"
                  className="form-input"
                  placeholder="步骤标题"
                  value={step.title}
                  onChange={(e) => updateStep(index, 'title', e.target.value)}
                />
                <textarea
                  className="form-textarea"
                  placeholder="步骤描述"
                  value={step.description}
                  onChange={(e) => updateStep(index, 'description', e.target.value)}
                  style={{ minHeight: '80px' }}
                />
                <div className="step-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="持续时间"
                    value={step.duration}
                    onChange={(e) => updateStep(index, 'duration', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="温度"
                    value={step.temperature}
                    onChange={(e) => updateStep(index, 'temperature', e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeStep(index)}
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className="image-upload-section">
          <div className="section-title">
            <span>工艺图片</span>
          </div>
          <div className="image-upload-area" onClick={() => document.getElementById('image-input').click()}>
            <p>点击上传图片</p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>支持多图上传，最多5张</p>
          </div>
          <input
            id="image-input"
            type="file"
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
          <div className="image-preview-grid">
            {formData.existingImages.map((image, index) => (
              <div key={`existing-img-${index}`} className="image-preview-item">
                <img src={image} alt="" />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => removeImage(index, true)}
                >
                  ×
                </button>
              </div>
            ))}
            {formData.images.map((image, index) => (
              <div key={`new-img-${index}`} className="image-preview-item">
                <img src={URL.createObjectURL(image)} alt="" />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => removeImage(index, false)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="image-upload-section">
          <div className="section-title">
            <span>工艺视频</span>
          </div>
          <div className="image-upload-area" onClick={() => document.getElementById('video-input').click()}>
            <p>点击上传视频</p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>支持mp4, webm, ogg格式，最多2个视频</p>
          </div>
          <input
            id="video-input"
            type="file"
            multiple
            accept="video/mp4,video/webm,video/ogg"
            style={{ display: 'none' }}
            onChange={handleVideoChange}
          />
          <div className="image-preview-grid">
            {formData.existingVideos.map((video, index) => (
              <div key={`existing-vid-${index}`} className="image-preview-item">
                <video src={video} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => removeVideo(index, true)}
                >
                  ×
                </button>
              </div>
            ))}
            {formData.videos.map((video, index) => (
              <div key={`new-vid-${index}`} className="image-preview-item">
                <video src={URL.createObjectURL(video)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => removeVideo(index, false)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="submit-section">
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate(-1)}
          >
            取消
          </button>
          <button type="submit" className="form-btn" disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProcessForm;
