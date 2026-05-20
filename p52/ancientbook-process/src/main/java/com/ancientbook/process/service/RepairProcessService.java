package com.ancientbook.process.service;

import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.process.entity.RepairProcess;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@DataSource(DataSourceType.PROCESS)
public class RepairProcessService {

    public List<RepairProcess> getAllEnabled() {
        List<RepairProcess> list = new ArrayList<>();
        RepairProcess p1 = new RepairProcess();
        p1.setId(1L);
        p1.setProcessCode("PROC_001");
        p1.setProcessName("干式除尘法");
        p1.setProcessType(1);
        p1.setMinConditionLevel(1);
        p1.setMaxConditionLevel(4);
        p1.setApplicableMaterials("宣纸,皮纸,竹纸");
        p1.setDifficultyLevel(1);
        p1.setSuccessRate(new java.math.BigDecimal("98.50"));
        p1.setStatus(1);
        list.add(p1);

        RepairProcess p2 = new RepairProcess();
        p2.setId(2L);
        p2.setProcessCode("PROC_002");
        p2.setProcessName("湿法清洁法");
        p2.setProcessType(1);
        p2.setMinConditionLevel(1);
        p2.setMaxConditionLevel(3);
        p2.setApplicableMaterials("宣纸,皮纸");
        p2.setDifficultyLevel(2);
        p2.setSuccessRate(new java.math.BigDecimal("95.00"));
        p2.setStatus(1);
        list.add(p2);

        RepairProcess p3 = new RepairProcess();
        p3.setId(3L);
        p3.setProcessCode("PROC_003");
        p3.setProcessName("纸浆修补法");
        p3.setProcessType(2);
        p3.setMinConditionLevel(2);
        p3.setMaxConditionLevel(4);
        p3.setApplicableMaterials("宣纸,皮纸,竹纸");
        p3.setDifficultyLevel(3);
        p3.setSuccessRate(new java.math.BigDecimal("92.00"));
        p3.setStatus(1);
        list.add(p3);

        return list;
    }
}
