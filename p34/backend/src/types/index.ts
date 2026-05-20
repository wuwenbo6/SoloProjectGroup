import { Request } from 'express';
import { User, UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
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

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: UserRole;
  status?: 'ACTIVE' | 'INACTIVE' | 'BANNED';
}

export interface UploadMaterialRequest {
  name: string;
  description?: string;
  categoryId?: string;
  ethnicity?: string;
}

export interface ExtractFeatureRequest {
  materialId: string;
  manualContour?: number[][];
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

export interface CollaborativeMessage {
  type: 'cursor' | 'draw' | 'edit' | 'save' | 'join' | 'leave';
  userId: string;
  username: string;
  patternId: string;
  payload: any;
  timestamp: number;
}

export interface ActiveUser {
  userId: string;
  username: string;
  cursor: { x: number; y: number };
  color: string;
  socketId: string;
}
