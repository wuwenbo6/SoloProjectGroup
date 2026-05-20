import { ApiResponse } from '../types';

export function successResponse<T>(data: T, message: string = 'success'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
    timestamp: Date.now(),
  };
}

export function errorResponse(message: string, code: number = 400): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
    timestamp: Date.now(),
  };
}

export function paginatedResponse<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number
): ApiResponse<{ list: T[]; total: number; page: number; pageSize: number }> {
  return {
    code: 200,
    message: 'success',
    data: { list, total, page, pageSize },
    timestamp: Date.now(),
  };
}
