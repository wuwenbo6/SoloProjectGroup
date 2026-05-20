const successResponse = (res, data, message = '操作成功', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const errorResponse = (res, message = '操作失败', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

const paginatedResponse = (res, data, page, limit, total, message = '查询成功') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages: Math.ceil(total / limit)
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = { successResponse, errorResponse, paginatedResponse };
