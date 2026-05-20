import { DataTypes, Model } from 'sequelize';
import { qualityDB } from '../../config/databases';

export interface ThirdPartyReportAttributes {
  id?: number;
  reportId: string;
  traceCode?: string;
  batchId: string;
  agencyId: string;
  agencyName: string;
  reportNumber: string;
  reportDate: Date;
  reportUrl?: string;
  reportPdf?: string;
  testItems: Array<{
    itemName: string;
    testMethod: string;
    standard: string;
    result: string;
    unit?: string;
    isPass: boolean;
  }>;
  conclusion: 'qualified' | 'unqualified' | 'conditional';
  inspectorName?: string;
  reviewerName?: string;
  syncedAt?: Date;
  syncStatus: 'pending' | 'success' | 'failed';
  syncError?: string;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ThirdPartyReport extends Model<ThirdPartyReportAttributes> implements ThirdPartyReportAttributes {
  public id!: number;
  public reportId!: string;
  public traceCode?: string;
  public batchId!: string;
  public agencyId!: string;
  public agencyName!: string;
  public reportNumber!: string;
  public reportDate!: Date;
  public reportUrl?: string;
  public reportPdf?: string;
  public testItems!: ThirdPartyReportAttributes['testItems'];
  public conclusion!: 'qualified' | 'unqualified' | 'conditional';
  public inspectorName?: string;
  public reviewerName?: string;
  public syncedAt?: Date;
  public syncStatus!: 'pending' | 'success' | 'failed';
  public syncError?: string;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ThirdPartyReport.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reportId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  traceCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  batchId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  agencyId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  agencyName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  reportNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  reportDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  reportUrl: {
    type: DataTypes.STRING(500)
  },
  reportPdf: {
    type: DataTypes.TEXT
  },
  testItems: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  conclusion: {
    type: DataTypes.ENUM('qualified', 'unqualified', 'conditional'),
    allowNull: false
  },
  inspectorName: {
    type: DataTypes.STRING(100)
  },
  reviewerName: {
    type: DataTypes.STRING(100)
  },
  syncedAt: {
    type: DataTypes.DATE
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending'
  },
  syncError: {
    type: DataTypes.TEXT
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize: qualityDB,
  tableName: 'third_party_reports',
  timestamps: true
});

export default ThirdPartyReport;
