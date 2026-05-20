const Joi = require('joi');

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        code: 'VALIDATION_ERROR',
        errors
      });
    }

    next();
  };
};

const schemas = {
  auth: {
    login: Joi.object({
      username: Joi.string().required().messages({
        'string.empty': '用户名不能为空',
        'any.required': '用户名是必填项'
      }),
      password: Joi.string().required().messages({
        'string.empty': '密码不能为空',
        'any.required': '密码是必填项'
      })
    }),

    register: Joi.object({
      username: Joi.string().min(3).max(50).required().messages({
        'string.min': '用户名至少需要3个字符',
        'string.max': '用户名最多50个字符',
        'any.required': '用户名是必填项'
      }),
      email: Joi.string().email().required().messages({
        'string.email': '请提供有效的邮箱地址',
        'any.required': '邮箱是必填项'
      }),
      password: Joi.string().min(6).required().messages({
        'string.min': '密码至少需要6个字符',
        'any.required': '密码是必填项'
      }),
      name: Joi.string().required().messages({
        'any.required': '姓名是必填项'
      }),
      phone: Joi.string().optional(),
      department: Joi.string().optional(),
      position: Joi.string().optional()
    }),

    refreshToken: Joi.object({
      refreshToken: Joi.string().required().messages({
        'any.required': '刷新令牌是必填项'
      })
    }),

    changePassword: Joi.object({
      oldPassword: Joi.string().required().messages({
        'any.required': '旧密码是必填项'
      }),
      newPassword: Joi.string().min(6).required().messages({
        'string.min': '新密码至少需要6个字符',
        'any.required': '新密码是必填项'
      })
    })
  },

  material: {
    create: Joi.object({
      name: Joi.string().required().messages({
        'any.required': '材质名称是必填项'
      }),
      type: Joi.string().valid('wood', 'bamboo', 'silk', 'leather', 'metal', 'bone', 'other').required().messages({
        'any.only': '材质类型不合法',
        'any.required': '材质类型是必填项'
      }),
      origin: Joi.object({
        country: Joi.string().required(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        region: Joi.string().optional(),
        coordinates: Joi.object({
          latitude: Joi.number().optional(),
          longitude: Joi.number().optional()
        }).optional()
      }).required().messages({
        'any.required': '产地信息是必填项'
      }),
      characteristics: Joi.object({
        density: Joi.number().optional(),
        hardness: Joi.number().optional(),
        moistureContent: Joi.number().optional(),
        color: Joi.string().optional(),
        texture: Joi.string().optional(),
        grainPattern: Joi.string().optional()
      }).optional(),
      supplier: Joi.object({
        supplierId: Joi.string().optional(),
        name: Joi.string().optional(),
        contact: Joi.string().optional(),
        licenseNumber: Joi.string().optional()
      }).optional(),
      harvestDate: Joi.date().optional(),
      qualityGrade: Joi.string().valid('A', 'B', 'C', 'D').optional(),
      storageConditions: Joi.object({
        temperature: Joi.number().optional(),
        humidity: Joi.number().optional(),
        location: Joi.string().optional()
      }).optional(),
      status: Joi.string().valid('available', 'used', 'reserved', 'expired').optional(),
      batchId: Joi.string().optional(),
      metadata: Joi.object().optional()
    }),

    update: Joi.object({
      name: Joi.string().optional(),
      type: Joi.string().valid('wood', 'bamboo', 'silk', 'leather', 'metal', 'bone', 'other').optional(),
      origin: Joi.object({
        country: Joi.string().optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        region: Joi.string().optional(),
        coordinates: Joi.object({
          latitude: Joi.number().optional(),
          longitude: Joi.number().optional()
        }).optional()
      }).optional(),
      characteristics: Joi.object().optional(),
      supplier: Joi.object().optional(),
      harvestDate: Joi.date().optional(),
      qualityGrade: Joi.string().valid('A', 'B', 'C', 'D').optional(),
      storageConditions: Joi.object().optional(),
      status: Joi.string().valid('available', 'used', 'reserved', 'expired').optional(),
      batchId: Joi.string().optional(),
      metadata: Joi.object().optional()
    }),

    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      type: Joi.string().optional(),
      status: Joi.string().optional(),
      country: Joi.string().optional(),
      search: Joi.string().optional(),
      sortBy: Joi.string().default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  trace: {
    create: Joi.object({
      materialId: Joi.string().required().messages({
        'any.required': '材质ID是必填项'
      }),
      batchId: Joi.string().optional(),
      stage: Joi.string().valid('harvest', 'transport', 'storage', 'processing', 'manufacturing', 'quality_check', 'distribution', 'retail').required().messages({
        'any.only': '溯源阶段不合法',
        'any.required': '溯源阶段是必填项'
      }),
      location: Joi.object({
        country: Joi.string().optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        address: Joi.string().optional(),
        coordinates: Joi.object({
          latitude: Joi.number().optional(),
          longitude: Joi.number().optional()
        }).optional()
      }).optional(),
      operator: Joi.object({
        operatorId: Joi.string().optional(),
        name: Joi.string().optional(),
        role: Joi.string().optional(),
        organization: Joi.string().optional()
      }).optional(),
      actions: Joi.array().items(Joi.object({
        actionType: Joi.string().optional(),
        description: Joi.string().optional(),
        parameters: Joi.object().optional(),
        timestamp: Joi.date().optional()
      })).optional(),
      equipment: Joi.object({
        equipmentId: Joi.string().optional(),
        name: Joi.string().optional(),
        calibrationStatus: Joi.string().optional()
      }).optional(),
      environmentalConditions: Joi.object({
        temperature: Joi.number().optional(),
        humidity: Joi.number().optional(),
        pressure: Joi.number().optional()
      }).optional(),
      previousTraceId: Joi.string().optional(),
      status: Joi.string().valid('pending', 'completed', 'verified', 'rejected').optional(),
      attachments: Joi.array().items(Joi.object({
        type: Joi.string().valid('image', 'document', 'video', 'certificate').optional(),
        url: Joi.string().optional(),
        name: Joi.string().optional()
      })).optional(),
      remarks: Joi.string().optional(),
      metadata: Joi.object().optional()
    }),

    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      materialId: Joi.string().optional(),
      batchId: Joi.string().optional(),
      stage: Joi.string().optional(),
      status: Joi.string().optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      sortBy: Joi.string().default('timestamp'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  quality: {
    create: Joi.object({
      materialId: Joi.string().required().messages({
        'any.required': '材质ID是必填项'
      }),
      batchId: Joi.string().optional(),
      traceId: Joi.string().optional(),
      inspectionType: Joi.string().valid('incoming', 'process', 'final', 'third_party', 'sampling').required().messages({
        'any.only': '检测类型不合法',
        'any.required': '检测类型是必填项'
      }),
      inspector: Joi.object({
        inspectorId: Joi.string().optional(),
        name: Joi.string().optional(),
        department: Joi.string().optional(),
        qualification: Joi.string().optional()
      }).optional(),
      testingAgency: Joi.object({
        agencyId: Joi.string().optional(),
        name: Joi.string().optional(),
        licenseNumber: Joi.string().optional(),
        isThirdParty: Joi.boolean().optional()
      }).optional(),
      testItems: Joi.array().items(Joi.object({
        itemName: Joi.string().required(),
        standard: Joi.string().optional(),
        testMethod: Joi.string().optional(),
        measuredValue: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        unit: Joi.string().optional(),
        tolerance: Joi.string().optional(),
        result: Joi.string().valid('pass', 'fail', 'pending').optional(),
        remarks: Joi.string().optional()
      })).required().messages({
        'any.required': '检测项目是必填项'
      }),
      overallResult: Joi.string().valid('pass', 'fail', 'conditional', 'pending').optional(),
      qualityScore: Joi.number().min(0).max(100).optional(),
      defects: Joi.array().items(Joi.object({
        defectType: Joi.string().optional(),
        severity: Joi.string().valid('critical', 'major', 'minor', 'cosmetic').optional(),
        description: Joi.string().optional(),
        location: Joi.string().optional(),
        quantity: Joi.number().optional()
      })).optional(),
      status: Joi.string().valid('draft', 'submitted', 'verified', 'approved', 'rejected').optional(),
      reportUrl: Joi.string().optional(),
      remarks: Joi.string().optional(),
      metadata: Joi.object().optional()
    }),

    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      materialId: Joi.string().optional(),
      batchId: Joi.string().optional(),
      inspectionType: Joi.string().optional(),
      overallResult: Joi.string().optional(),
      status: Joi.string().optional(),
      isThirdParty: Joi.boolean().optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      sortBy: Joi.string().default('inspectionDate'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  batch: {
    create: Joi.object({
      batchNumber: Joi.string().required().messages({
        'any.required': '批次编号是必填项'
      }),
      name: Joi.string().required().messages({
        'any.required': '批次名称是必填项'
      }),
      description: Joi.string().optional(),
      materialType: Joi.string().valid('wood', 'bamboo', 'silk', 'leather', 'metal', 'bone', 'other').required().messages({
        'any.only': '材质类型不合法',
        'any.required': '材质类型是必填项'
      }),
      quantity: Joi.number().min(0).required().messages({
        'any.required': '数量是必填项'
      }),
      unit: Joi.string().default('kg'),
      productionDate: Joi.date().required().messages({
        'any.required': '生产日期是必填项'
      }),
      expiryDate: Joi.date().optional(),
      origin: Joi.object({
        country: Joi.string().optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        region: Joi.string().optional()
      }).optional(),
      supplier: Joi.object({
        supplierId: Joi.string().optional(),
        name: Joi.string().optional(),
        contact: Joi.string().optional()
      }).optional(),
      warehouse: Joi.object({
        warehouseId: Joi.string().optional(),
        name: Joi.string().optional(),
        location: Joi.string().optional()
      }).optional(),
      storageLocation: Joi.string().optional(),
      qualityStandard: Joi.string().optional(),
      materials: Joi.array().items(Joi.object({
        materialId: Joi.string().optional(),
        quantity: Joi.number().optional(),
        unit: Joi.string().optional()
      })).optional(),
      parentBatchId: Joi.string().optional(),
      status: Joi.string().valid('planned', 'in_progress', 'completed', 'quality_checking', 'approved', 'rejected', 'shipped', 'received', 'archived').optional(),
      productionLine: Joi.string().optional(),
      manufacturer: Joi.object({
        manufacturerId: Joi.string().optional(),
        name: Joi.string().optional(),
        address: Joi.string().optional()
      }).optional(),
      manager: Joi.object({
        managerId: Joi.string().optional(),
        name: Joi.string().optional(),
        contact: Joi.string().optional()
      }).optional(),
      remarks: Joi.string().optional(),
      metadata: Joi.object().optional()
    }),

    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      materialType: Joi.string().optional(),
      status: Joi.string().optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      search: Joi.string().optional(),
      sortBy: Joi.string().default('productionDate'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  testingAgency: {
    create: Joi.object({
      name: Joi.string().required().messages({
        'any.required': '机构名称是必填项'
      }),
      code: Joi.string().uppercase().required().messages({
        'any.required': '机构代码是必填项'
      }),
      licenseNumber: Joi.string().required().messages({
        'any.required': '许可证编号是必填项'
      }),
      address: Joi.object({
        country: Joi.string().optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        street: Joi.string().optional(),
        postalCode: Joi.string().optional()
      }).optional(),
      contactPerson: Joi.object({
        name: Joi.string().optional(),
        position: Joi.string().optional(),
        email: Joi.string().email().optional(),
        phone: Joi.string().optional()
      }).optional(),
      apiConfig: Joi.object({
        baseUrl: Joi.string().uri().optional(),
        apiKey: Joi.string().optional(),
        authType: Joi.string().valid('api_key', 'oauth2', 'basic_auth', 'bearer_token').optional(),
        timeout: Joi.number().optional()
      }).optional(),
      capabilities: Joi.array().items(Joi.object({
        type: Joi.string().optional(),
        description: Joi.string().optional(),
        standards: Joi.array().items(Joi.string()).optional()
      })).optional(),
      supportedTestTypes: Joi.array().items(Joi.string()).optional(),
      status: Joi.string().valid('active', 'inactive', 'suspended', 'pending_approval').optional(),
      syncSettings: Joi.object({
        enabled: Joi.boolean().optional(),
        syncFrequency: Joi.string().valid('realtime', 'hourly', 'daily', 'weekly', 'manual').optional(),
        autoSyncQualityData: Joi.boolean().optional(),
        autoSyncCertificates: Joi.boolean().optional(),
        webhookEnabled: Joi.boolean().optional(),
        webhookUrl: Joi.string().uri().optional(),
        webhookSecret: Joi.string().optional()
      }).optional()
    })
  }
};

module.exports = {
  validateRequest,
  schemas
};
