import { DataTypes, Model } from 'sequelize';
import { initInspectionDatabase } from '../../../shared/config/database';

const sequelize = initInspectionDatabase();

export class Inspection extends Model {
  public id!: string;
  public collectionId!: string;
  public inspectorId!: string;
  public inspectionType!: 'internal' | 'third_party';
  public items!: { name: string; value: string; standard?: string; unit?: string }[];
  public score!: number;
  public calculatedDetails!: any;
  public conclusion!: 'pass' | 'fail' | 'pending';
  public reportUrl?: string;
  public agencyId?: string;
  public readonly createdAt!: Date;
}

Inspection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    collectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'collection_id',
    },
    inspectorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'inspector_id',
    },
    inspectionType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'inspection_type',
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    conclusion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    calculatedDetails: {
      type: DataTypes.JSONB,
      field: 'calculated_details',
      defaultValue: [],
    },
    reportUrl: {
      type: DataTypes.STRING(500),
      field: 'report_url',
    },
    agencyId: {
      type: DataTypes.UUID,
      field: 'agency_id',
    },
  },
  {
    sequelize,
    tableName: 'inspections',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['collection_id'] },
      { fields: ['conclusion'] },
    ],
  }
);
