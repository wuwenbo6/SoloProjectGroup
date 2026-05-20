package com.dye.traceability.batch.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dye.traceability.batch.entity.FormulaBatch;
import com.dye.traceability.batch.mapper.FormulaBatchMapper;
import com.dye.traceability.common.datasource.DataSource;
import com.dye.traceability.common.datasource.DataSourceType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class BatchService extends ServiceImpl<FormulaBatchMapper, FormulaBatch> {

    @DataSource(DataSourceType.FORMULA)
    public void createBatch(FormulaBatch batch) {
        batch.setBatchNo(generateBatchNo());
        batch.setStatus(1);
        save(batch);
    }

    @DataSource(DataSourceType.FORMULA)
    public List<FormulaBatch> listByCondition(String formulaNo, String status, String workshop) {
        LambdaQueryWrapper<FormulaBatch> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FormulaBatch::getDeleted, 0);
        if (formulaNo != null) {
            wrapper.eq(FormulaBatch::getFormulaNo, formulaNo);
        }
        if (status != null) {
            wrapper.eq(FormulaBatch::getStatus, status);
        }
        if (workshop != null) {
            wrapper.eq(FormulaBatch::getWorkshop, workshop);
        }
        wrapper.orderByDesc(FormulaBatch::getCreateTime);
        return list(wrapper);
    }

    @DataSource(DataSourceType.FORMULA)
    public FormulaBatch getByBatchNo(String batchNo) {
        LambdaQueryWrapper<FormulaBatch> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FormulaBatch::getBatchNo, batchNo);
        return getOne(wrapper);
    }

    private String generateBatchNo() {
        return "B" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", (int) (Math.random() * 10000));
    }
}
