import { DataTypes, Model } from 'sequelize';
import { processDB } from '../../config/databases';
import bcrypt from 'bcryptjs';

export interface UserAttributes {
  id?: number;
  userId: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  realName: string;
  role: 'admin' | 'artisan' | 'inspector' | 'supervisor' | 'viewer';
  permissions: string[];
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;
  public userId!: string;
  public username!: string;
  public password!: string;
  public email?: string;
  public phone?: string;
  public realName!: string;
  public role!: 'admin' | 'artisan' | 'inspector' | 'supervisor' | 'viewer';
  public permissions!: string[];
  public department?: string;
  public status!: 'active' | 'inactive' | 'suspended';
  public lastLoginAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  realName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'artisan', 'inspector', 'supervisor', 'viewer'),
    allowNull: false
  },
  permissions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  department: {
    type: DataTypes.STRING(100)
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  lastLoginAt: {
    type: DataTypes.DATE
  }
}, {
  sequelize: processDB,
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user: User) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user: User) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

export default User;
