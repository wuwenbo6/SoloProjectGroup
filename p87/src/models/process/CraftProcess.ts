import { DataTypes, Model } from 'sequelize';
import { processDB } from '../../config/databases';

export interface CraftProcessAttributes {
  id?: number;
  craftId: string;
  craftName: string;
  craftType: string;
  description?: string;
  steps: Array<{
    stepNumber: number;
    stepName: string;
    description: string;
    duration?: number;
    tools?: string[];
  }>;
  materials: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
  }>;
  artisanId: string;
  artisanName: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  createdAt?: Date;
  updatedAt?: Date;
}

class CraftProcess extends Model<CraftProcessAttributes> implements CraftProcessAttributes {
  public id!: number;
  public craftId!: string;
  public craftName!: string;
  public craftType!: string;
  public description?: string;
  public steps!: CraftProcessAttributes['steps'];
  public materials!: CraftProcessAttributes['materials'];
  public artisanId!: string;
  public artisanName!: string;
  public version!: string;
  public status!: 'draft' | 'active' | 'deprecated';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CraftProcess.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  craftId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  craftName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  craftType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  steps: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  materials: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  artisanId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  artisanName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'deprecated'),
    defaultValue: 'draft'
  }
}, {
  sequelize: processDB,
  tableName: 'craft_processes',
  timestamps: true
});

export default CraftProcess;
