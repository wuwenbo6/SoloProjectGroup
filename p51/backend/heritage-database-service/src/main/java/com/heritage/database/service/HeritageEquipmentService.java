package com.heritage.database.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.heritage.database.entity.HeritageEquipment;
import com.heritage.database.mapper.HeritageEquipmentMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class HeritageEquipmentService extends ServiceImpl<HeritageEquipmentMapper, HeritageEquipment> {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    private static final String EQUIPMENT_CACHE_KEY = "heritage:equipment:";
    private static final String LIST_CACHE_KEY = "heritage:equipment:list";
    private static final String CATEGORY_CACHE_KEY = "heritage:equipment:category:";
    
    public List<HeritageEquipment> listAll() {
        Object cached = redisTemplate.opsForValue().get(LIST_CACHE_KEY);
        if (cached != null) {
            return (List<HeritageEquipment>) cached;
        }
        
        List<HeritageEquipment> result = list(new LambdaQueryWrapper<HeritageEquipment>()
                .eq(HeritageEquipment::getIsDeleted, 0)
                .orderByDesc(HeritageEquipment::getCreateTime));
        
        redisTemplate.opsForValue().set(LIST_CACHE_KEY, result, 5, TimeUnit.MINUTES);
        return result;
    }
    
    public List<HeritageEquipment> listByCategory(String category) {
        String cacheKey = CATEGORY_CACHE_KEY + category;
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return (List<HeritageEquipment>) cached;
        }
        
        List<HeritageEquipment> result = list(new LambdaQueryWrapper<HeritageEquipment>()
                .eq(HeritageEquipment::getIsDeleted, 0)
                .eq(HeritageEquipment::getCategory, category)
                .orderByDesc(HeritageEquipment::getCreateTime));
        
        redisTemplate.opsForValue().set(cacheKey, result, 5, TimeUnit.MINUTES);
        return result;
    }
    
    public List<HeritageEquipment> search(String keyword) {
        return list(new LambdaQueryWrapper<HeritageEquipment>()
                .eq(HeritageEquipment::getIsDeleted, 0)
                .and(wrapper -> wrapper
                        .like(HeritageEquipment::getName, keyword)
                        .or()
                        .like(HeritageEquipment::getFactory, keyword)
                        .or()
                        .like(HeritageEquipment::getEquipmentType, keyword))
                .orderByDesc(HeritageEquipment::getCreateTime));
    }
    
    @Async
    public CompletableFuture<List<HeritageEquipment>> listAllAsync() {
        return CompletableFuture.completedFuture(listAll());
    }
    
    @Async
    public CompletableFuture<List<HeritageEquipment>> listByCategoryAsync(String category) {
        return CompletableFuture.completedFuture(listByCategory(category));
    }
    
    public HeritageEquipment getDetailById(Long id) {
        String cacheKey = EQUIPMENT_CACHE_KEY + id;
        HeritageEquipment cached = (HeritageEquipment) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached;
        }
        
        HeritageEquipment equipment = getById(id);
        if (equipment != null) {
            redisTemplate.opsForValue().set(cacheKey, equipment, 1, TimeUnit.HOURS);
        }
        return equipment;
    }
    
    public boolean saveEquipment(HeritageEquipment equipment) {
        equipment.setCreateTime(LocalDateTime.now());
        equipment.setUpdateTime(LocalDateTime.now());
        equipment.setIsDeleted(0);
        boolean result = save(equipment);
        if (result) {
            clearListCache();
        }
        return result;
    }
    
    public boolean updateEquipment(HeritageEquipment equipment) {
        equipment.setUpdateTime(LocalDateTime.now());
        boolean result = updateById(equipment);
        if (result) {
            redisTemplate.delete(EQUIPMENT_CACHE_KEY + equipment.getId());
            clearListCache();
        }
        return result;
    }
    
    public boolean deleteEquipment(Long id) {
        HeritageEquipment equipment = new HeritageEquipment();
        equipment.setId(id);
        equipment.setIsDeleted(1);
        equipment.setUpdateTime(LocalDateTime.now());
        boolean result = updateById(equipment);
        if (result) {
            redisTemplate.delete(EQUIPMENT_CACHE_KEY + id);
            clearListCache();
        }
        return result;
    }
    
    private void clearListCache() {
        redisTemplate.delete(LIST_CACHE_KEY);
        redisTemplate.delete(redisTemplate.keys(CATEGORY_CACHE_KEY + "*"));
    }
    
    public List<String> getAllCategories() {
        return baseMapper.selectAllCategories();
    }
    
    public Map<String, Object> getStatistics() {
        return Map.of(
                "total", baseMapper.countTotal(),
                "categories", baseMapper.selectAllCategories().size(),
                "lastSyncTime", LocalDateTime.now().toString()
        );
    }
    
    @Scheduled(cron = "${heritage.sync.cron:0 0 2 * * ?}")
    public void syncExternalData() {
        System.out.println("Starting external data sync...");
        try {
            List<HeritageEquipment> pendingList = baseMapper.selectPendingSync(100);
            for (HeritageEquipment equipment : pendingList) {
                syncSingleEquipment(equipment);
            }
            System.out.println("External data sync completed: " + pendingList.size() + " items processed");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void syncSingleEquipment(HeritageEquipment equipment) {
        equipment.setSyncStatus(1);
        equipment.setLastSyncTime(LocalDateTime.now());
        updateById(equipment);
    }
    
    public void importFromExternalSource(List<HeritageEquipment> equipmentList) {
        for (HeritageEquipment equipment : equipmentList) {
            equipment.setSource("IMPORT");
            equipment.setSyncStatus(1);
            equipment.setLastSyncTime(LocalDateTime.now());
            equipment.setCreateTime(LocalDateTime.now());
            equipment.setUpdateTime(LocalDateTime.now());
            equipment.setIsDeleted(0);
            save(equipment);
        }
    }
    
    @PostConstruct
    public void initMockData() {
        if (count() == 0) {
            String[] categories = {"动力设备", "加工设备", "运输设备", "纺织设备", "冶金设备"};
            String[] factories = {"沈阳机床厂", "哈尔滨电机厂", "武汉钢铁厂", "上海汽轮机厂", "洛阳拖拉机厂"};
            String[] statuses = {"保存完好", "轻微破损", "中度破损", "严重破损", "待修复"};
            
            for (int i = 1; i <= 50; i++) {
                HeritageEquipment equipment = new HeritageEquipment();
                equipment.setEquipmentCode("EQ-" + String.format("%04d", i));
                equipment.setName("工业设备-" + i);
                equipment.setEquipmentType(categories[i % 5]);
                equipment.setCategory(categories[i % 5]);
                equipment.setFactory(factories[i % 5]);
                equipment.setManufactureYear(1950 + (i % 40));
                equipment.setRetireYear(1980 + (i % 30));
                equipment.setLocation("工业博物馆-" + (i % 10) + "区");
                equipment.setWeight(1000.0 + i * 100);
                equipment.setDimensions((100 + i) + "x" + (50 + i) + "x" + (80 + i) + "cm");
                equipment.setMaterial(i % 2 == 0 ? "铸铁" : "铸钢");
                equipment.setOriginalPurpose("生产制造");
                equipment.setHistoricalBackground("该设备见证了中国工业化进程");
                equipment.setTechnicalSpecs("型号:X" + i + ",功率:" + (100 + i) + "KW");
                equipment.setStatus(statuses[i % 5]);
                equipment.setDamageLevel(i % 4 == 0 ? "严重" : i % 4 == 1 ? "中度" : "轻微");
                equipment.setPreservationCondition("一般");
                equipment.setOwnerUnit("某国有工厂");
                equipment.setContactPerson("张" + i);
                equipment.setContactPhone("1380000" + String.format("%04d", i));
                equipment.setSource("MOCK");
                equipment.setTags("古董,设备,工业遗产");
                saveEquipment(equipment);
            }
        }
    }
}