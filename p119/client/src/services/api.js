import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

export const api = {
  uploadMap: async (file, name) => {
    const formData = new FormData();
    formData.append('map', file);
    formData.append('name', name);
    
    const response = await axios.post(`${API_BASE}/maps/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getMaps: async () => {
    const response = await axios.get(`${API_BASE}/maps`);
    return response.data;
  },

  getMap: async (mapId) => {
    const response = await axios.get(`${API_BASE}/maps/${mapId}`);
    return response.data;
  },

  updateMapDimensions: async (mapId, width, height) => {
    const response = await axios.put(`${API_BASE}/maps/${mapId}/dimensions`, { width, height });
    return response.data;
  },

  getControlPoints: async (mapId) => {
    const response = await axios.get(`${API_BASE}/maps/${mapId}/control-points`);
    return response.data;
  },

  addControlPoint: async (mapId, x, y, lon, lat) => {
    const response = await axios.post(`${API_BASE}/maps/${mapId}/control-points`, { x, y, lon, lat });
    return response.data;
  },

  deleteControlPoint: async (mapId, pointId) => {
    const response = await axios.delete(`${API_BASE}/maps/${mapId}/control-points/${pointId}`);
    return response.data;
  },

  getAnnotations: async (mapId) => {
    const response = await axios.get(`${API_BASE}/annotations/map/${mapId}`);
    return response.data;
  },

  createAnnotation: async (mapId, type, name, geometry, style, createdBy, modernName, description, layerId) => {
    const response = await axios.post(`${API_BASE}/annotations`, {
      mapId, type, name, geometry, style, createdBy, modernName, description, layerId
    });
    return response.data;
  },

  updateAnnotation: async (annotationId, name, geometry, style, modernName, description, layerId) => {
    const response = await axios.put(`${API_BASE}/annotations/${annotationId}`, {
      name, geometry, style, modernName, description, layerId
    });
    return response.data;
  },

  deleteAnnotation: async (annotationId) => {
    const response = await axios.delete(`${API_BASE}/annotations/${annotationId}`);
    return response.data;
  },

  getAnnotationVersions: async (annotationId) => {
    const response = await axios.get(`${API_BASE}/annotations/${annotationId}/versions`);
    return response.data;
  },

  restoreVersion: async (annotationId, version) => {
    const response = await axios.post(`${API_BASE}/annotations/${annotationId}/restore/${version}`);
    return response.data;
  },

  getLayers: async (mapId) => {
    const response = await axios.get(`${API_BASE}/layers/map/${mapId}`);
    return response.data;
  },

  createLayer: async (mapId, name, type, color) => {
    const response = await axios.post(`${API_BASE}/layers`, { mapId, name, type, color });
    return response.data;
  },

  updateLayer: async (layerId, data) => {
    const response = await axios.put(`${API_BASE}/layers/${layerId}`, data);
    return response.data;
  },

  deleteLayer: async (layerId) => {
    const response = await axios.delete(`${API_BASE}/layers/${layerId}`);
    return response.data;
  },

  getMapPermissions: async (mapId) => {
    const response = await axios.get(`${API_BASE}/permissions/map/${mapId}`);
    return response.data;
  },

  getUserPermission: async (userId, mapId) => {
    const response = await axios.get(`${API_BASE}/permissions/user/${userId}/map/${mapId}`);
    return response.data;
  },

  grantPermission: async (mapId, userId, permissionLevel, grantedBy) => {
    const response = await axios.post(`${API_BASE}/permissions`, { mapId, userId, permissionLevel, grantedBy });
    return response.data;
  },

  revokePermission: async (mapId, userId) => {
    const response = await axios.delete(`${API_BASE}/permissions/${mapId}/${userId}`);
    return response.data;
  },

  getNameRelations: async (annotationId) => {
    const response = await axios.get(`${API_BASE}/name-relations/annotation/${annotationId}`);
    return response.data;
  },

  getMapNameRelations: async (mapId) => {
    const response = await axios.get(`${API_BASE}/name-relations/map/${mapId}`);
    return response.data;
  },

  createNameRelation: async (annotationId, ancientName, modernName, relationType, confidence, source, notes, createdBy) => {
    const response = await axios.post(`${API_BASE}/name-relations`, {
      annotationId, ancientName, modernName, relationType, confidence, source, notes, createdBy
    });
    return response.data;
  },

  updateNameRelation: async (relationId, data) => {
    const response = await axios.put(`${API_BASE}/name-relations/${relationId}`, data);
    return response.data;
  },

  deleteNameRelation: async (relationId) => {
    const response = await axios.delete(`${API_BASE}/name-relations/${relationId}`);
    return response.data;
  },

  exportJSON: async (mapId) => {
    window.open(`${API_BASE}/export/map/${mapId}/json`, '_blank');
  },

  exportGeoJSON: async (mapId) => {
    window.open(`${API_BASE}/export/map/${mapId}/geojson`, '_blank');
  },

  exportKML: async (mapId) => {
    window.open(`${API_BASE}/export/map/${mapId}/kml`, '_blank');
  }
};
