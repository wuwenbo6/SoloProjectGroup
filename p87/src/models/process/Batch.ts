import { DataTypes, Model } from 'sequelize';
import { processDB } from '../../config/databases';

export interface BatchAttributes {
  id?: number;
  batchId: string;
  traceCode?: string;
  batchName?: string;
  craftId: string;
  quantity: number;
  startDate: Date;
  estimatedEndDate?: Date;
  actualEndDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'suspended';
  workshopId: string;
  workshopName: string;
  supervisorId: string;
  supervisorName: string;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Batch extends Model<BatchAttributes> implements BatchAttributes {
  public id!: number;
  public batchId!: string;
  public traceCode?: string;
  public batchName?: string;
  public craftId!: string;
  public quantity!: number;
  public startDate!: Date;
  public estimatedEndDate?: Date;
  public actualEndDate?: Date;
  public status!: 'pending' | 'in_progress' | 'completed' | 'suspended';
  public workshopId!: string;
  public workshopName!: string;
  public supervisorId!: string;
  public supervisorName!: string;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Batch.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batchId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  traceCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  batchName: {
    type: DataTypes.STRING(100)
  },
  craftId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  estimatedEndDate: {
    type: DataTypes.DATE
  },
  actualEndDate: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'suspended'),
    defaultValue: 'pending'
  },
  workshopId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  workshopName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  supervisorId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  supervisorName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize: processDB,
  tableName: 'batches',
  timestamps: true
});

export default Batch;
