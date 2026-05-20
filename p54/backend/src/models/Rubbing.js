module.exports = (sequelize, DataTypes) => {
  const Rubbing = sequelize.define('Rubbing', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    originalImage: {
      type: DataTypes.STRING,
      allowNull: false
    },
    processedImage: {
      type: DataTypes.STRING
    },
    category: {
      type: DataTypes.ENUM('stele', 'bronze', 'jade', 'pottery', 'other'),
      defaultValue: 'stele'
    },
    dynasty: {
      type: DataTypes.STRING
    },
    author: {
      type: DataTypes.STRING
    },
    era: {
      type: DataTypes.STRING
    },
    location: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'processed', 'annotating', 'completed'),
      defaultValue: 'uploaded'
    },
    annotationProgress: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalCharacters: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    annotatedCharacters: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    sourceType: {
      type: DataTypes.ENUM('camera', 'scan', 'import'),
      defaultValue: 'import'
    },
    uploaderId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  })

  Rubbing.associate = (models) => {
    Rubbing.belongsTo(models.User, { foreignKey: 'uploaderId', as: 'User' })
    Rubbing.hasMany(models.Annotation, { foreignKey: 'rubbingId' })
    Rubbing.hasMany(models.OCRResult, { foreignKey: 'rubbingId' })
  }

  return Rubbing
}
