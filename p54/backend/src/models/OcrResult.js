module.exports = (sequelize, DataTypes) => {
  const OCRResult = sequelize.define('OCRResult', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rubbingId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    recognizedText: {
      type: DataTypes.STRING
    },
    confidence: {
      type: DataTypes.FLOAT
    },
    boundingBox: {
      type: DataTypes.JSON
    },
    position: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'corrected'),
      defaultValue: 'pending'
    }
  })

  OCRResult.associate = (models) => {
    OCRResult.belongsTo(models.Rubbing, { foreignKey: 'rubbingId' })
    OCRResult.hasMany(models.Annotation, { foreignKey: 'ocrResultId' })
  }

  return OCRResult
}
