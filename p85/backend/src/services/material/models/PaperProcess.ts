import { DataTypes, Model } from 'sequelize';
import { initMaterialDatabase } from '../../../shared/config/database';

const sequelize = initMaterialDatabase();

export class PaperProcess extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public description!: string;
  public originRegions!: string[];
  public steps!: { order: number; name: string; description: string; duration?: string }[];
  public materials!: { materialId: string; usage: string; quantity?: number; unit?: string }[];
  public qualityStandards!: Record<string, string>;
  public traditional!: boolean;
  public difficulty!: 'easy' | 'medium' | 'hard' | 'expert';
  public status!: 'active' | 'inactive' | 'deprecated';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaperProcess.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    originRegions: {
      type: DataTypes.ARRAY(DataTypes.STRING(200)),
      field: 'origin_regions',
      defaultValue: [],
    },
    steps: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    materials: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    qualityStandards: {
      type: DataTypes.JSONB,
      field: 'quality_standards',
      defaultValue: {},
    },
    traditional: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    difficulty: {
      type: DataTypes.STRING(20),
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    tableName: 'paper_processes',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['status'] },
      { fields: ['traditional'] },
    ],
  }
);

export class MaterialProcessMap extends Model {
  public materialId!: string;
  public processId!: string;
  public usageRatio!: number;
  public notes!: string;
}

MaterialProcessMap.init(
  {
    materialId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'material_id',
      references: {
        model: 'materials',
        key: 'id',
      },
    },
    processId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'process_id',
      references: {
        model: 'paper_processes',
        key: 'id',
      },
    },
    usageRatio: {
      type: DataTypes.FLOAT,
      field: 'usage_ratio',
      defaultValue: 1.0,
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
  },
  {
    sequelize,
    tableName: 'material_process_maps',
    timestamps: false,
    underscored: true,
  }
);
