const encryption = require('../middleware/encryption');

const encryptData = async (req, res) => {
  try {
    const { data, algorithm = 'gcm' } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        message: '请提供要加密的数据',
        code: 'MISSING_DATA'
      });
    }

    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    let encrypted;

    if (algorithm === 'gcm') {
      encrypted = encryption.encryptGCM(dataStr);
    } else {
      encrypted = encryption.encrypt(dataStr);
    }

    return res.status(200).json({
      success: true,
      message: '数据加密成功',
      data: {
        encrypted,
        algorithm
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '数据加密失败',
      code: 'ENCRYPTION_ERROR',
      error: error.message
    });
  }
};

const decryptData = async (req, res) => {
  try {
    const { encrypted, algorithm = 'gcm' } = req.body;
    
    if (!encrypted) {
      return res.status(400).json({
        success: false,
        message: '请提供要解密的数据',
        code: 'MISSING_DATA'
      });
    }

    let decrypted;

    if (algorithm === 'gcm') {
      decrypted = encryption.decryptGCM(encrypted);
    } else {
      decrypted = encryption.decrypt(encrypted);
    }

    let result;
    try {
      result = JSON.parse(decrypted);
    } catch {
      result = decrypted;
    }

    return res.status(200).json({
      success: true,
      message: '数据解密成功',
      data: {
        decrypted: result,
        algorithm
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '数据解密失败',
      code: 'DECRYPTION_ERROR',
      error: error.message
    });
  }
};

const generateSignature = async (req, res) => {
  try {
    const { data } = req.body;
    const timestamp = Date.now().toString();
    const nonce = require('crypto').randomBytes(16).toString('hex');
    
    const signature = encryption.generateSignature(data, timestamp, nonce);

    return res.status(200).json({
      success: true,
      message: '生成签名成功',
      data: {
        signature,
        timestamp,
        nonce
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '生成签名失败',
      code: 'SIGNATURE_ERROR',
      error: error.message
    });
  }
};

const verifySignature = async (req, res) => {
  try {
    const { data, timestamp, nonce, signature } = req.body;
    
    if (!data || !timestamp || !nonce || !signature) {
      return res.status(400).json({
        success: false,
        message: '缺少验证参数',
        code: 'MISSING_PARAMETERS'
      });
    }

    const isValid = encryption.verifySignature(data, timestamp, nonce, signature);

    return res.status(200).json({
      success: true,
      message: '签名验证完成',
      data: {
        valid: isValid
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '签名验证失败',
      code: 'VERIFICATION_ERROR',
      error: error.message
    });
  }
};

const generateApiKey = async (req, res) => {
  try {
    const apiKey = encryption.generateApiKey();
    const secret = encryption.generateSecret();

    return res.status(200).json({
      success: true,
      message: '生成API密钥成功',
      data: {
        apiKey,
        secret,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '生成API密钥失败',
      code: 'KEY_GENERATION_ERROR',
      error: error.message
    });
  }
};

const hashData = async (req, res) => {
  try {
    const { data, algorithm = 'sha256' } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        message: '请提供要哈希的数据',
        code: 'MISSING_DATA'
      });
    }

    const hashed = encryption.hashSensitiveData(data, algorithm);

    return res.status(200).json({
      success: true,
      message: '数据哈希成功',
      data: {
        hashed,
        algorithm
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '数据哈希失败',
      code: 'HASH_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  encryptData,
  decryptData,
  generateSignature,
  verifySignature,
  generateApiKey,
  hashData
};
