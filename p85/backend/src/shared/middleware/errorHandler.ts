import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from './logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(`Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json(errorResponse(err.message, 400));
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json(errorResponse('未授权访问', 401));
  }

  res.status(500).json(errorResponse('服务器内部错误', 500));
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(errorResponse('接口不存在', 404));
}
