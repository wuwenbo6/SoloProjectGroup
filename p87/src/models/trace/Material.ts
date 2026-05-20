import { DataTypes, Model } from 'sequelize';
import { traceDB } from '../../config/databases';

export interface MaterialAttributes {
  id?: number;
  materialId: string;
  traceCode?: string;
  materialName: string;
  materialType: string;
  origin: string;
  supplierId: string;
  supplierName: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  qualityLevel?: string;
  certification?: string;
  purchaseDate: Date;
  expiryDate?: Date;
  status: 'in_stock' | 'used' | 'expired' | 'returned';
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Material extends Model<MaterialAttributes> implements MaterialAttributes {
  public id!: number;
  public materialId!: string;
  public traceCode?: string;
  public materialName!: string;
  public materialType!: string;
  public origin!: string;
  public supplierId!: string;
  public supplierName!: string;
  public batchNumber!: string;
  public quantity!: number;
  public unit!: string;
  public qualityLevel?: string;
  public certification?: string;
  public purchaseDate!: Date;
  public expiryDate?: Date;
  public status!: 'in_stock' | 'used' | 'expired' | 'returned';
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Material.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  materialId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  traceCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  materialName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  materialType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  supplierId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  supplierName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  batchNumber: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  qualityLevel: {
    type: DataTypes.STRING(50)
  },
  certification: {
    type: DataTypes.STRING(200)
  },
  purchaseDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  expiryDate: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('in_stock', 'used', 'expired', 'returned'),
    defaultValue: 'in_stock'
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize: traceDB,
  tableName: 'materials',
  timestamps: true
});

export default Material;
