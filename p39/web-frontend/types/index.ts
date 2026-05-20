export interface Order {
  id?: number;
  orderNo?: string;
  userId?: number;
  artisanId?: number;
  requirementId?: number;
  title: string;
  description?: string;
  amount: number;
  status?: number;
  progress?: number;
  estimatedDelivery?: string;
  actualDelivery?: string;
  createTime?: string;
  updateTime?: string;
}

export interface Requirement {
  id?: number;
  userId?: number;
  title: string;
  description: string;
  craftType: string;
  budgetMin?: number;
  budgetMax?: number;
  deadline?: string;
  images?: string[];
  status?: number;
  selectedArtisanId?: number;
  viewCount?: number;
  createTime?: string;
}

export interface Artisan {
  id?: number;
  userId?: number;
  realName?: string;
  craftType?: string;
  title?: string;
  avatar?: string;
  bio?: string;
  experienceYears?: number;
  location?: string;
  avgRating?: number;
  orderCount?: number;
  status?: number;
  verifyTime?: string;
  createTime?: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export type OrderStatus = 1 | 2 | 3 | 4 | 5;
export type ArtisanStatus = 0 | 1 | 2;
