import { Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { ThirdPartyAgency } from '../models/ThirdPartyAgency';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';

const createAgencySchema = Joi.object({
  name: Joi.string().max(200).required(),
  code: Joi.string().max(50).required(),
  webhookUrl: Joi.string().uri().optional(),
});

const updateAgencySchema = Joi.object({
  name: Joi.string().max(200).optional(),
  code: Joi.string().max(50).optional(),
  webhookUrl: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional(),
});

export const createAgency = async (req: Request, res: Response) => {
  try {
    const { error, value } = createAgencySchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const existingAgency = await ThirdPartyAgency.findOne({
      where: { code: value.code },
    });

    if (existingAgency) {
      return res.status(409).json(errorResponse('机构代码已存在', 409));
    }

    const agency = await ThirdPartyAgency.create({
      ...value,
      apiKey: uuidv4(),
    });

    logger.info(`Third party agency created: ${agency.name}`);

    res.status(201).json(successResponse(agency));
  } catch (err) {
    logger.error('Create agency error:', err);
    res.status(500).json(errorResponse('创建第三方机构失败', 500));
  }
};

export const getAgencies = async (req: Request, res: Response) => {
  try {
    const agencies = await ThirdPartyAgency.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });

    res.json(successResponse(agencies));
  } catch (err) {
    logger.error('Get agencies error:', err);
    res.status(500).json(errorResponse('获取第三方机构列表失败', 500));
  }
};

export const getAgencyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agency = await ThirdPartyAgency.findByPk(id);
    if (!agency) {
      return res.status(404).json(errorResponse('第三方机构不存在', 404));
    }

    res.json(successResponse(agency));
  } catch (err) {
    logger.error('Get agency error:', err);
    res.status(500).json(errorResponse('获取第三方机构详情失败', 500));
  }
};

export const updateAgency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateAgencySchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const agency = await ThirdPartyAgency.findByPk(id);
    if (!agency) {
      return res.status(404).json(errorResponse('第三方机构不存在', 404));
    }

    await agency.update(value);

    logger.info(`Third party agency updated: ${agency.name}`);

    res.json(successResponse(agency));
  } catch (err) {
    logger.error('Update agency error:', err);
    res.status(500).json(errorResponse('更新第三方机构失败', 500));
  }
};

export const regenerateApiKey = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agency = await ThirdPartyAgency.findByPk(id);
    if (!agency) {
      return res.status(404).json(errorResponse('第三方机构不存在', 404));
    }

    await agency.update({ apiKey: uuidv4() });

    logger.info(`API key regenerated for agency: ${agency.name}`);

    res.json(successResponse({ apiKey: agency.apiKey }));
  } catch (err) {
    logger.error('Regenerate API key error:', err);
    res.status(500).json(errorResponse('重新生成API密钥失败', 500));
  }
};
