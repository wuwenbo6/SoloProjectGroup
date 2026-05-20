package com.dye.traceability.formula.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dye.traceability.common.datasource.DataSource;
import com.dye.traceability.common.datasource.DataSourceType;
import com.dye.traceability.common.exception.BusinessException;
import com.dye.traceability.formula.entity.DyeFormula;
import com.dye.traceability.formula.entity.DyeFormulaMaterial;
import com.dye.traceability.formula.mapper.DyeFormulaMapper;
import com.dye.traceability.formula.mapper.DyeFormulaMaterialMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DyeFormulaService extends ServiceImpl<DyeFormulaMapper, DyeFormula> {

    private final DyeFormulaMaterialMapper materialMapper;
    private static final int MAX_RETRY_TIMES = 10;
    private static final AtomicInteger sequence = new AtomicInteger(0);

    @DataSource(DataSourceType.FORMULA)
    @Transactional(rollbackFor = Exception.class)
    public void saveFormula(DyeFormula formula) {
        formula.setFormulaNo(generateUniqueFormulaNo());
        formula.setStatus(1);
        save(formula);

        if (formula.getMaterials() != null && !formula.getMaterials().isEmpty()) {
            for (DyeFormulaMaterial material : formula.getMaterials()) {
                material.setFormulaId(formula.getId());
                materialMapper.insert(material);
            }
        }
    }

    @DataSource(DataSourceType.FORMULA)
    public DyeFormula getDetail(Long id) {
        DyeFormula formula = getById(id);
        if (formula == null) {
            throw new BusinessException("配方不存在");
        }

        LambdaQueryWrapper<DyeFormulaMaterial> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DyeFormulaMaterial::getFormulaId, id);
        wrapper.orderByAsc(DyeFormulaMaterial::getSortOrder);
        List<DyeFormulaMaterial> materials = materialMapper.selectList(wrapper);
        formula.setMaterials(materials);

        return formula;
    }

    @DataSource(DataSourceType.FORMULA)
    public List<DyeFormula> listByCondition(String colorSystem, String colorCode, String keyword) {
        LambdaQueryWrapper<DyeFormula> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DyeFormula::getDeleted, 0);
        if (colorSystem != null) {
            wrapper.eq(DyeFormula::getColorSystem, colorSystem);
        }
        if (colorCode != null) {
            wrapper.eq(DyeFormula::getColorCode, colorCode);
        }
        if (keyword != null) {
            wrapper.and(w -> w.like(DyeFormula::getFormulaName, keyword)
                    .or().like(DyeFormula::getFormulaNo, keyword));
        }
        wrapper.orderByDesc(DyeFormula::getCreateTime);
        return list(wrapper);
    }

    @DataSource(DataSourceType.FORMULA)
    public Map<String, List<DyeFormula>> getExpireWarning(Integer warningDays) {
        LocalDate today = LocalDate.now();
        LocalDate warningDate = today.plusDays(warningDays != null ? warningDays : 30);

        LambdaQueryWrapper<DyeFormula> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DyeFormula::getDeleted, 0);
        wrapper.eq(DyeFormula::getStatus, 1);
        wrapper.isNotNull(DyeFormula::getExpireDate);
        wrapper.le(DyeFormula::getExpireDate, warningDate);
        wrapper.orderByAsc(DyeFormula::getExpireDate);

        List<DyeFormula> formulaList = list(wrapper);
        Map<String, List<DyeFormula>> result = new HashMap<>();
        result.put("expired", new ArrayList<>());
        result.put("critical", new ArrayList<>());
        result.put("warning", new ArrayList<>());

        for (DyeFormula formula : formulaList) {
            long days = ChronoUnit.DAYS.between(today, formula.getExpireDate());
            formula.setDaysUntilExpire(days);

            if (days < 0) {
                formula.setWarningLevel("已过期");
                result.get("expired").add(formula);
            } else if (days <= 7) {
                formula.setWarningLevel("紧急");
                result.get("critical").add(formula);
            } else {
                formula.setWarningLevel("预警");
                result.get("warning").add(formula);
            }
        }

        log.info("配方过期预警查询完成，共{}条记录，已过期{}条，紧急{}条，预警{}条",
                formulaList.size(), result.get("expired").size(),
                result.get("critical").size(), result.get("warning").size());
        return result;
    }

    @DataSource(DataSourceType.FORMULA)
    public Map<String, List<DyeFormula>> getFormulaByOrigin(String originPlace) {
        LambdaQueryWrapper<DyeFormulaMaterial> materialWrapper = new LambdaQueryWrapper<>();
        if (originPlace != null) {
            materialWrapper.like(DyeFormulaMaterial::getOriginPlace, originPlace);
        }
        List<DyeFormulaMaterial> materials = materialMapper.selectList(materialWrapper);

        List<Long> formulaIds = materials.stream()
                .map(DyeFormulaMaterial::getFormulaId)
                .distinct()
                .collect(Collectors.toList());

        if (formulaIds.isEmpty()) {
            return new HashMap<>();
        }

        List<DyeFormula> formulas = listByIds(formulaIds);
        Map<String, List<DyeFormula>> result = new HashMap<>();

        for (DyeFormula formula : formulas) {
            LambdaQueryWrapper<DyeFormulaMaterial> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(DyeFormulaMaterial::getFormulaId, formula.getId());
            List<DyeFormulaMaterial> formulaMaterials = materialMapper.selectList(wrapper);
            formula.setMaterials(formulaMaterials);

            for (DyeFormulaMaterial material : formulaMaterials) {
                String origin = material.getOriginPlace();
                if (origin != null) {
                    result.computeIfAbsent(origin, k -> new ArrayList<>()).add(formula);
                }
            }
        }

        return result;
    }

    private String generateUniqueFormulaNo() {
        for (int i = 0; i < MAX_RETRY_TIMES; i++) {
            String formulaNo = generateFormulaNo();
            LambdaQueryWrapper<DyeFormula> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(DyeFormula::getFormulaNo, formulaNo);
            wrapper.last("LIMIT 1");
            if (getOne(wrapper) == null) {
                return formulaNo;
            }
            log.warn("配方编号重复, 正在重试: {}, 第{}次重试", formulaNo, i + 1);
        }
        throw new BusinessException("生成唯一配方编号失败，请稍后重试");
    }

    private String generateFormulaNo() {
        int seq = sequence.incrementAndGet() % 10000;
        return "DF" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + String.format("%04d", seq)
                + IdUtil.nanoId(4);
    }
}
