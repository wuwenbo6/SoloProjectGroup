package com.heritage.equipment.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.heritage.common.entity.DamageMark;
import com.heritage.common.entity.Equipment;
import com.heritage.common.entity.EquipmentPart;
import com.heritage.equipment.mapper.DamageMarkMapper;
import com.heritage.equipment.mapper.EquipmentMapper;
import com.heritage.equipment.mapper.EquipmentPartMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EquipmentService extends ServiceImpl<EquipmentMapper, Equipment> {

    @Autowired
    private EquipmentPartMapper partMapper;

    @Autowired
    private DamageMarkMapper damageMarkMapper;

    public Equipment getDetailById(Long id) {
        if (id == null) {
            return null;
        }
        Equipment equipment = this.getById(id);
        if (equipment != null) {
            try {
                List<EquipmentPart> parts = partMapper.selectList(
                        new LambdaQueryWrapper<EquipmentPart>().eq(EquipmentPart::getEquipmentId, id)
                                .orderByAsc(EquipmentPart::getSortOrder));
                List<DamageMark> damageMarks = damageMarkMapper.selectList(
                        new LambdaQueryWrapper<DamageMark>().eq(DamageMark::getEquipmentId, id));
                equipment.setParts(parts);
                equipment.setDamageMarks(damageMarks);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return equipment;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean saveEquipment(Equipment equipment) {
        boolean result = this.save(equipment);
        if (result && equipment.getParts() != null) {
            for (EquipmentPart part : equipment.getParts()) {
                part.setEquipmentId(equipment.getId());
                partMapper.insert(part);
            }
        }
        return result;
    }

    public List<EquipmentPart> getPartsByEquipmentId(Long equipmentId) {
        return partMapper.selectList(
                new LambdaQueryWrapper<EquipmentPart>().eq(EquipmentPart::getEquipmentId, equipmentId)
                        .orderByAsc(EquipmentPart::getSortOrder));
    }

    public List<DamageMark> getDamageMarksByEquipmentId(Long equipmentId) {
        return damageMarkMapper.selectList(
                new LambdaQueryWrapper<DamageMark>().eq(DamageMark::getEquipmentId, equipmentId));
    }

    public boolean saveDamageMark(DamageMark damageMark) {
        return damageMarkMapper.insert(damageMark) > 0;
    }
}
