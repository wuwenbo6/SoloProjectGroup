module.exports = (sequelize, DataTypes) => {
  const CollaborationSession = sequelize.define('CollaborationSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rubbingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    sessionName: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'closed'),
      defaultValue: 'active'
    }
  })

  CollaborationSession.associate = (models) => {
    CollaborationSession.belongsTo(models.Rubbing, { foreignKey: 'rubbingId' })
  }

  return CollaborationSession
}
