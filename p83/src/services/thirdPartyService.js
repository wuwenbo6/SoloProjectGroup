const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const TestingAgency = require('../models/thirdparty/TestingAgency');
const QualityRecord = require('../models/quality/QualityRecord');
const fieldMapper = require('../utils/fieldMapper');
const precisionUtils = require('../utils/precisionUtils');

class ThirdPartyService {
  constructor() {
    this.clients = new Map();
  }

  async getClient(agencyId) {
    if (this.clients.has(agencyId)) {
      return this.clients.get(agencyId);
    }

    const agency = await TestingAgency.findOne({ agencyId, status: 'active' });
    if (!agency) {
      throw new Error('检测机构不存在或未激活');
    }

    const client = axios.create({
      baseURL: agency.apiConfig.baseUrl,
      timeout: agency.apiConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': agency.apiConfig.apiKey
      }
    });

    this.clients.set(agencyId, { client, agency });
    return { client, agency };
  }

  async syncQualityRecordToThirdParty(qualityId, agencyId) {
    try {
      const qualityRecord = await QualityRecord.findOne({ qualityId });
      if (!qualityRecord) {
        throw new Error('品质检测记录不存在');
      }

      const { client, agency } = await this.getClient(agencyId);

      const internalData = {
        qualityId,
        materialId: qualityRecord.materialId,
        batchId: qualityRecord.batchId,
        inspectionType: qualityRecord.inspectionType,
        inspector: qualityRecord.inspector,
        testItems: qualityRecord.testItems,
        overallResult: qualityRecord.overallResult,
        qualityScore: qualityRecord.qualityScore,
        defects: qualityRecord.defects,
        inspectionDate: qualityRecord.inspectionDate,
        reportUrl: qualityRecord.reportUrl,
        testingAgency: qualityRecord.testingAgency,
        source: 'internal_system',
        syncedAt: new Date()
      };

      const syncData = fieldMapper.mapToExternal(internalData, agency.code || agencyId);

      const response = await client.post('/api/v1/quality-records', syncData);

      qualityRecord.syncedToThirdParty = true;
      qualityRecord.thirdPartySyncTime = new Date();
      qualityRecord.thirdPartyReferenceId = response.data.id || response.data.referenceId || response.data.record_id || qualityId;
      await qualityRecord.save();

      await TestingAgency.findOneAndUpdate(
        { agencyId },
        {
          $inc: { 'syncStats.totalRecords': 1, 'syncStats.successfulSyncs': 1 },
          lastSyncTime: new Date(),
          lastSyncStatus: 'success'
        }
      );

      return {
        success: true,
        message: '品质数据同步到第三方成功',
        referenceId: qualityRecord.thirdPartyReferenceId,
        syncData
      };
    } catch (error) {
      await TestingAgency.findOneAndUpdate(
        { agencyId },
        {
          $inc: { 'syncStats.failedSyncs': 1 },
          lastSyncTime: new Date(),
          lastSyncStatus: 'failed'
        }
      );

      return {
        success: false,
        message: '同步到第三方失败',
        error: error.message
      };
    }
  }

  async fetchThirdPartyQualityRecords(agencyId, params = {}) {
    try {
      const { client } = await this.getClient(agencyId);

      const response = await client.get('/api/v1/quality-records', { params });

      const rawData = response.data;
      const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || rawData.records || rawData.results || []);

      const mappedData = dataArray.map(item => 
        fieldMapper.mapToInternal(item, agencyId)
      );

      return {
        success: true,
        data: mappedData,
        rawData
      };
    } catch (error) {
      return {
        success: false,
        message: '获取第三方检测数据失败',
        error: error.message
      };
    }
  }

  async importThirdPartyQualityRecord(agencyId, externalId, userId) {
    try {
      const { client } = await this.getClient(agencyId);

      const response = await client.get(`/api/v1/quality-records/${externalId}`);
      const externalData = response.data;

      const mappedData = fieldMapper.mapToInternal(externalData, agencyId);

      const processedTestItems = precisionUtils.processTestItems(mappedData.testItems || []);
      const calculatedQualityScore = precisionUtils.roundToDecimalPlaces(
        mappedData.qualityScore || precisionUtils.calculateQualityScore(processedTestItems),
        2
      );

      const qualityId = uuidv4();

      const qualityRecord = new QualityRecord({
        qualityId,
        materialId: mappedData.materialId,
        batchId: mappedData.batchId,
        inspectionType: mappedData.inspectionType || 'third_party',
        testingAgency: {
          agencyId,
          name: mappedData.testingAgency?.name || mappedData.testingAgency,
          licenseNumber: mappedData.testingAgency?.licenseNumber,
          isThirdParty: true
        },
        inspector: mappedData.inspector,
        testItems: processedTestItems,
        overallResult: mappedData.overallResult || 'pending',
        qualityScore: calculatedQualityScore,
        defects: mappedData.defects || [],
        inspectionDate: mappedData.inspectionDate || new Date(),
        reportUrl: mappedData.reportUrl,
        status: 'submitted',
        thirdPartyReferenceId: mappedData.qualityId || externalId,
        syncedToThirdParty: true,
        thirdPartySyncTime: new Date(),
        createdBy: userId,
        updatedBy: userId
      });

      await qualityRecord.save();

      await TestingAgency.findOneAndUpdate(
        { agencyId },
        {
          $inc: { 'syncStats.totalRecords': 1, 'syncStats.successfulSyncs': 1 },
          lastSyncTime: new Date(),
          lastSyncStatus: 'success'
        }
      );

      return {
        success: true,
        message: '第三方检测数据导入成功',
        data: qualityRecord,
        mappedData
      };
    } catch (error) {
      await TestingAgency.findOneAndUpdate(
        { agencyId },
        {
          $inc: { 'syncStats.failedSyncs': 1 },
          lastSyncTime: new Date(),
          lastSyncStatus: 'failed'
        }
      );

      return {
        success: false,
        message: '导入第三方检测数据失败',
        error: error.message
      };
    }
  }

  async bulkImportFromThirdParty(agencyId, userId, params = {}) {
    try {
      const fetchResult = await this.fetchThirdPartyQualityRecords(agencyId, params);
      if (!fetchResult.success) {
        return fetchResult;
      }

      const importedRecords = [];
      const failedRecords = [];

      for (const record of fetchResult.data) {
        try {
          const externalId = record.qualityId || record.id;
          
          const existingRecord = await QualityRecord.findOne({ thirdPartyReferenceId: externalId });
          if (existingRecord) {
            continue;
          }

          const processedTestItems = precisionUtils.processTestItems(record.testItems || []);
          const qualityId = uuidv4();

          const qualityRecord = new QualityRecord({
            qualityId,
            materialId: record.materialId,
            batchId: record.batchId,
            inspectionType: record.inspectionType || 'third_party',
            testingAgency: {
              agencyId,
              name: record.testingAgency?.name || record.testingAgency,
              isThirdParty: true
            },
            testItems: processedTestItems,
            overallResult: record.overallResult || 'pending',
            qualityScore: precisionUtils.roundToDecimalPlaces(record.qualityScore, 2),
            defects: record.defects || [],
            inspectionDate: record.inspectionDate || new Date(),
            reportUrl: record.reportUrl,
            status: 'submitted',
            thirdPartyReferenceId: externalId,
            syncedToThirdParty: true,
            thirdPartySyncTime: new Date(),
            createdBy: userId,
            updatedBy: userId
          });

          await qualityRecord.save();
          importedRecords.push(qualityRecord);
        } catch (recordError) {
          failedRecords.push({
            record,
            error: recordError.message
          });
        }
      }

      return {
        success: true,
        message: `批量导入完成：成功${importedRecords.length}条，失败${failedRecords.length}条`,
        importedCount: importedRecords.length,
        failedCount: failedRecords.length,
        importedRecords,
        failedRecords
      };
    } catch (error) {
      return {
        success: false,
        message: '批量导入第三方检测数据失败',
        error: error.message
      };
    }
  }

  async sendWebhookNotification(agencyId, eventType, payload) {
    try {
      const agency = await TestingAgency.findOne({ agencyId });
      if (!agency || !agency.syncSettings.webhookEnabled || !agency.syncSettings.webhookUrl) {
        return { success: false, message: 'Webhook未配置或未启用' };
      }

      const mappedPayload = fieldMapper.mapToExternal(payload, agency.code || agencyId);

      const webhookPayload = {
        eventType,
        timestamp: new Date().toISOString(),
        agencyId,
        data: mappedPayload
      };

      const signature = this.generateWebhookSignature(webhookPayload, agency.syncSettings.webhookSecret);

      await axios.post(agency.syncSettings.webhookUrl, webhookPayload, {
        headers: {
          'X-Webhook-Signature': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { success: true, message: 'Webhook通知发送成功' };
    } catch (error) {
      return {
        success: false,
        message: 'Webhook通知发送失败',
        error: error.message
      };
    }
  }

  generateWebhookSignature(payload, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    return hmac.update(JSON.stringify(payload)).digest('hex');
  }

  async verifyWebhookSignature(agencyId, payload, receivedSignature) {
    const agency = await TestingAgency.findOne({ agencyId });
    if (!agency) {
      return false;
    }

    const expectedSignature = this.generateWebhookSignature(payload, agency.syncSettings.webhookSecret);
    return expectedSignature === receivedSignature;
  }

  async handleIncomingWebhook(agencyId, payload) {
    try {
      const mappedData = fieldMapper.mapToInternal(payload.data || payload, agencyId);

      if (payload.eventType === 'quality_record_created' || payload.eventType === 'qc_record_updated') {
        const processedTestItems = precisionUtils.processTestItems(mappedData.testItems || []);
        const qualityId = uuidv4();

        const qualityRecord = new QualityRecord({
          qualityId,
          materialId: mappedData.materialId,
          batchId: mappedData.batchId,
          inspectionType: mappedData.inspectionType || 'third_party',
          testingAgency: { agencyId, isThirdParty: true },
          testItems: processedTestItems,
          overallResult: mappedData.overallResult || 'pending',
          qualityScore: precisionUtils.roundToDecimalPlaces(mappedData.qualityScore, 2),
          defects: mappedData.defects || [],
          inspectionDate: mappedData.inspectionDate || new Date(),
          reportUrl: mappedData.reportUrl,
          status: 'submitted',
          thirdPartyReferenceId: mappedData.qualityId || mappedData.id,
          syncedToThirdParty: true,
          thirdPartySyncTime: new Date(),
          createdBy: 'system_webhook',
          updatedBy: 'system_webhook'
        });

        await qualityRecord.save();

        return {
          success: true,
          message: 'Webhook数据处理成功',
          data: qualityRecord
        };
      }

      return {
        success: true,
        message: 'Webhook事件已接收但未处理',
        eventType: payload.eventType
      };
    } catch (error) {
      return {
        success: false,
        message: 'Webhook数据处理失败',
        error: error.message
      };
    }
  }
}

module.exports = new ThirdPartyService();
