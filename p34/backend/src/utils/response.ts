import { Response } from 'express';
import { ApiResponse, PaginationParams } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200
): Response<ApiResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: { page: number; pageSize: number; total: number },
  statusCode = 200
): Response<ApiResponse<T[]>> {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages,
    },
  });
}

export function sendError(
  res: Response,
  errorCode: string,
  message: string,
  statusCode = 400,
  details?: any
): Response<ApiResponse> {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details,
    },
  });
}
