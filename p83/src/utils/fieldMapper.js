class FieldMapper {
  constructor() {
    this.fieldMappings = {
      default: {
        toExternal: {
          qualityId: 'id',
          materialId: 'materialId',
          batchId: 'batchId',
          inspectionType: 'inspectionType',
          inspector: 'inspector',
          testItems: 'testItems',
          overallResult: 'overallResult',
          qualityScore: 'qualityScore',
          defects: 'defects',
          inspectionDate: 'inspectionDate',
          reportUrl: 'reportUrl',
          testingAgency: 'testingAgency',
          source: 'source',
          syncedAt: 'syncedAt'
        },
        toInternal: {
          id: 'qualityId',
          materialId: 'materialId',
          batchId: 'batchId',
          inspectionType: 'inspectionType',
          inspector: 'inspector',
          testItems: 'testItems',
          overallResult: 'overallResult',
          qualityScore: 'qualityScore',
          defects: 'defects',
          inspectionDate: 'inspectionDate',
          reportUrl: 'reportUrl',
          testingAgency: 'testingAgency',
          source: 'source',
          syncedAt: 'syncedAt'
        }
      },
      agency_A: {
        toExternal: {
          qualityId: 'record_id',
          materialId: 'material_code',
          batchId: 'batch_number',
          inspectionType: 'check_type',
          inspector: { field: 'inspector', transform: (val) => val?.name || val },
          testItems: 'check_items',
          overallResult: 'final_result',
          qualityScore: 'score',
          defects: 'defects_list',
          inspectionDate: 'check_date',
          reportUrl: 'report_link',
          testingAgency: 'agency_info',
          source: 'data_source',
          syncedAt: 'sync_time'
        },
        toInternal: {
          record_id: 'qualityId',
          material_code: 'materialId',
          batch_number: 'batchId',
          check_type: 'inspectionType',
          inspector: { field: 'inspector', transform: (val) => ({ name: val }) },
          check_items: 'testItems',
          final_result: 'overallResult',
          score: 'qualityScore',
          defects_list: 'defects',
          check_date: 'inspectionDate',
          report_link: 'reportUrl',
          agency_info: 'testingAgency',
          data_source: 'source',
          sync_time: 'syncedAt'
        }
      },
      agency_B: {
        toExternal: {
          qualityId: 'testId',
          materialId: 'materialRef',
          batchId: 'batchRef',
          inspectionType: 'testCategory',
          inspector: 'performedBy',
          testItems: 'testDetails',
          overallResult: 'conclusion',
          qualityScore: 'rating',
          defects: 'issuesFound',
          inspectionDate: 'testDate',
          reportUrl: 'certificateUrl',
          testingAgency: 'labInfo',
          source: 'origin',
          syncedAt: 'timestamp'
        },
        toInternal: {
          testId: 'qualityId',
          materialRef: 'materialId',
          batchRef: 'batchId',
          testCategory: 'inspectionType',
          performedBy: 'inspector',
          testDetails: 'testItems',
          conclusion: 'overallResult',
          rating: 'qualityScore',
          issuesFound: 'defects',
          testDate: 'inspectionDate',
          certificateUrl: 'reportUrl',
          labInfo: 'testingAgency',
          origin: 'source',
          timestamp: 'syncedAt'
        }
      },
      agency_C: {
        toExternal: {
          qualityId: 'qc_id',
          materialId: 'mat_id',
          batchId: 'bat_id',
          inspectionType: 'qc_type',
          inspector: 'qc_by',
          testItems: 'qc_items',
          overallResult: 'qc_result',
          qualityScore: 'qc_score',
          defects: 'qc_defects',
          inspectionDate: 'qc_date',
          reportUrl: 'qc_report',
          testingAgency: 'qc_agency',
          source: 'qc_source',
          syncedAt: 'qc_synced'
        },
        toInternal: {
          qc_id: 'qualityId',
          mat_id: 'materialId',
          bat_id: 'batchId',
          qc_type: 'inspectionType',
          qc_by: 'inspector',
          qc_items: 'testItems',
          qc_result: 'overallResult',
          qc_score: 'qualityScore',
          qc_defects: 'defects',
          qc_date: 'inspectionDate',
          qc_report: 'reportUrl',
          qc_agency: 'testingAgency',
          qc_source: 'source',
          qc_synced: 'syncedAt'
        }
      }
    };

    this.testItemMappings = {
      default: {
        itemName: 'itemName',
        standard: 'standard',
        testMethod: 'testMethod',
        measuredValue: 'measuredValue',
        unit: 'unit',
        tolerance: 'tolerance',
        result: 'result',
        remarks: 'remarks',
        minValue: 'minValue',
        maxValue: 'maxValue'
      },
      agency_A: {
        itemName: 'name',
        standard: 'spec',
        testMethod: 'method',
        measuredValue: 'value',
        unit: 'uom',
        tolerance: 'tol',
        result: 'status',
        remarks: 'note',
        minValue: 'min',
        maxValue: 'max'
      },
      agency_B: {
        itemName: 'parameter',
        standard: 'specification',
        testMethod: 'procedure',
        measuredValue: 'actual',
        unit: 'measurementUnit',
        tolerance: 'allowance',
        result: 'outcome',
        remarks: 'comment',
        minValue: 'lowerLimit',
        maxValue: 'upperLimit'
      },
      agency_C: {
        itemName: 'item',
        standard: 'std',
        testMethod: 'test_proc',
        measuredValue: 'meas_val',
        unit: 'uom',
        tolerance: 'tol_range',
        result: 'pass_fail',
        remarks: 'notes',
        minValue: 'low_limit',
        maxValue: 'high_limit'
      }
    };
  }

  registerMapping(agencyId, toExternal, toInternal, testItemMapping) {
    this.fieldMappings[agencyId] = { toExternal, toInternal };
    if (testItemMapping) {
      this.testItemMappings[agencyId] = testItemMapping;
    }
  }

  getMapping(agencyId) {
    return this.fieldMappings[agencyId] || this.fieldMappings.default;
  }

  getTestItemMapping(agencyId) {
    return this.testItemMappings[agencyId] || this.testItemMappings.default;
  }

  mapToExternal(data, agencyId = 'default') {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const mapping = this.getMapping(agencyId);
    const testItemMapping = this.getTestItemMapping(agencyId);
    const result = {};

    for (const [internalField, externalConfig] of Object.entries(mapping.toExternal)) {
      if (internalField in data) {
        if (typeof externalConfig === 'string') {
          result[externalConfig] = data[internalField];
        } else if (typeof externalConfig === 'object' && externalConfig.field) {
          result[externalConfig.field] = externalConfig.transform 
            ? externalConfig.transform(data[internalField]) 
            : data[internalField];
        }
      }
    }

    if (result.testItems && Array.isArray(result.testItems)) {
      result.testItems = data.testItems.map(item => 
        this.mapTestItemToExternal(item, agencyId)
      );
    }

    return result;
  }

  mapToInternal(data, agencyId = 'default') {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const mapping = this.getMapping(agencyId);
    const result = {};

    for (const [externalField, internalConfig] of Object.entries(mapping.toInternal)) {
      if (externalField in data) {
        if (typeof internalConfig === 'string') {
          result[internalConfig] = data[externalField];
        } else if (typeof internalConfig === 'object' && internalConfig.field) {
          result[internalConfig.field] = internalConfig.transform 
            ? internalConfig.transform(data[externalField]) 
            : data[externalField];
        }
      }
    }

    if (data.testItems || data.check_items || data.testDetails || data.qc_items) {
      const testItemsKey = this.getTestItemsKey(data, agencyId);
      if (testItemsKey && Array.isArray(data[testItemsKey])) {
        result.testItems = data[testItemsKey].map(item => 
          this.mapTestItemToInternal(item, agencyId)
        );
      }
    }

    return result;
  }

  getTestItemsKey(data, agencyId) {
    const possibleKeys = ['testItems', 'check_items', 'testDetails', 'qc_items', 'qcItems'];
    return possibleKeys.find(key => key in data);
  }

  mapTestItemToExternal(item, agencyId = 'default') {
    if (!item || typeof item !== 'object') {
      return item;
    }

    const mapping = this.getTestItemMapping(agencyId);
    const result = {};

    for (const [internalField, externalField] of Object.entries(mapping)) {
      if (internalField in item) {
        result[externalField] = item[internalField];
      }
    }

    return result;
  }

  mapTestItemToInternal(item, agencyId = 'default') {
    if (!item || typeof item !== 'object') {
      return item;
    }

    const mapping = this.getTestItemMapping(agencyId);
    const result = {};

    for (const [internalField, externalField] of Object.entries(mapping)) {
      if (externalField in item) {
        result[internalField] = item[externalField];
      }
    }

    if (!result.itemName) {
      const fallbackKeys = ['item', 'parameter', 'name'];
      for (const key of fallbackKeys) {
        if (key in item) {
          result.itemName = item[key];
          break;
        }
      }
    }

    return result;
  }

  mapBatchToExternal(data, agencyId = 'default') {
    const batchMappings = {
      default: {
        batchId: 'id',
        batchNumber: 'batchNumber',
        name: 'name',
        description: 'description',
        materialType: 'materialType',
        quantity: 'quantity',
        unit: 'unit',
        productionDate: 'productionDate',
        expiryDate: 'expiryDate'
      },
      agency_A: {
        batchId: 'batch_id',
        batchNumber: 'batch_no',
        name: 'batch_name',
        description: 'desc',
        materialType: 'mat_type',
        quantity: 'qty',
        unit: 'uom',
        productionDate: 'prod_date',
        expiryDate: 'exp_date'
      },
      agency_B: {
        batchId: 'batchRef',
        batchNumber: 'batchCode',
        name: 'batchTitle',
        description: 'details',
        materialType: 'category',
        quantity: 'amount',
        unit: 'measurementUnit',
        productionDate: 'manufacturedOn',
        expiryDate: 'validUntil'
      }
    };

    const mapping = batchMappings[agencyId] || batchMappings.default;
    const result = {};

    for (const [internalField, externalField] of Object.entries(mapping)) {
      if (internalField in data) {
        result[externalField] = data[internalField];
      }
    }

    return result;
  }

  mapBatchToInternal(data, agencyId = 'default') {
    const batchMappings = {
      default: {
        id: 'batchId',
        batchNumber: 'batchNumber',
        name: 'name',
        description: 'description',
        materialType: 'materialType',
        quantity: 'quantity',
        unit: 'unit',
        productionDate: 'productionDate',
        expiryDate: 'expiryDate'
      },
      agency_A: {
        batch_id: 'batchId',
        batch_no: 'batchNumber',
        batch_name: 'name',
        desc: 'description',
        mat_type: 'materialType',
        qty: 'quantity',
        uom: 'unit',
        prod_date: 'productionDate',
        exp_date: 'expiryDate'
      },
      agency_B: {
        batchRef: 'batchId',
        batchCode: 'batchNumber',
        batchTitle: 'name',
        details: 'description',
        category: 'materialType',
        amount: 'quantity',
        measurementUnit: 'unit',
        manufacturedOn: 'productionDate',
        validUntil: 'expiryDate'
      }
    };

    const mapping = batchMappings[agencyId] || batchMappings.default;
    const result = {};

    for (const [externalField, internalField] of Object.entries(mapping)) {
      if (externalField in data) {
        result[internalField] = data[externalField];
      }
    }

    return result;
  }
}

module.exports = new FieldMapper();
