import { DataTypes, Model } from 'sequelize';
import { qualityDB } from '../../config/databases';

export interface QualityInspectionAttributes {
  id?: number;
  inspectionId: string;
  traceCode?: string;
  batchId: string;
  inspectionType: 'in_process' | 'final' | 'sampling' | 'third_party';
  inspectorId: string;
  inspectorName: string;
  inspectionDate: Date;
  items: Array<{
    itemName: string;
    standard: string;
    result: string;
    isPass: boolean;
    remark?: string;
  }>;
  overallResult: 'pass' | 'fail' | 'pending';
  defects?: Array<{
    defectType: string;
    description: string;
    quantity: number;
    severity: 'minor' | 'major' | 'critical';
  }>;
  images?: string[];
  remark?: string;
  nextAction?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class QualityInspection extends Model<QualityInspectionAttributes> implements QualityInspectionAttributes {
  public id!: number;
  public inspectionId!: string;
  public traceCode?: string;
  public batchId!: string;
  public inspectionType!: 'in_process' | 'final' | 'sampling' | 'third_party';
  public inspectorId!: string;
  public inspectorName!: string;
  public inspectionDate!: Date;
  public items!: QualityInspectionAttributes['items'];
  public overallResult!: 'pass' | 'fail' | 'pending';
  public defects?: QualityInspectionAttributes['defects'];
  public images?: string[];
  public remark?: string;
  public nextAction?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

QualityInspection.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  inspectionId: {
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
  inspectionType: {
    type: DataTypes.ENUM('in_process', 'final', 'sampling', 'third_party'),
    allowNull: false
  },
  inspectorId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  inspectorName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  inspectionDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  overallResult: {
    type: DataTypes.ENUM('pass', 'fail', 'pending'),
    defaultValue: 'pending'
  },
  defects: {
    type: DataTypes.JSONB
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  },
  remark: {
    type: DataTypes.TEXT
  },
  nextAction: {
    type: DataTypes.TEXT
  }
}, {
  sequelize: qualityDB,
  tableName: 'quality_inspections',
  timestamps: true
});

export default QualityInspection;
