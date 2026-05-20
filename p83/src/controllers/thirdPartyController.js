const { v4: uuidv4 } = require('uuid');
const TestingAgency = require('../models/thirdparty/TestingAgency');
const thirdPartyService = require('../services/thirdPartyService');

const createTestingAgency = async (req, res) => {
  try {
    const agencyId = uuidv4();

    const agency = new TestingAgency({
      agencyId,
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await agency.save();

    return res.status(201).json({
      success: true,
      message: '检测机构创建成功',
      data: agency
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '机构代码或许可证编号已存在',
        code: 'DUPLICATE_AGENCY'
      });
    }
    return res.status(500).json({
      success: false,
      message: '创建检测机构失败',
      code: 'CREATE_ERROR',
      error: error.message
    });
  }
};

const getTestingAgencies = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { licenseNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [agencies, total] = await Promise.all([
      TestingAgency.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TestingAgency.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: '获取检测机构列表成功',
      data: {
        agencies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取检测机构列表失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getTestingAgencyById = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await TestingAgency.findOne({ agencyId: id });
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: '检测机构不存在',
        code: 'AGENCY_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取检测机构信息成功',
      data: agency
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取检测机构信息失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const updateTestingAgency = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await TestingAgency.findOne({ agencyId: id });
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: '检测机构不存在',
        code: 'AGENCY_NOT_FOUND'
      });
    }

    Object.assign(agency, req.body, {
      updatedBy: req.user.userId
    });

    await agency.save();

    return res.status(200).json({
      success: true,
      message: '检测机构信息更新成功',
      data: agency
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新检测机构信息失败',
      code: 'UPDATE_ERROR',
      error: error.message
    });
  }
};

const deleteTestingAgency = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await TestingAgency.findOneAndDelete({ agencyId: id });
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: '检测机构不存在',
        code: 'AGENCY_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '检测机构删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除检测机构失败',
      code: 'DELETE_ERROR',
      error: error.message
    });
  }
};

const syncQualityRecord = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { qualityId } = req.body;

    const result = await thirdPartyService.syncQualityRecordToThirdParty(qualityId, agencyId);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '同步品质数据失败',
      code: 'SYNC_ERROR',
      error: error.message
    });
  }
};

const fetchThirdPartyRecords = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const result = await thirdPartyService.fetchThirdPartyQualityRecords(agencyId, req.query);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取第三方检测数据失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const importThirdPartyRecord = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { externalId } = req.body;

    const result = await thirdPartyService.importThirdPartyQualityRecord(
      agencyId,
      externalId,
      req.user.userId
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '导入第三方检测数据失败',
      code: 'IMPORT_ERROR',
      error: error.message
    });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const signature = req.headers['x-webhook-signature'];

    const isValid = await thirdPartyService.verifyWebhookSignature(agencyId, req.body, signature);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '无效的Webhook签名',
        code: 'INVALID_SIGNATURE'
      });
    }

    const { eventType, data } = req.body;

    if (eventType === 'quality_record_created') {
      await thirdPartyService.importThirdPartyQualityRecord(
        agencyId,
        data.externalId || data.id,
        'system_webhook'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook处理成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Webhook处理失败',
      code: 'WEBHOOK_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  createTestingAgency,
  getTestingAgencies,
  getTestingAgencyById,
  updateTestingAgency,
  deleteTestingAgency,
  syncQualityRecord,
  fetchThirdPartyRecords,
  importThirdPartyRecord,
  handleWebhook
};
