import React, { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  Download,
  Link,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Shield,
  ChevronDown,
  ChevronUp,
  MapPin,
  Droplets
} from 'lucide-react';
import { api } from '../services/api';

function SidebarPanel({
  mapId,
  currentUser,
  layers,
  setLayers,
  annotations,
  selectedAnnotation,
  setSelectedAnnotation,
  onLayerToggle
}) {
  const [activeTab, setActiveTab] = useState('layers');
  const [newLayerName, setNewLayerName] = useState('');
  const [nameRelations, setNameRelations] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [newUserId, setNewUserId] = useState('');
  const [newPermissionLevel, setNewPermissionLevel] = useState('viewer');
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [newNameRelation, setNewNameRelation] = useState({
    ancientName: '',
    modernName: '',
    relationType: 'same',
    confidence: 1.0,
    source: '',
    notes: ''
  });

  const tabs = [
    { id: 'layers', label: '图层管理', icon: Layers },
    { id: 'names', label: '古今地名', icon: Link },
    { id: 'permissions', label: '权限设置', icon: Shield },
    { id: 'export', label: '导出数据', icon: Download }
  ];

  useEffect(() => {
    if (selectedAnnotation) {
      loadNameRelations(selectedAnnotation.id);
    }
  }, [selectedAnnotation]);

  useEffect(() => {
    loadPermissions();
  }, [mapId]);

  const loadNameRelations = async (annotationId) => {
    try {
      const data = await api.getNameRelations(annotationId);
      setNameRelations(data);
    } catch (error) {
      console.error('加载地名关系失败:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const data = await api.getMapPermissions(mapId);
      setPermissions(data);
    } catch (error) {
      console.error('加载权限失败:', error);
    }
  };

  const createLayer = async () => {
    if (!newLayerName.trim()) return;
    
    const colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    try {
      const layer = await api.createLayer(mapId, newLayerName, 'annotation', randomColor);
      setLayers(prev => [...prev, layer]);
      setNewLayerName('');
    } catch (error) {
      console.error('创建图层失败:', error);
    }
  };

  const toggleLayerVisibility = async (layer) => {
    try {
      await api.updateLayer(layer.id, { visible: !layer.visible });
      setLayers(prev => prev.map(l =>
        l.id === layer.id ? { ...l, visible: !l.visible } : l
      ));
      onLayerToggle && onLayerToggle();
    } catch (error) {
      console.error('切换图层可见性失败:', error);
    }
  };

  const deleteLayer = async (layerId) => {
    if (!confirm('确定要删除此图层吗？图层内的标注将被移动到默认图层。')) return;
    
    try {
      await api.deleteLayer(layerId);
      setLayers(prev => prev.filter(l => l.id !== layerId));
    } catch (error) {
      console.error('删除图层失败:', error);
    }
  };

  const addNameRelation = async () => {
    if (!selectedAnnotation || !newNameRelation.ancientName.trim()) return;
    
    try {
      const relation = await api.createNameRelation(
        selectedAnnotation.id,
        newNameRelation.ancientName,
        newNameRelation.modernName,
        newNameRelation.relationType,
        newNameRelation.confidence,
        newNameRelation.source,
        newNameRelation.notes,
        currentUser.id
      );
      setNameRelations(prev => [...prev, relation]);
      setNewNameRelation({
        ancientName: '',
        modernName: '',
        relationType: 'same',
        confidence: 1.0,
        source: '',
        notes: ''
      });
    } catch (error) {
      console.error('添加地名关系失败:', error);
    }
  };

  const deleteNameRelation = async (relationId) => {
    try {
      await api.deleteNameRelation(relationId);
      setNameRelations(prev => prev.filter(r => r.id !== relationId));
    } catch (error) {
      console.error('删除地名关系失败:', error);
    }
  };

  const grantPermission = async () => {
    if (!newUserId.trim()) return;
    
    try {
      await api.grantPermission(mapId, newUserId, newPermissionLevel, currentUser.id);
      setNewUserId('');
      loadPermissions();
    } catch (error) {
      console.error('授权失败:', error);
    }
  };

  const revokePermission = async (userId) => {
    try {
      await api.revokePermission(mapId, userId);
      loadPermissions();
    } catch (error) {
      console.error('撤销权限失败:', error);
    }
  };

  const renderLayersTab = () => (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="新建图层名称"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
          />
          <button
            onClick={createLayer}
            style={{
              padding: '8px 16px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {layers.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无图层</p>
      ) : (
        layers.map(layer => (
          <div
            key={layer.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: layer.visible ? '#f8f9fa' : '#fff',
              border: '1px solid #eee',
              borderRadius: '6px',
              marginBottom: '8px',
              opacity: layer.visible ? 1 : 0.5
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  background: layer.color
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>{layer.name}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>
                ({annotations.filter(a => a.layerId === layer.id).length}个标注)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => toggleLayerVisibility(layer)}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => deleteLayer(layer.id)}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#e74c3c'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderNamesTab = () => (
    <div style={{ padding: '16px 0' }}>
      {!selectedAnnotation ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
          请先选择一个标注以添加古今地名对照
        </p>
      ) : (
        <>
          <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {selectedAnnotation.type === 'place' ? (
                <MapPin size={16} color="#f39c12" />
              ) : (
                <Droplets size={16} color="#3498db" />
              )}
              <span style={{ fontWeight: '500' }}>{selectedAnnotation.name}</span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>添加地名对照</h4>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="古地名"
                value={newNameRelation.ancientName}
                onChange={(e) => setNewNameRelation(prev => ({ ...prev, ancientName: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="现代地名"
                value={newNameRelation.modernName}
                onChange={(e) => setNewNameRelation(prev => ({ ...prev, modernName: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
              />
              <select
                value={newNameRelation.relationType}
                onChange={(e) => setNewNameRelation(prev => ({ ...prev, relationType: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
              >
                <option value="same">同一地点</option>
                <option value="contains">包含</option>
                <option value="related">相关</option>
                <option value="nearby">邻近</option>
              </select>
              <input
                type="text"
                placeholder="资料来源（可选）"
                value={newNameRelation.source}
                onChange={(e) => setNewNameRelation(prev => ({ ...prev, source: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
              />
            </div>
            <button
              onClick={addNameRelation}
              style={{
                width: '100%',
                padding: '10px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              添加对照
            </button>
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
            地名对照列表 ({nameRelations.length})
          </h4>
          {nameRelations.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无对照记录</p>
          ) : (
            nameRelations.map(relation => (
              <div
                key={relation.id}
                style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>
                        {relation.ancient_name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999' }}>→</span>
                      <span style={{ fontSize: '14px', color: '#3498db' }}>
                        {relation.modern_name || '未知'}
                      </span>
                    </div>
                    {relation.source && (
                      <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>
                        来源: {relation.source}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteNameRelation(relation.id)}
                    style={{
                      padding: '4px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#e74c3c'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );

  const renderPermissionsTab = () => (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>授予权限</h4>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="用户ID"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select
            value={newPermissionLevel}
            onChange={(e) => setNewPermissionLevel(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
          >
            <option value="viewer">查看者</option>
            <option value="editor">编辑者</option>
            <option value="admin">管理员</option>
          </select>
          <button
            onClick={grantPermission}
            style={{
              padding: '8px 16px',
              background: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            授权
          </button>
        </div>
      </div>

      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
        已授权用户 ({permissions.length})
      </h4>
      {permissions.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无授权</p>
      ) : (
        permissions.map(perm => (
          <div
            key={perm.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: '#f8f9fa',
              borderRadius: '6px',
              marginBottom: '8px'
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{perm.user_name || perm.user_id}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {perm.permission_level === 'viewer' ? '查看者' :
                 perm.permission_level === 'editor' ? '编辑者' : '管理员'}
              </div>
            </div>
            <button
              onClick={() => revokePermission(perm.user_id)}
              style={{
                padding: '4px 8px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#e74c3c'
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderExportTab = () => (
    <div style={{ padding: '16px 0' }}>
      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '16px' }}>导出标注数据</h4>
      
      <button
        onClick={() => api.exportJSON(mapId)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          marginBottom: '8px',
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        <Download size={18} />
        导出 JSON 格式
      </button>

      <button
        onClick={() => api.exportGeoJSON(mapId)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          marginBottom: '8px',
          background: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        <Download size={18} />
        导出 GeoJSON 格式
      </button>

      <button
        onClick={() => api.exportKML(mapId)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          background: '#9b59b6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        <Download size={18} />
        导出 KML 格式
      </button>

      <div style={{ marginTop: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>导出统计:</p>
        <ul style={{ fontSize: '12px', color: '#999', margin: '0', paddingLeft: '16px' }}>
          <li>控制点: {annotations.filter(a => a.type === 'place').length} 个</li>
          <li>水系标注: {annotations.filter(a => a.type === 'water').length} 条</li>
          <li>图层数量: {layers.length} 个</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="sidebar" style={{ width: '320px' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '12px 8px',
              border: 'none',
              background: activeTab === tab.id ? '#f0f4f8' : 'transparent',
              color: activeTab === tab.id ? '#2c3e50' : '#999',
              cursor: pointer,
              fontSize: '11px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              borderBottom: activeTab === tab.id ? '2px solid #3498db' : '2px solid transparent'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'layers' && renderLayersTab()}
        {activeTab === 'names' && renderNamesTab()}
        {activeTab === 'permissions' && renderPermissionsTab()}
        {activeTab === 'export' && renderExportTab()}
      </div>
    </div>
  );
}

export default SidebarPanel;
