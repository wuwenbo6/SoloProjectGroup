import { DataTypes, Model } from 'sequelize';
import { traceDB } from '../../config/databases';

export interface ProductionRecordAttributes {
  id?: number;
  recordId: string;
  traceCode?: string;
  batchId: string;
  stepNumber: number;
  stepName: string;
  startTime: Date;
  endTime?: Date;
  operatorId: string;
  operatorName: string;
  workshopId: string;
  workshopName: string;
  materialsUsed?: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
  }>;
  toolsUsed?: string[];
  environmentParams?: {
    temperature?: number;
    humidity?: number;
    ventilation?: string;
  };
  processParameters?: Record<string, any>;
  status: 'in_progress' | 'completed' | 'paused' | 'failed';
  qualityCheck?: {
    checked: boolean;
    result?: 'pass' | 'fail';
    inspector?: string;
    checkTime?: Date;
    remark?: string;
  };
  images?: string[];
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ProductionRecord extends Model<ProductionRecordAttributes> implements ProductionRecordAttributes {
  public id!: number;
  public recordId!: string;
  public traceCode?: string;
  public batchId!: string;
  public stepNumber!: number;
  public stepName!: string;
  public startTime!: Date;
  public endTime?: Date;
  public operatorId!: string;
  public operatorName!: string;
  public workshopId!: string;
  public workshopName!: string;
  public materialsUsed?: ProductionRecordAttributes['materialsUsed'];
  public toolsUsed?: string[];
  public environmentParams?: ProductionRecordAttributes['environmentParams'];
  public processParameters?: Record<string, any>;
  public status!: 'in_progress' | 'completed' | 'paused' | 'failed';
  public qualityCheck?: ProductionRecordAttributes['qualityCheck'];
  public images?: string[];
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProductionRecord.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recordId: {
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
  stepNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stepName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE
  },
  operatorId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  operatorName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  workshopId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  workshopName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  materialsUsed: {
    type: DataTypes.JSONB
  },
  toolsUsed: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  },
  environmentParams: {
    type: DataTypes.JSONB
  },
  processParameters: {
    type: DataTypes.JSONB
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'paused', 'failed'),
    defaultValue: 'in_progress'
  },
  qualityCheck: {
    type: DataTypes.JSONB
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize: traceDB,
  tableName: 'production_records',
  timestamps: true
});

export default ProductionRecord;
