const axios = require('axios');

const SERVICE_URLS = {
  auth: `http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}`,
  material: `http://localhost:${process.env.MATERIAL_SERVICE_PORT || 3002}`,
  trace: `http://localhost:${process.env.TRACE_SERVICE_PORT || 3003}`,
  quality: `http://localhost:${process.env.QUALITY_SERVICE_PORT || 3004}`,
  batch: `http://localhost:${process.env.BATCH_SERVICE_PORT || 3005}`,
  thirdparty: `http://localhost:${process.env.THIRDPARTY_SERVICE_PORT || 3006}`
};

const callService = async (serviceName, method, path, data = null, token = null) => {
  try {
    const baseURL = SERVICE_URLS[serviceName];
    if (!baseURL) {
      throw new Error(`未知服务: ${serviceName}`);
    }

    const config = {
      method,
      url: `${baseURL}${path}`,
      timeout: 5000
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    if (token) {
      config.headers = {
        'Authorization': `Bearer ${token}`
      };
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    } else if (error.request) {
      throw { success: false, message: `服务 ${serviceName} 不可用` };
    } else {
      throw { success: false, message: error.message };
    }
  }
};

module.exports = { callService, SERVICE_URLS };
