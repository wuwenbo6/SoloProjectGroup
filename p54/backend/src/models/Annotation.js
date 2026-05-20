module.exports = (sequelize, DataTypes) => {
  const Annotation = sequelize.define('Annotation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rubbingId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    ocrResultId: {
      type: DataTypes.UUID
    },
    annotatorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    character: {
      type: DataTypes.STRING(1),
      allowNull: false
    },
    pinyin: {
      type: DataTypes.STRING
    },
    radical: {
      type: DataTypes.STRING
    },
    strokeCount: {
      type: DataTypes.INTEGER
    },
    variant: {
      type: DataTypes.STRING
    },
    meaning: {
      type: DataTypes.TEXT
    },
    notes: {
      type: DataTypes.TEXT
    },
    boundingBox: {
      type: DataTypes.JSON
    },
    position: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'finalized'),
      defaultValue: 'draft'
    }
  })

  Annotation.associate = (models) => {
    Annotation.belongsTo(models.Rubbing, { foreignKey: 'rubbingId' })
    Annotation.belongsTo(models.User, { foreignKey: 'annotatorId', as: 'User' })
    Annotation.belongsTo(models.OCRResult, { foreignKey: 'ocrResultId' })
  }

  return Annotation
}
