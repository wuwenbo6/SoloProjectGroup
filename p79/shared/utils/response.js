class ApiResponse {
  static success(res, data, message = 'success', code = 200) {
    return res.status(code).json({
      code,
      message,
      data
    });
  }

  static created(res, data, message = '创建成功') {
    return res.status(201).json({
      code: 201,
      message,
      data
    });
  }

  static error(res, message = '服务器错误', code = 500, errors = null) {
    const response = {
      code,
      message
    };
    if (errors) {
      response.errors = errors;
    }
    return res.status(code).json(response);
  }

  static badRequest(res, message = '请求参数错误', errors = null) {
    return this.error(res, message, 400, errors);
  }

  static unauthorized(res, message = '未授权访问') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = '禁止访问') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = '资源不存在') {
    return this.error(res, message, 404);
  }

  static conflict(res, message = '资源冲突') {
    return this.error(res, message, 409);
  }

  static paginated(res, data, page, size, total) {
    return res.status(200).json({
      code: 200,
      message: 'success',
      data: {
        list: data,
        pagination: {
          page: parseInt(page),
          size: parseInt(size),
          total,
          totalPages: Math.ceil(total / size)
        }
      }
    });
  }
}

module.exports = ApiResponse;
