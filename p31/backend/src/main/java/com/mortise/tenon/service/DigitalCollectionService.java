package com.mortise.tenon.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.mortise.tenon.entity.MortiseTenonModel;
import com.mortise.tenon.entity.MortiseTenonType;
import com.mortise.tenon.repository.MortiseTenonModelRepository;
import com.mortise.tenon.repository.MortiseTenonTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DigitalCollectionService {

    @Autowired
    private MortiseTenonModelRepository modelRepository;

    @Autowired
    private MortiseTenonTypeRepository typeRepository;

    private final RestTemplate restTemplate = new RestTemplate();
    
    private final Map<String, Object> syncCache = new ConcurrentHashMap<>();
    
    private static final String MOCK_COLLECTION_API = "https://api.mock-digital-collection.com/mortise";
    
    private static final Map<String, String> COLLECTION_SOURCES = new HashMap<>();
    static {
        COLLECTION_SOURCES.put("gu_gong", "故宫博物院古建筑馆藏");
        COLLECTION_SOURCES.put("ying_xian", "应县木塔数字化馆藏");
        COLLECTION_SOURCES.put("su_zhou", "苏州园林建筑馆藏");
        COLLECTION_SOURCES.put("wu_dang", "武当山古建筑馆藏");
        COLLECTION_SOURCES.put("shan_xi", "山西古建博物馆馆藏");
    }

    @PostConstruct
    public void init() {
        syncCache.put("lastSyncTime", 0L);
        syncCache.put("totalModels", 0);
        syncCache.put("syncStatus", "idle");
    }

    public JSONObject syncFromCollection(String sourceId) {
        JSONObject result = new JSONObject();
        result.put("success", false);
        result.put("message", "");
        result.put("syncedCount", 0);
        
        try {
            syncCache.put("syncStatus", "syncing");
            
            List<MortiseTenonModel> mockModels = generateMockCollectionData(sourceId);
            int syncedCount = 0;
            
            for (MortiseTenonModel model : mockModels) {
                Optional<MortiseTenonModel> existing = modelRepository.findByModelCode(model.getModelCode());
                if (existing.isEmpty()) {
                    modelRepository.save(model);
                    syncedCount++;
                }
            }
            
            syncCache.put("lastSyncTime", System.currentTimeMillis());
            syncCache.put("totalModels", (int)syncCache.get("totalModels") + syncedCount);
            syncCache.put("syncStatus", "completed");
            
            result.put("success", true);
            result.put("message", "从" + COLLECTION_SOURCES.getOrDefault(sourceId, sourceId) + "同步完成");
            result.put("syncedCount", syncedCount);
            result.put("source", sourceId);
            result.put("sourceName", COLLECTION_SOURCES.getOrDefault(sourceId, sourceId));
            
        } catch (Exception e) {
            syncCache.put("syncStatus", "error");
            result.put("message", "同步失败: " + e.getMessage());
        }
        
        return result;
    }

    public JSONObject syncAllCollections() {
        JSONObject result = new JSONObject();
        JSONArray results = new JSONArray();
        int totalSynced = 0;
        
        for (String sourceId : COLLECTION_SOURCES.keySet()) {
            JSONObject syncResult = syncFromCollection(sourceId);
            results.add(syncResult);
            totalSynced += syncResult.getInteger("syncedCount");
        }
        
        result.put("results", results);
        result.put("totalSynced", totalSynced);
        result.put("success", true);
        
        return result;
    }

    private List<MortiseTenonModel> generateMockCollectionData(String sourceId) {
        List<MortiseTenonModel> models = new ArrayList<>();
        
        String[][] modelData = getCollectionModelData(sourceId);
        
        for (String[] data : modelData) {
            MortiseTenonModel model = new MortiseTenonModel();
            model.setModelCode(sourceId + "_" + data[0]);
            model.setModelName(data[1]);
            model.setAncientBuildingName(data[2]);
            model.setBuildingLocation(data[3]);
            model.setHistoricalPeriod(data[4]);
            model.setDescription(data[5]);
            model.setCraftsmanship(data[6]);
            model.setVertexCount(Integer.parseInt(data[7]));
            model.setFaceCount(Integer.parseInt(data[8]));
            model.setComponentCount(Integer.parseInt(data[9]));
            model.setIsPublished(true);
            model.setViewCount(0);
            models.add(model);
        }
        
        return models;
    }

    private String[][] getCollectionModelData(String sourceId) {
        switch (sourceId) {
            case "gu_gong":
                return new String[][] {
                    {"001", "太和殿梁架燕尾榫", "故宫太和殿", "北京", "明代", "太和殿主梁连接采用燕尾榫，历经600年仍坚固如初", "传统大木作工艺", "12560", "25120", "3"},
                    {"002", "斗拱组合榫卯", "故宫太和殿", "北京", "清代", "太和殿上层斗拱群采用的复杂组合榫卯结构", "清式斗拱工艺", "28600", "57200", "8"},
                    {"003", "角梁霸王拳", "故宫角楼", "北京", "明代", "故宫角楼角梁装饰性榫卯，造型优美", "官式建筑装饰工艺", "9800", "19600", "2"}
                };
            case "ying_xian":
                return new String[][] {
                    {"001", "佛宫寺释迦塔层间榫", "应县木塔", "山西应县", "辽代", "世界最高木塔各层间连接榫卯，抗震性能卓越", "辽代木塔工艺", "35200", "70400", "12"},
                    {"002", "木塔暗榫结构", "应县木塔", "山西应县", "辽代", "内部暗榫，不外露但承担主要承重", "暗榫工艺", "18900", "37800", "5"},
                    {"003", "塔刹连接榫", "应县木塔", "山西应县", "辽代", "塔刹与塔身连接特殊榫卯，承受风荷载巨大", "高耸结构工艺", "7600", "15200", "2"}
                };
            case "su_zhou":
                return new String[][] {
                    {"001", "拙政园卅六鸳鸯馆格肩榫", "拙政园", "江苏苏州", "明代", "江南园林建筑典型格肩榫，精致细腻", "苏式木作工艺", "11200", "22400", "4"},
                    {"002", "留园冠云楼半榫", "留园", "江苏苏州", "清代", "装饰性半榫结构，体现江南园林美学", "半榫装饰工艺", "8400", "16800", "3"},
                    {"003", "网师园月到风来亭挂榫", "网师园", "江苏苏州", "清代", "亭台悬挑构件专用挂榫，造型独特", "悬挑挂榫工艺", "6200", "12400", "2"}
                };
            case "wu_dang":
                return new String[][] {
                    {"001", "紫霄宫大殿抬梁式榫卯", "紫霄宫", "湖北武当山", "明代", "道教建筑典型抬梁式结构，榫卯受力合理", "道教建筑工艺", "22800", "45600", "6"},
                    {"002", "金殿铜木结合榫", "太和宫金殿", "湖北武当山", "明代", "铜构件与木构件的特殊连接榫卯", "铜木复合工艺", "15600", "31200", "4"},
                    {"003", "南岩宫悬挑斗拱榫", "南岩宫", "湖北武当山", "元代", "悬崖悬挑建筑斗拱群榫卯，工艺惊人", "悬挑斗拱工艺", "19400", "38800", "5"}
                };
            case "shan_xi":
                return new String[][] {
                    {"001", "佛光寺东大殿唐代榫卯", "佛光寺", "山西五台山", "唐代", "现存最古老木构建筑榫卯，唐代木作标本", "唐代木作工艺", "26800", "53600", "7"},
                    {"002", "应县净土寺天宫楼阁藻井榫", "净土寺", "山西应县", "金代", "藻井中微型天宫楼阁的精密榫卯", "小木作工艺", "42600", "85200", "15"},
                    {"003", "晋祠圣母殿减柱造榫卯", "晋祠", "山西太原", "宋代", "减柱造法的大跨度梁架榫卯结构", "宋代减柱造工艺", "31200", "62400", "8"}
                };
            default:
                return new String[0][];
        }
    }

    public JSONObject getSyncStatus() {
        JSONObject status = new JSONObject();
        status.putAll(syncCache);
        status.put("availableSources", getAvailableSources());
        return status;
    }

    public JSONArray getAvailableSources() {
        JSONArray sources = new JSONArray();
        for (Map.Entry<String, String> entry : COLLECTION_SOURCES.entrySet()) {
            JSONObject source = new JSONObject();
            source.put("id", entry.getKey());
            source.put("name", entry.getValue());
            sources.add(source);
        }
        return sources;
    }

    public JSONObject getCollectionStatistics() {
        JSONObject stats = new JSONObject();
        
        List<MortiseTenonModel> allModels = modelRepository.findAll();
        stats.put("totalModels", allModels.size());
        
        Map<String, Integer> sourceCount = new HashMap<>();
        Map<String, Integer> periodCount = new HashMap<>();
        
        for (MortiseTenonModel model : allModels) {
            String code = model.getModelCode();
            for (String sourceId : COLLECTION_SOURCES.keySet()) {
                if (code.startsWith(sourceId)) {
                    sourceCount.put(sourceId, sourceCount.getOrDefault(sourceId, 0) + 1);
                    break;
                }
            }
            String period = model.getHistoricalPeriod();
            periodCount.put(period, periodCount.getOrDefault(period, 0) + 1);
        }
        
        stats.put("sourceDistribution", sourceCount);
        stats.put("periodDistribution", periodCount);
        
        return stats;
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void autoSync() {
        System.out.println("执行定时自动同步馆藏数据...");
        syncAllCollections();
        System.out.println("馆藏数据自动同步完成");
    }
}
