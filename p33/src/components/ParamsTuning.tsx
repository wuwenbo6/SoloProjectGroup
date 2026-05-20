import React, { useState, useEffect } from 'react';
import { paramsAPI } from '../services/api';

interface Profile {
  id?: number;
  name: string;
  camera_model: string;
  film_type: string;
  film_format: string;
  description?: string;
  scan_resolution: number;
  exposure_compensation: number;
  contrast: number;
  brightness: number;
  saturation: number;
  color_temperature: number;
  sharpness: number;
  noise_reduction: number;
  scratch_removal: boolean;
  fade_correction: boolean;
}

const defaultProfile: Profile = {
  name: '',
  camera_model: '',
  film_type: '',
  film_format: '135',
  description: '',
  scan_resolution: 2400,
  exposure_compensation: 0,
  contrast: 1.0,
  brightness: 0,
  saturation: 1.0,
  color_temperature: 5500,
  sharpness: 1.0,
  noise_reduction: 50,
  scratch_removal: true,
  fade_correction: true
};

const ParamsTuning: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile>(defaultProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadProfiles = async () => {
    try {
      const response = await paramsAPI.listProfiles();
      setProfiles(response.data || []);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleInputChange = (field: keyof Profile, value: any) => {
    setCurrentProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedId) {
        await paramsAPI.updateProfile(selectedId, currentProfile);
      } else {
        await paramsAPI.createProfile(currentProfile);
      }
      await loadProfiles();
      resetForm();
      alert('保存成功');
    } catch (error: any) {
      alert('保存失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEdit = (profile: Profile) => {
    setCurrentProfile(profile);
    setSelectedId(profile.id || null);
    setIsEditing(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此配置吗？')) return;
    try {
      await paramsAPI.deleteProfile(id);
      await loadProfiles();
      alert('删除成功');
    } catch (error: any) {
      alert('删除失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const resetForm = () => {
    setCurrentProfile(defaultProfile);
    setSelectedId(null);
    setIsEditing(false);
  };

  return (
    <div>
      <h2 className="page-title">胶片参数调试</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>配置列表</h3>
              <button className="btn btn-secondary" onClick={resetForm} style={{ padding: '0.5rem' }}>
                新建
              </button>
            </div>
            {profiles.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>暂无配置</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {profiles.map(profile => (
                  <div
                    key={profile.id}
                    className="card"
                    style={{ padding: '0.75rem', margin: 0, cursor: 'pointer' }}
                    onClick={() => handleEdit(profile)}
                  >
                    <h4>{profile.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: '#888' }}>
                      {profile.camera_model} | {profile.film_type}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <form onSubmit={handleSubmit} className="card">
            <h3>{isEditing ? '编辑配置' : '新建配置'}</h3>
            
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>配置名称</label>
                <input
                  type="text"
                  value={currentProfile.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>相机型号</label>
                <input
                  type="text"
                  value={currentProfile.camera_model}
                  onChange={e => handleInputChange('camera_model', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>胶片类型</label>
                <input
                  type="text"
                  value={currentProfile.film_type}
                  onChange={e => handleInputChange('film_type', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>胶片格式</label>
                <select
                  value={currentProfile.film_format}
                  onChange={e => handleInputChange('film_format', e.target.value)}
                >
                  <option value="135">135胶片</option>
                  <option value="120">120胶片</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>描述</label>
              <textarea
                value={currentProfile.description}
                onChange={e => handleInputChange('description', e.target.value)}
                rows={2}
              />
            </div>

            <h4 style={{ margin: '1.5rem 0 1rem' }}>扫描参数</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label>扫描分辨率 (dpi)</label>
                <input
                  type="number"
                  value={currentProfile.scan_resolution}
                  onChange={e => handleInputChange('scan_resolution', parseInt(e.target.value))}
                  min="300"
                  max="4800"
                />
              </div>
              <div className="form-group">
                <label>曝光补偿</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentProfile.exposure_compensation}
                  onChange={e => handleInputChange('exposure_compensation', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>对比度: {currentProfile.contrast}</label>
                <input
                  type="range"
                  className="slider"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={currentProfile.contrast}
                  onChange={e => handleInputChange('contrast', parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>亮度: {currentProfile.brightness}</label>
                <input
                  type="range"
                  className="slider"
                  min="-100"
                  max="100"
                  value={currentProfile.brightness}
                  onChange={e => handleInputChange('brightness', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>饱和度: {currentProfile.saturation}</label>
                <input
                  type="range"
                  className="slider"
                  min="0"
                  max="3"
                  step="0.1"
                  value={currentProfile.saturation}
                  onChange={e => handleInputChange('saturation', parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>色温 (K): {currentProfile.color_temperature}</label>
                <input
                  type="range"
                  className="slider"
                  min="2000"
                  max="10000"
                  step="100"
                  value={currentProfile.color_temperature}
                  onChange={e => handleInputChange('color_temperature', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>锐度: {currentProfile.sharpness}</label>
                <input
                  type="range"
                  className="slider"
                  min="0"
                  max="3"
                  step="0.1"
                  value={currentProfile.sharpness}
                  onChange={e => handleInputChange('sharpness', parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>降噪强度: {currentProfile.noise_reduction}</label>
                <input
                  type="range"
                  className="slider"
                  min="0"
                  max="100"
                  value={currentProfile.noise_reduction}
                  onChange={e => handleInputChange('noise_reduction', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={currentProfile.scratch_removal}
                  onChange={e => handleInputChange('scratch_removal', e.target.checked)}
                />
                自动划痕修复
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={currentProfile.fade_correction}
                  onChange={e => handleInputChange('fade_correction', e.target.checked)}
                />
                褪色校正
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {isEditing ? '更新配置' : '创建配置'}
              </button>
              {isEditing && selectedId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDelete(selectedId)}
                  style={{ background: '#dc3545' }}
                >
                  删除配置
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                重置
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ParamsTuning;
