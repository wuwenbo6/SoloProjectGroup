const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database/rubbing.db'),
  logging: false
})

const db = {
  sequelize,
  Sequelize
}

db.User = require('./User')(sequelize, DataTypes)
db.Rubbing = require('./Rubbing')(sequelize, DataTypes)
db.Annotation = require('./Annotation')(sequelize, DataTypes)
db.OCRResult = require('./OCRResult')(sequelize, DataTypes)
db.OperationLog = require('./OperationLog')(sequelize, DataTypes)
db.CollaborationSession = require('./CollaborationSession')(sequelize, DataTypes)

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

module.exports = db
