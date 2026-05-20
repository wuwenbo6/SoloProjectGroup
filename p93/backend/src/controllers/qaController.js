const { QAModel } = require('../models/database');

exports.getQAByCraftId = (req, res) => {
  try {
    const qas = QAModel.findByCraftId(req.params.craftId);
    res.json(qas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getQAByStep = (req, res) => {
  try {
    const { craftId, stepIndex } = req.params;
    const qas = QAModel.findByStep(craftId, parseInt(stepIndex));
    res.json(qas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const qa = await QAModel.create(req.body);
    res.status(201).json(qa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addAnswer = async (req, res) => {
  try {
    const { qaId } = req.params;
    const qa = await QAModel.addAnswer(qaId, req.body);
    if (!qa) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json(qa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteQA = async (req, res) => {
  try {
    const success = await QAModel.delete(req.params.qaId);
    if (!success) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
