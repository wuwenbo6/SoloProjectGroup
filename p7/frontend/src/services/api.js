const API_BASE = '/api';

export const createDocument = async (name, initialContent = '') => {
  const response = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, initialContent }),
  });
  return response.json();
};

export const getDocument = async (id) => {
  const response = await fetch(`${API_BASE}/documents/${id}`);
  if (!response.ok) {
    throw new Error('Document not found');
  }
  return response.json();
};

export const getSnapshots = async (documentId) => {
  const response = await fetch(`${API_BASE}/documents/${documentId}/snapshots`);
  return response.json();
};

export const revertToSnapshot = async (documentId, snapshotId) => {
  const response = await fetch(`${API_BASE}/documents/${documentId}/revert/${snapshotId}`, {
    method: 'POST',
  });
  return response.json();
};
