import { DataTypes, Model } from 'sequelize';
import { initCollectionDatabase } from '../../../shared/config/database';

const sequelize = initCollectionDatabase();

export class Collection extends Model {
  public id!: string;
  public materialId!: string;
  public collectorId!: string;
  public collectionTime!: Date;
  public location!: string;
  public quantity!: number;
  public unit!: string;
  public weather?: string;
  public notes?: string;
  public syncStatus!: 'pending' | 'synced' | 'failed';
  public readonly createdAt!: Date;
}

Collection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    materialId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'material_id',
    },
    collectorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'collector_id',
    },
    collectionTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'collection_time',
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    weather: {
      type: DataTypes.STRING(100),
    },
    notes: {
      type: DataTypes.TEXT,
    },
    syncStatus: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      field: 'sync_status',
    },
  },
  {
    sequelize,
    tableName: 'collections',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['material_id'] },
      { fields: ['collector_id'] },
      { fields: ['sync_status'] },
    ],
  }
);
