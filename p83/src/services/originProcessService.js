const Material = require('../models/material/Material');

const ORIGIN_PROCESS_RULES = {
  "中国-云南-西双版纳": {
    processes: ["自然风干", "手工雕刻", "传统上漆"],
    materialTypes: ["wood"],
    qualityBoost: 15,
    description: "云南西双版纳红木加工工艺"
  },
  "中国-浙江-东阳": {
    processes: ["精细雕刻", "打磨抛光", "榫卯结构"],
    materialTypes: ["wood", "bamboo"],
    qualityBoost: 12,
    description: "浙江东阳木雕工艺"
  },
  "中国-江苏-苏州": {
    processes: ["传统雕刻", "精细打磨", "上蜡处理"],
    materialTypes: ["wood", "bamboo"],
    qualityBoost: 10,
    description: "苏州红木工艺"
  },
  "中国-福建-莆田": {
    processes: ["莆田木雕", "精细打磨", "传统上漆"],
    materialTypes: ["wood"],
    qualityBoost: 13,
    description: "莆田木雕工艺"
  },
  "中国-四川-成都": {
    processes: ["竹编工艺", "精细编织", "防虫处理"],
    materialTypes: ["bamboo"],
    qualityBoost: 11,
    description: "成都竹编工艺"
  },
  "中国-安徽-宣城": {
    processes: ["宣纸制作", "精细加工", "传统工艺"],
    materialTypes: ["bamboo", "wood"],
    qualityBoost: 9,
    description: "宣城竹木工艺"
  },
  "中国-河南-周口": {
    processes: ["牛皮鞣制", "传统加工", "手工处理"],
    materialTypes: ["leather"],
    qualityBoost: 8,
    description: "河南皮革工艺"
  }
};

const PROCESS_DETAILS = {
  "自然风干": {
    duration: "30-90天",
    equipment: ["通风设备", "湿度监控"],
    qualityImpact: "提升材质稳定性",
    cost: 120
  },
  "手工雕刻": {
    duration: "7-30天",
    equipment: ["雕刻刀", "打磨工具"],
    qualityImpact: "提升艺术价值",
    cost: 300
  },
  "传统上漆": {
    duration: "15-45天",
    equipment: ["漆刷", "无尘车间"],
    qualityImpact: "提升耐久性和光泽",
    cost: 200
  },
  "精细雕刻": {
    duration: "10-60天",
    equipment: ["精密雕刻工具", "放大镜"],
    qualityImpact: "提升精细度",
    cost: 450
  },
  "打磨抛光": {
    duration: "3-15天",
    equipment: ["砂纸", "抛光机"],
    qualityImpact: "提升表面光滑度",
    cost: 80
  },
  "榫卯结构": {
    duration: "5-20天",
    equipment: ["木工工具", "测量仪器"],
    qualityImpact: "提升结构稳定性",
    cost: 250
  },
  "精细打磨": {
    duration: "2-10天",
    equipment: ["细砂纸", "抛光机"],
    qualityImpact: "提升表面光滑度",
    cost: 100
  },
  "上蜡处理": {
    duration: "1-5天",
    equipment: ["蜡油", "抛光布"],
    qualityImpact: "提升光泽度和保护",
    cost: 60
  },
  "莆田木雕": {
    duration: "15-60天",
    equipment: ["雕刻刀", "打磨工具"],
    qualityImpact: "提升艺术价值",
    cost: 400
  },
  "竹编工艺": {
    duration: "5-20天",
    equipment: ["编织工具", "剪刀"],
    qualityImpact: "提升工艺价值",
    cost: 150
  },
  "精细编织": {
    duration: "7-25天",
    equipment: ["编织工具", "测量仪器"],
    qualityImpact: "提升精细度",
    cost: 180
  },
  "防虫处理": {
    duration: "1-3天",
    equipment: ["防虫剂", "处理设备"],
    qualityImpact: "提升耐久性",
    cost: 50
  },
  "宣纸制作": {
    duration: "30-60天",
    equipment: ["制浆设备", "烘干设备"],
    qualityImpact: "提升品质",
    cost: 350
  },
  "精细加工": {
    duration: "5-20天",
    equipment: ["加工工具", "测量仪器"],
    qualityImpact: "提升精度",
    cost: 200
  },
  "传统工艺": {
    duration: "10-40天",
    equipment: ["传统工具", "手工工具"],
    qualityImpact: "提升传统价值",
    cost: 280
  },
  "牛皮鞣制": {
    duration: "15-30天",
    equipment: ["鞣制设备", "处理工具"],
    qualityImpact: "提升皮革质量",
    cost: 220
  }
};

class OriginProcessService {
  static getOriginKey(origin) {
    if (!origin) return null;
    const parts = [];
    if (origin.country) parts.push(origin.country);
    if (origin.province) parts.push(origin.province);
    if (origin.city) parts.push(origin.city);
    return parts.join('-');
  }

  static getRecommendedProcesses(origin, materialType) {
    const originKey = this.getOriginKey(origin);
    if (!originKey) return [];

    const rules = ORIGIN_PROCESS_RULES[originKey];
    if (!rules) return [];

    if (materialType && !rules.materialTypes.includes(materialType)) {
      return [];
    }

    return rules.processes.map(process => ({
      name: process,
      details: PROCESS_DETAILS[process] || null,
      qualityBoost: rules.qualityBoost,
      originDescription: rules.description
    }));
  }

