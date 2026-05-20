import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const extractEntities = async (text) => {
  const response = await api.post('/extract/entities', { text });
  return response.data;
};

export const extractAll = async (text) => {
  const response = await api.post('/extract/all', { text });
  return response.data;
};

export const addEntity = async (name, type, properties = {}) => {
  const response = await api.post('/entities', { name, type, properties });
  return response.data;
};

export const deleteEntity = async (id) => {
  const response = await api.delete('/entities', { data: { id } });
  return response.data;
};

export const addRelationship = async (source, sourceType, relation, target, targetType, properties = {}) => {
  const response = await api.post('/relationships', {
    source,
    source_type: sourceType,
    relation,
    target,
    target_type: targetType,
    properties,
  });
  return response.data;
};

export const deleteRelationship = async (id) => {
  const response = await api.delete('/relationships', { data: { id } });
  return response.data;
};

export const getGraph = async () => {
  const response = await api.get('/graph');
  return response.data;
};

export const addWorldSetting = async (name, description, properties = {}) => {
  const response = await api.post('/world-settings', { name, description, properties });
  return response.data;
};

export const getWorldSettings = async () => {
  const response = await api.get('/world-settings');
  return response.data;
};

export const generateRelationships = async (entities, context = '') => {
  const response = await api.post('/generate/relationships', { entities, context });
  return response.data;
};

export const generateEvents = async (entities, worldSetting = '', numEvents = 3) => {
  const response = await api.post('/generate/events', {
    entities,
    world_setting: worldSetting,
    num_events: numEvents,
  });
  return response.data;
};

export const expandWorldSetting = async (currentSetting, focusArea = '') => {
  const response = await api.post('/generate/expand-world', {
    current_setting: currentSetting,
    focus_area: focusArea,
  });
  return response.data;
};

export const autocompleteRelation = async (source, target, context = '') => {
  const response = await api.post('/generate/autocomplete-relation', { source, target, context });
  return response.data;
};

export const exportJson = async () => {
  const response = await api.get('/export/json');
  return response.data;
};

export const exportMarkdown = async () => {
  const response = await api.get('/export/markdown');
  return response.data;
};

export const clearDatabase = async () => {
  const response = await api.delete('/database');
  return response.data;
};

export const importJson = async (data) => {
  const response = await api.post('/import/json', data);
  return response.data;
};

export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const addEntityWithResolution = async (name, type, properties = {}, autoMerge = true) => {
  const response = await api.post('/entities/with-resolution', {
    name,
    type,
    properties,
    auto_merge: autoMerge,
  });
  return response.data;
};

export const mergeEntities = async (primaryId, duplicateId) => {
  const response = await api.post('/entities/merge', {
    primary_id: primaryId,
    duplicate_id: duplicateId,
  });
  return response.data;
};

export const getEntityAliases = async (entityId) => {
  const response = await api.get(`/entities/${entityId}/aliases`);
  return response.data;
};

export const findSimilarEntity = async (name, type) => {
  const response = await api.post('/entities/find-similar', { name, type });
  return response.data;
};

export const checkRelationshipConflict = async (source, sourceType, relation, target, targetType) => {
  const response = await api.post('/check-conflict/relationship', {
    source,
    source_type: sourceType,
    relation,
    target,
    target_type: targetType,
  });
  return response.data;
};

export const checkWorldSettingConflict = async (description) => {
  const response = await api.post('/check-conflict/world-setting', { description });
  return response.data;
};

export const addCustomAlias = async (canonical, alias) => {
  const response = await api.post('/aliases/add', { canonical, alias });
  return response.data;
};

export const resolveEntitiesList = async (text) => {
  const response = await api.post('/resolve/entities', { text });
  return response.data;
};

export const extractTimeline = async (text) => {
  const response = await api.post('/timeline/extract', { text });
  return response.data;
};

export const getTimeline = async () => {
  const response = await api.get('/timeline');
  return response.data;
};

export const getGeoMap = async () => {
  const response = await api.get('/geo/map');
  return response.data;
};

export const getPlaceCoordinates = async (places) => {
  const response = await api.post('/geo/coordinates', { places });
  return response.data;
};

export const calculateCloseness = async (sourceId, targetId) => {
  const response = await api.post('/closeness', { source_id: sourceId, target_id: targetId });
  return response.data;
};

export const getAllCloseness = async () => {
  const response = await api.get('/closeness/all');
  return response.data;
};

export default {
  extractEntities,
  extractAll,
  addEntity,
  addEntityWithResolution,
  deleteEntity,
  mergeEntities,
  getEntityAliases,
  findSimilarEntity,
  addRelationship,
  deleteRelationship,
  getGraph,
  addWorldSetting,
  getWorldSettings,
  generateRelationships,
  generateEvents,
  expandWorldSetting,
  autocompleteRelation,
  checkRelationshipConflict,
  checkWorldSettingConflict,
  addCustomAlias,
  resolveEntitiesList,
  exportJson,
  exportMarkdown,
  clearDatabase,
  importJson,
  checkHealth,
  extractTimeline,
  getTimeline,
  getGeoMap,
  getPlaceCoordinates,
  calculateCloseness,
  getAllCloseness,
};
