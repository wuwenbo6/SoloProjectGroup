const axios = require('axios');
const QualityInspection = require('../models/quality/QualityInspection');

const thirdPartyApi = axios.create({
  baseURL: process.env.THIRD_PARTY_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.THIRD_PARTY_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

exports.sendInspectionToThirdParty = async (req, res) => {
  try {
    const { inspectionId } = req.params;

    const inspection = await QualityInspection.findById(inspectionId);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    const inspectionData = {
      inspectionCode: inspection.inspectionCode,
      batchCode: inspection.batchCode,
      craftCode: inspection.craftCode,
      inspectionType: inspection.inspectionType,
      inspectionTime: inspection.inspectionTime,
      items: inspection.items,
      overallResult: inspection.overallResult,
      defects: inspection.defects,
      images: inspection.images,
      inspectorName: inspection.inspectorName,
      remarks: inspection.remarks,
    };

    const response = await thirdPartyApi.post('/inspections', inspectionData);

    await QualityInspection.findByIdAndUpdate(inspectionId, {
      'thirdPartyInfo.organizationName': response.data.organizationName,
      'thirdPartyInfo.reportNumber': response.data.reportNumber,
      'thirdPartyInfo.reportDate': new Date(),
      'thirdPartyInfo.synced': true,
      'thirdPartyInfo.syncTime': new Date(),
    });

    res.status(200).json({
      success: true,
      message: '检测记录已成功同步到第三方检测机构',
      data: {
        reportNumber: response.data.reportNumber,
        organizationName: response.data.organizationName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '同步到第三方检测机构失败',
      error: error.message,
    });
  }
};

exports.receiveThirdPartyReport = async (req, res) => {
  try {
    const { inspectionCode, reportNumber, reportData, organizationName, result, remarks } = req.body;

    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.THIRD_PARTY_API_KEY) {
      return res.status(401).json({
        success: false,
        message: '无效的API密钥',
      });
    }

    if (!inspectionCode || !reportNumber) {
      return res.status(400).json({
        success: false,
        message: '检测编号和报告编号为必填项',
      });
    }

    const inspection = await QualityInspection.findOne({ inspectionCode });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '检测记录不存在',
      });
    }

    const updatedInspection = await QualityInspection.findOneAndUpdate(
      { inspectionCode },
      {
        'thirdPartyInfo.organizationName': organizationName,
        'thirdPartyInfo.reportNumber': reportNumber,
        'thirdPartyInfo.reportDate': new Date(),
        'thirdPartyInfo.synced': true,
        'thirdPartyInfo.syncTime': new Date(),
        overallResult: result || inspection.overallResult,
        $push: {
          correctiveActions: remarks ? {
            action: remarks,
            status: '待执行',
          } : undefined,
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: '第三方检测报告接收成功',
      data: {
        inspectionCode,
        reportNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '接收第三方检测报告失败',
      error: error.message,
    });
  }
};

exports.getThirdPartyReport = async (req, res) => {
  try {
    const { inspectionId } = req.params;

    const inspection = await QualityInspection.findById(inspectionId);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    if (!inspection.thirdPartyInfo || !inspection.thirdPartyInfo.reportNumber) {
      return res.status(404).json({
        success: false,
        message: '该检测记录暂无第三方检测报告',
      });
    }

    try {
      const response = await thirdPartyApi.get(`/inspections/${inspection.thirdPartyInfo.reportNumber}`);
      
      res.status(200).json({
        success: true,
        data: {
          localInfo: inspection.thirdPartyInfo,
          thirdPartyData: response.data,
        },
      });
    } catch (apiError) {
      res.status(200).json({
        success: true,
        data: {
          localInfo: inspection.thirdPartyInfo,
          thirdPartyData: null,
          note: '无法从第三方获取最新数据，显示本地缓存信息',
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取第三方检测报告失败',
      error: error.message,
    });
  }
};

exports.syncBatchInspections = async (req, res) => {
  try {
    const { batchId } = req.params;

    const inspections = await QualityInspection.find({ 
      batchId,
      inspectionType: '成品检验',
      'thirdPartyInfo.synced': false,
    });

    if (inspections.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该批次没有需要同步的检测记录',
      });
    }

    const syncResults = [];

    for (const inspection of inspections) {
      try {
        const inspectionData = {
          inspectionCode: inspection.inspectionCode,
          batchCode: inspection.batchCode,
          craftCode: inspection.craftCode,
          inspectionType: inspection.inspectionType,
          inspectionTime: inspection.inspectionTime,
          items: inspection.items,
          overallResult: inspection.overallResult,
          defects: inspection.defects,
          inspectorName: inspection.inspectorName,
        };

        const response = await thirdPartyApi.post('/inspections', inspectionData);

        await QualityInspection.findByIdAndUpdate(inspection._id, {
          'thirdPartyInfo.organizationName': response.data.organizationName,
          'thirdPartyInfo.reportNumber': response.data.reportNumber,
          'thirdPartyInfo.reportDate': new Date(),
          'thirdPartyInfo.synced': true,
          'thirdPartyInfo.syncTime': new Date(),
        });

        syncResults.push({
          inspectionId: inspection._id,
          inspectionCode: inspection.inspectionCode,
          success: true,
          reportNumber: response.data.reportNumber,
        });
      } catch (syncError) {
        syncResults.push({
          inspectionId: inspection._id,
          inspectionCode: inspection.inspectionCode,
          success: false,
          error: syncError.message,
        });
      }
    }

    const successCount = syncResults.filter(r => r.success).length;
    const failCount = syncResults.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `批次同步完成，成功: ${successCount}，失败: ${failCount}`,
      data: {
        total: syncResults.length,
        success: successCount,
        failed: failCount,
        results: syncResults,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批次同步失败',
      error: error.message,
    });
  }
};

exports.getThirdPartyOrganizations = async (req, res) => {
  try {
    const response = await thirdPartyApi.get('/organizations');

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取第三方检测机构列表失败',
      error: error.message,
    });
  }
};

exports.testThirdPartyConnection = async (req, res) => {
  try {
    const response = await thirdPartyApi.get('/health');

    res.status(200).json({
      success: true,
      message: '第三方检测机构连接正常',
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '第三方检测机构连接失败',
      error: error.message,
    });
  }
};