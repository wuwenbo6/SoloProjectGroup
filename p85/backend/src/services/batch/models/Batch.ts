import { DataTypes, Model } from 'sequelize';
import { initMaterialDatabase } from '../../../shared/config/database';

const sequelize = initMaterialDatabase();

export class Batch extends Model {
  public id!: string;
  public batchNo!: string;
  public materialId!: string;
  public productionDate!: Date;
  public expiryDate!: Date;
  public quantity!: number;
  public unit!: string;
  public status!: 'producing' | 'completed' | 'shipped' | 'expired';
  public warningLevel!: 'none' | 'warning' | 'critical';
  public warningSent!: boolean;
  public readonly createdAt!: Date;
}

Batch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    batchNo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'batch_no',
    },
    materialId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'material_id',
    },
    productionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'production_date',
    },
    expiryDate: {
      type: DataTypes.DATE,
      field: 'expiry_date',
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'producing',
    },
    warningLevel: {
      type: DataTypes.STRING(20),
      field: 'warning_level',
      defaultValue: 'none',
    },
    warningSent: {
      type: DataTypes.BOOLEAN,
      field: 'warning_sent',
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'batches',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['batch_no'], unique: true },
      { fields: ['status'] },
    ],
  }
);

export class BatchCollection extends Model {
  public batchId!: string;
  public collectionId!: string;
}

BatchCollection.init(
  {
    batchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'batch_id',
    },
    collectionId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'collection_id',
    },
  },
  {
    sequelize,
    tableName: 'batch_collections',
    timestamps: false,
    underscored: true,
  }
);
