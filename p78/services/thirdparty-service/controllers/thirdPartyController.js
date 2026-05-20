const axios = require('axios');
const { successResponse, errorResponse } = require('../../../shared/utils/response');

const LAB_API_BASE = process.env.THIRD_PARTY_API_URL || 'https://api.testing-lab.com';
const LAB_API_KEY = process.env.THIRD_PARTY_API_KEY || 'test-api-key';

const labClients = new Map();

const initClients = () => {
  labClients.set('default', {
    baseURL: LAB_API_BASE,
    apiKey: LAB_API_KEY,
    enabled: true
  });
};

const FIELD_MAPPING = {
  taskId: 'task_id',
  batchId: 'batch_id',
  inspectionNo: 'inspection_no',
  inspectionType: 'inspection_type',
  materialName: 'material_name',
  materialCode: 'material_code',
  totalScore: 'total_score',
  qualityGrade: 'grade',
  isQualified: 'is_qualified',
  inspectorName: 'inspector_name',
  inspectionTime: 'inspection_time',
  reportNo: 'report_no',
  generatedAt: 'generated_at',
  labName: 'lab_name',
  overallResult: 'overall_result',
  inspectionItems: 'items',
  conclusion: 'conclusion',
  recommendations: 'recommendations',
  updatedAt: 'updated_at',
  createdAt: 'created_at'
};

const mapFields = (data, reverse = false) => {
  const result = {};
  const mapping = reverse ? Object.fromEntries(Object.entries(FIELD_MAPPING).map(([k, v]) => [v, k])) : FIELD_MAPPING;

  for (const [key, value] of Object.entries(data)) {
    const mappedKey = mapping[key] || key;
    if (value !== null && value !== undefined) {
      result[mappedKey] = value;
    }
  }
  return result;
};

const transformInspectionItem = (item) => {
  return {
    name: item.name || item.item_name || '',
    standard: item.standard || item.standard_value || '',
    result: item.result || item.test_result || '',
    status: item.status || item.passed ? 'PASS' : 'FAIL',
    score: item.score !== undefined ? item.score : item.test_score || 0,
    unit: item.unit || ''
  };
};

const createInspectionTask = async (req, res) => {
  try {
    const { batch_id, material_name, material_code, quantity, inspection_type, priority } = req.body;
    
    const taskData = {
      task_no: `INS${Date.now()}`,
      batch_id,
      material_name,
      material_code,
      quantity,
      inspection_type: inspection_type || 'FULL',
      priority: priority || 'NORMAL',
      requester: req.user.username,
      request_time: new Date().toISOString(),
      status: 'PENDING'
    };

    successResponse(res, {
      task_id: taskData.task_no,
      ...taskData,
      estimated_completion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      lab_name: '古法酿造质量检测中心'
    }, '检测任务创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getInspectionStatus = async (req, res) => {
  try {
    const { task_id } = req.params;
    
    const statuses = ['PENDING', 'IN_PROGRESS', 'SAMPLE_RECEIVED', 'TESTING', 'REPORT_GENERATING', 'COMPLETED'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    successResponse(res, {
      task_id,
      status: randomStatus,
      current_stage: '样品检测中',
      progress: Math.floor(Math.random() * 100),
      estimated_completion: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      lab_technician: '张工'
    }, '获取检测状态成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getInspectionReport = async (req, res) => {
  try {
    const { task_id } = req.params;
    
    const report = {
      task_id,
      report_no: `RPT${Date.now()}`,
      generated_at: new Date().toISOString(),
      lab_name: '古法酿造质量检测中心',
      inspector: '李检验师',
      overall_result: 'PASS',
      overall_score: 92.5,
      grade: 'GRADE_1',
      items: [
        { name: '水分', standard: '<=14%', result: '12.5%', status: 'PASS', score: 95 },
        { name: '杂质', standard: '<=0.5%', result: '0.3%', status: 'PASS', score: 98 },
        { name: '淀粉含量', standard: '>=60%', result: '65.2%', status: 'PASS', score: 92 },
        { name: '酸度', standard: '<=3.5', result: '2.8', status: 'PASS', score: 90 },
        { name: '感官评价', standard: '合格', result: '良好', status: 'PASS', score: 88 }
      ],
      conclusion: '该批次原料各项指标均符合古法酿造原料质量标准，准予入库使用。',
      recommendations: ['建议在阴凉干燥处储存', '储存期不超过6个月', '使用前进行二次抽检']
    };

    successResponse(res, report, '获取检测报告成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const webhookReceiver = async (req, res) => {
  try {
    const { event_type, task_id, data } = req.body;
    
    console.log(`收到第三方机构Webhook: ${event_type}, 任务ID: ${task_id}`);
    console.log('数据内容:', JSON.stringify(data, null, 2));
    
    const mappedData = mapFields(data, true);
    console.log('字段映射后数据:', JSON.stringify(mappedData, null, 2));
    
    successResponse(res, {
      received: true,
      event_type,
      task_id,
      mapped_data: mappedData,
      processed_at: new Date().toISOString()
    }, 'Webhook接收成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const syncInspectionData = async (req, res) => {
  try {
    const { start_date, end_date, status, sync_mode = 'FULL' } = req.body;
    
    const mockData = Array.from({ length: 5 }, (_, i) => ({
      task_id: `SYNC${Date.now()}${i}`,
      batch_id: `batch-${100 + i}`,
      inspection_no: `INS${Date.now()}${i}`,
      status: ['PENDING', 'IN_PROGRESS', 'COMPLETED'][i % 3],
      total_score: [95.5, 88.0, 92.5, 78.5, 85.0][i],
      grade: ['SPECIAL', 'GRADE_1', 'GRADE_1', 'GRADE_2', 'GRADE_1'][i],
      is_qualified: i < 4,
      inspector_name: ['张工', '李工', '王工', '赵工', '刘工'][i],
      inspection_time: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      inspection_items: [
        { name: '水分', standard: '<=14%', result: `${(10 + i * 0.5).toFixed(1)}%`, status: 'PASS', score: 95 - i * 2 },
        { name: '杂质', standard: '<=0.5%', result: `${(0.2 + i * 0.05).toFixed(2)}%`, status: 'PASS', score: 98 - i },
        { name: '淀粉含量', standard: '>=60%', result: `${(62 + i * 0.8).toFixed(1)}%`, status: 'PASS', score: 92 - i * 1.5 }
      ],
      updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    }));

    const normalizedData = mockData.map(item => mapFields(item));

    successResponse(res, {
      sync_time: new Date().toISOString(),
      sync_mode,
      start_date: start_date || null,
      end_date: end_date || null,
      record_count: normalizedData.length,
      records: normalizedData,
      field_mapping_applied: true
    }, '数据同步成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getLabs = async (req, res) => {
  try {
    const labs = [
      { id: 'lab-001', name: '古法酿造质量检测中心', address: '四川省泸州市', contact: '王主任', phone: '13800138000', capabilities: ['原料检测', '成分分析', '微生物检测'] },
      { id: 'lab-002', name: '国家粮食质量检测中心', address: '北京市朝阳区', contact: '李科长', phone: '13900139000', capabilities: ['全项检测', '农药残留', '重金属检测'] }
    ];
    successResponse(res, labs, '获取检测机构列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initClients,
  createInspectionTask,
  getInspectionStatus,
  getInspectionReport,
  webhookReceiver,
  syncInspectionData,
  getLabs,
  mapFields
};
