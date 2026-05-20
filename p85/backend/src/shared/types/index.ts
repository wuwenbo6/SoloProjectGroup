export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserPayload {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export type UserRole = 
  | 'admin' 
  | 'material_manager' 
  | 'collector' 
  | 'inspector' 
  | 'batch_manager' 
  | 'third_party';

export interface Material {
  id: string;
  name: string;
  category: string;
  origin: string;
  originCoords?: { lat: number; lng: number };
  description: string;
  specifications: Record<string, string>;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CollectionRecord {
  id: string;
  materialId: string;
  materialName: string;
  collectorId: string;
  collectorName: string;
  collectionTime: string;
  location: string;
  quantity: number;
  unit: string;
  weather: string;
  notes: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
}

export interface InspectionRecord {
  id: string;
  collectionId: string;
  inspectorId: string;
  inspectorName: string;
  inspectionType: 'internal' | 'third_party';
  items: { name: string; value: string; standard?: string }[];
  conclusion: 'pass' | 'fail' | 'pending';
  reportUrl: string;
  thirdPartyAgency?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  materialId: string;
  materialName: string;
  collectionIds: string[];
  productionDate: string;
  quantity: number;
  unit: string;
  status: 'producing' | 'completed' | 'shipped';
  traceChain: TraceNode[];
  createdAt: string;
}

export interface TraceNode {
  type: 'material' | 'collection' | 'inspection' | 'batch';
  id: string;
  timestamp: string;
  operator: string;
  data: Record<string, any>;
}

export interface ThirdPartyAgency {
  id: string;
  name: string;
  code: string;
  apiKey: string;
  webhookUrl: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}
