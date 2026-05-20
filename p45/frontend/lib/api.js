import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const getStats = async () => {
  const res = await api.get('/stats');
  return res.data;
};

export const getBlocks = async (page = 0, size = 20) => {
  const res = await api.get(`/blocks?page=${page}&size=${size}`);
  return res.data;
};

export const getBlockByNumber = async (number) => {
  const res = await api.get(`/blocks/number/${number}`);
  return res.data;
};

export const getTransactions = async (page = 0, size = 20) => {
  const res = await api.get(`/transactions?page=${page}&size=${size}`);
  return res.data;
};

export const getTransactionByHash = async (hash) => {
  const res = await api.get(`/transactions/hash/${hash}`);
  return res.data;
};

export const getPrivateTransactions = async (page = 0, size = 20) => {
  const res = await api.get(`/transactions/private?page=${page}&size=${size}`);
  return res.data;
};

export const getPrivacyParticipants = async (transactionHash) => {
  const res = await api.get(`/privacy/participants/${transactionHash}`);
  return res.data;
};

export const decryptPayload = async (encryptedPayload, orgName, privateKey) => {
  const res = await api.post('/privacy/decrypt', null, {
    params: { encryptedPayload, orgName, privateKey }
  });
  return res.data;
};

export const getAllOrgPublicKeys = async () => {
  const res = await api.get('/privacy/orgs/public-keys');
  return res.data;
};

export const getContractCalls = async (contractAddress) => {
  const res = await api.get(`/contract-calls/${contractAddress}`);
  return res.data;
};

export const getAllContractAddresses = async () => {
  const res = await api.get('/contract-calls/addresses');
  return res.data;
};

export const getTransactionFlowGraph = async (limit = 1000) => {
  const res = await api.get(`/transaction-flow/graph?limit=${limit}`);
  return res.data;
};

export const getTransactionFlowPatterns = async (limit = 1000) => {
  const res = await api.get(`/transaction-flow/patterns?limit=${limit}`);
  return res.data;
};

export const getTransactionFlowStatistics = async (limit = 1000) => {
  const res = await api.get(`/transaction-flow/statistics?limit=${limit}`);
  return res.data;
};

export const getContractScanDashboard = async () => {
  const res = await api.get('/contract-scan/dashboard');
  return res.data;
};

export const getScanResults = async () => {
  const res = await api.get('/contract-scan/results');
  return res.data;
};

export const getScanResult = async (contractAddress) => {
  const res = await api.get(`/contract-scan/result/${contractAddress}`);
  return res.data;
};

export const getVulnerabilities = async (contractAddress) => {
  const res = await api.get(`/contract-scan/vulnerabilities/${contractAddress}`);
  return res.data;
};

export const getHighRiskVulnerabilities = async () => {
  const res = await api.get('/contract-scan/high-risk');
  return res.data;
};

export const scanContract = async (contractAddress) => {
  const res = await api.post('/contract-scan/scan', null, {
    params: { contractAddress }
  });
  return res.data;
};

export default api;