import { DataTypes, Model } from 'sequelize';
import { initMaterialDatabase } from '../../../shared/config/database';

const sequelize = initMaterialDatabase();

export class Material extends Model {
  public id!: string;
  public name!: string;
  public category!: string;
  public origin!: string;
  public originCoords?: { lat: number; lng: number };
  public description!: string;
  public specifications!: Record<string, string>;
  public status!: 'active' | 'inactive';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Material.init(
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
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    origin: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    originCoords: {
      type: DataTypes.JSONB,
      field: 'origin_coords',
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    specifications: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    tableName: 'materials',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['category'] },
      { fields: ['status'] },
    ],
  }
);
