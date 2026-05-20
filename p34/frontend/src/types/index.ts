export type UserRole = 'collector' | 'designer' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'active' | 'inactive' | 'banned';
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type MaterialStatus = 'pending' | 'processing' | 'processed' | 'error';

export interface PatternMaterial {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  ethnicity?: string;
  imageUrl: string;
  thumbnailUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  fileSize?: number;
  status: MaterialStatus;
  errorMessage?: string;
  uploadedBy: string;
  uploadedByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface UploadMaterialRequest {
  name: string;
  description?: string;
  categoryId?: string;
  ethnicity?: string;
  file: File;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  ethnicity?: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatternFeature {
  id: string;
  materialId: string;
  material?: PatternMaterial;
  contourData: string;
  colorPalette: string[];
  textureFeatures: Record<string, number>;
  geometricParams: {
    aspectRatio: number;
    complexity: number;
    symmetry: number;
  };
  isManual: boolean;
  extractedBy: string;
  extractedByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractFeatureRequest {
  materialId: string;
  manualContour?: number[][];
}

export interface GeneratedPattern {
  id: string;
  name: string;
  baseFeatureIds: string[];
  baseFeatures?: PatternFeature[];
  parameters: {
    scale: number;
    rotation: number;
    density: number;
    colorScheme: string[];
  };
  previewUrl: string;
  highResUrl?: string;
  isPublic: boolean;
  createdBy: string;
  createdByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePatternRequest {
  featureIds: string[];
  parameters: {
    scale: number;
    rotation: number;
    density: number;
    colorScheme: string[];
  };
}

export interface UserOperation {
  id: string;
  userId: string;
  user?: User;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface CollaborativeSession {
  id: string;
  patternId: string;
  activeUsers: Array<{
    userId: string;
    username: string;
    cursor: { x: number; y: number };
    color: string;
  }>;
  lastActivity: string;
  createdAt: string;
}

export type CollaborativeMessageType = 'cursor' | 'draw' | 'edit' | 'save' | 'join' | 'leave';

export interface CollaborativeMessage {
  type: CollaborativeMessageType;
  userId: string;
  username: string;
  patternId: string;
  payload: any;
  timestamp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Permission {
  id: string;
  userId: string;
  module: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}
