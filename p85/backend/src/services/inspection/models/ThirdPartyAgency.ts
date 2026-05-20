import { DataTypes, Model } from 'sequelize';
import { initInspectionDatabase } from '../../../shared/config/database';

const sequelize = initInspectionDatabase();

export class ThirdPartyAgency extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public apiKey!: string;
  public webhookUrl?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
}

ThirdPartyAgency.init(
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
    apiKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'api_key',
    },
    webhookUrl: {
      type: DataTypes.STRING(500),
      field: 'webhook_url',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'third_party_agencies',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);
