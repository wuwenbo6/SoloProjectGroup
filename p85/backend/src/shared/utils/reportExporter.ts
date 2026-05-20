import * as fs from 'fs';
import * as path from 'path';
import logger from '../middleware/logger';

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  columns: { key: string; title: string }[];
  filename?: string;
}

function convertToCSV(data: any[], columns: { key: string; title: string }[]): string {
  const headers = columns.map((c) => c.title).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        let value = row[col.key] ?? '';
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',')
  );
  return [headers, ...rows].join('\n');
}

function convertToJSON(data: any[]): string {
  return JSON.stringify(data, null, 2);
}

function formatDate(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDateTime(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

export function exportReport(data: any[], options: ExportOptions): Buffer {
  const { format, columns } = options;

  let content: string;
  let contentType: string;

  switch (format) {
    case 'csv':
      content = convertToCSV(data, columns);
      contentType = 'text/csv; charset=utf-8';
      break;
    case 'json':
      content = convertToJSON(data);
      contentType = 'application/json; charset=utf-8';
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  return Buffer.from('\uFEFF' + content, 'utf8');
}

export function generateCollectionReport(collections: any[]): {
  data: any[];
  columns: { key: string; title: string }[];
} {
  const columns = [
    { key: 'index', title: '序号' },
    { key: 'batchNo', title: '采集批次号' },
    { key: 'materialName', title: '原料名称' },
    { key: 'collector', title: '采集人员' },
    { key: 'location', title: '采集地点' },
    { key: 'quantity', title: '采集数量' },
    { key: 'unit', title: '单位' },
    { key: 'weather', title: '天气情况' },
    { key: 'collectionDate', title: '采集日期' },
    { key: 'syncStatus', title: '同步状态' },
    { key: 'createdAt', title: '创建时间' },
  ];

  const data = collections.map((item, index) => ({
    index: index + 1,
    batchNo: item.batchNo || '',
    materialName: item.materialName || '',
    collector: item.collectorName || '',
    location: item.location || '',
    quantity: item.quantity || 0,
    unit: item.unit || '',
    weather: item.weather || '',
    collectionDate: formatDate(item.collectionDate),
    syncStatus: item.syncStatus === 'synced' ? '已同步' : item.syncStatus === 'pending' ? '待同步' : '失败',
    createdAt: formatDateTime(item.createdAt),
  }));

  return { data, columns };
}

export function generateStatisticsSummary(collections: any[]): any {
  const total = collections.length;
  const synced = collections.filter((c) => c.syncStatus === 'synced').length;
  const pending = collections.filter((c) => c.syncStatus === 'pending').length;
  const totalQuantity = collections.reduce((sum, c) => sum + (c.quantity || 0), 0);

  return {
    exportTime: new Date().toISOString(),
    totalRecords: total,
    syncedRecords: synced,
    pendingRecords: pending,
    syncRate: total > 0 ? ((synced / total) * 100).toFixed(2) + '%' : '0%',
    totalQuantity,
    reportPeriod: '全部',
  };
}

export function saveReportToFile(buffer: Buffer, filename: string): string {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, buffer);

  logger.info(`Report saved to: ${filePath}`);
  return filePath;
}
