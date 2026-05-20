import { Request, Response } from 'express';
import { CopyrightService, CopyrightRegistrationData } from '../services/CopyrightService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const copyrightService = new CopyrightService();

export const createRegistration = async (req: Request, res: Response) => {
  try {
    const creatorId = (req as any).user.userId;
    const result = await copyrightService.createRegistration(req.body as CopyrightRegistrationData, creatorId);
    return successResponse(res, result, '版权登记申请提交成功');
  } catch (error) {
    logger.error('Create copyright registration failed:', error);
    return errorResponse(res, '创建版权登记失败');
  }
};

export const getRegistrations = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const filters = {
      status: req.query.status as string,
      copyrightType: req.query.copyrightType as string,
    };
    const result = await copyrightService.getRegistrations(filters, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get registrations failed:', error);
    return errorResponse(res, '获取登记列表失败');
  }
};

export const getRegistrationById = async (req: Request, res: Response) => {
  try {
    const result = await copyrightService.getRegistrationById(req.params.id);
    if (!result) {
      return errorResponse(res, '登记记录不存在', 404);
    }
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get registration failed:', error);
    return errorResponse(res, '获取登记详情失败');
  }
};

export const updateRegistration = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const result = await copyrightService.updateRegistration(req.params.id, req.body, operatorId);
    return successResponse(res, result, '登记信息更新成功');
  } catch (error) {
    logger.error('Update registration failed:', error);
    return errorResponse(res, '更新登记信息失败');
  }
};

export const submitForReview = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const result = await copyrightService.submitForReview(req.params.id, operatorId);
    return successResponse(res, result, '已提交审核');
  } catch (error) {
    logger.error('Submit for review failed:', error);
    return errorResponse(res, '提交审核失败');
  }
};

export const reviewRegistration = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).user.userId;
    const { result, remarks } = req.body;
    const data = await copyrightService.reviewRegistration(
      req.params.id,
      reviewerId,
      result,
      remarks
    );
    return successResponse(res, data, result === 'REGISTERED' ? '审核通过，版权登记完成' : '审核不通过');
  } catch (error) {
    logger.error('Review registration failed:', error);
    return errorResponse(res, '审核操作失败');
  }
};

export const registerBlockchain = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const { txId } = req.body;
    const result = await copyrightService.registerBlockchain(req.params.id, txId, operatorId);
    return successResponse(res, result, '区块链存证成功');
  } catch (error) {
    logger.error('Blockchain registration failed:', error);
    return errorResponse(res, '区块链存证失败');
  }
};

export const uploadCertificate = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const { certificateUrl } = req.body;
    const result = await copyrightService.uploadCertificate(req.params.id, certificateUrl, operatorId);
    return successResponse(res, result, '证书上传成功');
  } catch (error) {
    logger.error('Upload certificate failed:', error);
    return errorResponse(res, '上传证书失败');
  }
};

export const deleteRegistration = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    await copyrightService.deleteRegistration(req.params.id, operatorId);
    return successResponse(res, null, '登记记录已删除');
  } catch (error) {
    logger.error('Delete registration failed:', error);
    return errorResponse(res, '删除登记记录失败');
  }
};

export const getMyRegistrations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await copyrightService.getMyRegistrations(userId, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get my registrations failed:', error);
    return errorResponse(res, '获取我的登记记录失败');
  }
};

export const getRegistrationLogs = async (req: Request, res: Response) => {
  try {
    const result = await copyrightService.getRegistrationLogs(req.params.id);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get registration logs failed:', error);
    return errorResponse(res, '获取操作日志失败');
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const result = await copyrightService.getStatistics();
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get statistics failed:', error);
    return errorResponse(res, '获取统计数据失败');
  }
};