  static getAllOriginRules() {
    return Object.entries(ORIGIN_PROCESS_RULES).map(([key, rule]) => ({
      originKey: key,
      ...rule
    }));
  }

  static getProcessDetails(processName) {
    return PROCESS_DETAILS[processName] || null;
  }

  static async matchMaterialProcesses(materialId) {
    const material = await Material.findOne({ materialId });
    if (!material) {
      throw new Error('材质不存在');
    }

    const recommended = this.getRecommendedProcesses(material.origin, material.type);
    
    return {
      materialId: material.materialId,
      materialName: material.name,
      materialType: material.type,
      origin: material.origin,
      recommendedProcesses: recommended,
      totalQualityBoost: recommended.reduce((sum, p) => sum + p.qualityBoost, 0),
      estimatedTotalCost: recommended.reduce((sum, p) => sum + (p.details?.cost || 0), 0),
      estimatedTotalDuration: recommended.reduce((sum, p) => {
        const duration = p.details?.duration || '0天';
        const match = duration.match(/(\d+)-(\d+)/);
        if (match) {
          return sum + parseInt(match[2]);
        }
        return sum;
      }, 0)
    };
  }

  static async bindProcessesToMaterial(materialId, processes, userId) {
    const material = await Material.findOne({ materialId });
    if (!material) {
      throw new Error('材质不存在');
    }

    const recommended = this.getRecommendedProcesses(material.origin, material.type);
    const recommendedNames = recommended.map(r => r.name);
    
    const validProcesses = processes.filter(p => recommendedNames.includes(p));
    const invalidProcesses = processes.filter(p => !recommendedNames.includes(p));

    if (!material.processBindings) {
      material.processBindings = [];
    }

    const now = new Date();
    validProcesses.forEach(processName => {
      const existingIndex = material.processBindings.findIndex(
        b => b.processName === processName
      );
      
      if (existingIndex >= 0) {
        material.processBindings[existingIndex].updatedAt = now;
        material.processBindings[existingIndex].updatedBy = userId;
      } else {
        material.processBindings.push({
          processName,
          processDetails: PROCESS_DETAILS[processName],
          createdAt: now,
          createdBy: userId,
          updatedAt: now,
          updatedBy: userId
        });
      }
    });

    material.updatedBy = userId;
    await material.save();

    return {
      success: true,
      materialId,
      boundProcesses: validProcesses,
      invalidProcesses,
      totalProcessBindings: material.processBindings
    };
  }

  static async getMaterialProcessBindings(materialId) {
    const material = await Material.findOne({ materialId });
    if (!material) {
      throw new Error('材质不存在');
    }

    return {
      materialId: material.materialId,
      materialName: material.name,
      origin: material.origin,
      processBindings: material.processBindings || []
    };
  }

  static async removeProcessFromMaterial(materialId, processName, userId) {
    const material = await Material.findOne({ materialId });
    if (!material) {
      throw new Error('材质不存在');
    }

    if (!material.processBindings) {
      material.processBindings = [];
    }

    const initialLength = material.processBindings.length;
    material.processBindings = material.processBindings.filter(
      b => b.processName !== processName
    );

    if (material.processBindings.length === initialLength) {
      throw new Error('该加工工艺未绑定到此材质');
    }

    material.updatedBy = userId;
    await material.save();

    return {
      success: true,
      materialId,
      removedProcess: processName,
      remainingProcesses: material.processBindings.length
    };
  }

  static async getOriginProcessStats() {
    const materials = await Material.find({}, 'origin type processBindings');

    const stats = {
      totalMaterials: materials.length,
      materialsWithProcesses: 0,
      originDistribution: {},
      processDistribution: {}
    };

    materials.forEach(material => {
      const originKey = this.getOriginKey(material.origin);
      if (originKey) {
        stats.originDistribution[originKey] = (stats.originDistribution[originKey] || 0) + 1;
      }

      if (material.processBindings && material.processBindings.length > 0) {
        stats.materialsWithProcesses++;
        material.processBindings.forEach(binding => {
          stats.processDistribution[binding.processName] = 
            (stats.processDistribution[binding.processName] || 0) + 1;
        });
      }
    });

    return stats;
  }

  static async getOriginMaterials(originKey) {
    const [country, province, city] = originKey.split('-');
    
    const query = {};
    if (country) query['origin.country'] = country;
    if (province) query['origin.province'] = province;
    if (city) query['origin.city'] = city;

    const materials = await Material.find(query, 'materialId name type processBindings');

    return {
      originKey,
      totalMaterials: materials.length,
      materials: materials.map(m => ({
        materialId: m.materialId,
        name: m.name,
        type: m.type,
        processCount: m.processBindings?.length || 0
      }))
    };
  }

  static async addCustomOriginRule(originKey, ruleData, userId) {
    return {
      success: true,
      originKey,
      rule: ruleData,
      createdBy: userId,
      createdAt: new Date()
    };
  }
}

module.exports = OriginProcessService;
