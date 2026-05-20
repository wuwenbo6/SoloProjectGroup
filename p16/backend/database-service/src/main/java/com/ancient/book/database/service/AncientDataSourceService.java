package com.ancient.book.database.service;

import com.ancient.book.common.entity.AncientDataSource;
import com.ancient.book.common.entity.AncientBookRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@Slf4j
@Service
@RequiredArgsConstructor
public class AncientDataSourceService {

    private final Map<Long, AncientDataSource> dataSources = new ConcurrentHashMap<>();
    private final Map<String, AncientBookRecord> bookRecords = new ConcurrentHashMap<>();
    private final Map<Long, Future<?>> syncTasks = new ConcurrentHashMap<>();

    private final RestTemplate restTemplate = new RestTemplate();
    private final ExecutorService syncExecutor = Executors.newFixedThreadPool(5);

    @PostConstruct
    public void init() {
        log.info("初始化古籍数据源服务...");
        initializeBuiltInDataSources();
        log.info("古籍数据源服务初始化完成，共加载 {} 个数据源", dataSources.size());
    }

    private void initializeBuiltInDataSources() {
        AncientDataSource nationalLibrary = new AncientDataSource();
        nationalLibrary.setId(1L);
        nationalLibrary.setSourceName("中国国家图书馆");
        nationalLibrary.setInstitution("国家图书馆");
        nationalLibrary.setRegion("北京");
        nationalLibrary.setApiEndpoint("https://api.nlc.cn/ancient-books/v1");
        nationalLibrary.setAuthType("API_KEY");
        nationalLibrary.setDataFormat("JSON");
        nationalLibrary.setSyncFrequency("DAILY");
        nationalLibrary.setMaxRetries(3);
        nationalLibrary.setRetryIntervalSeconds(60);
        nationalLibrary.setTimeoutMs(30000L);
        nationalLibrary.setIsEnabled(true);
        nationalLibrary.setStatus("ACTIVE");
        nationalLibrary.setDescription("国家图书馆古籍资源库，包含宋、元、明、清珍本");
        nationalLibrary.setTotalRecordsFetched(0L);
        nationalLibrary.setCreateTime(LocalDateTime.now());
        dataSources.put(1L, nationalLibrary);

        AncientDataSource shanghaiLibrary = new AncientDataSource();
        shanghaiLibrary.setId(2L);
        shanghaiLibrary.setSourceName("上海图书馆");
        shanghaiLibrary.setInstitution("上海图书馆");
        shanghaiLibrary.setRegion("上海");
        shanghaiLibrary.setApiEndpoint("https://api.library.sh.cn/ancient/v1");
        shanghaiLibrary.setAuthType("NONE");
        shanghaiLibrary.setDataFormat("JSON");
        shanghaiLibrary.setSyncFrequency("WEEKLY");
        shanghaiLibrary.setMaxRetries(3);
        shanghaiLibrary.setRetryIntervalSeconds(60);
        shanghaiLibrary.setTimeoutMs(30000L);
        shanghaiLibrary.setIsEnabled(true);
        shanghaiLibrary.setStatus("ACTIVE");
        shanghaiLibrary.setDescription("上海图书馆善本古籍库");
        shanghaiLibrary.setTotalRecordsFetched(0L);
        shanghaiLibrary.setCreateTime(LocalDateTime.now());
        dataSources.put(2L, shanghaiLibrary);

        AncientDataSource dunhuang = new AncientDataSource();
        dunhuang.setId(3L);
        dunhuang.setSourceName("敦煌研究院");
        dunhuang.setInstitution("敦煌研究院");
        dunhuang.setRegion("甘肃");
        dunhuang.setApiEndpoint("https://api.dha.ac.cn/dunhuang/v1");
        dunhuang.setAuthType("OAUTH2");
        dunhuang.setDataFormat("JSON");
        dunhuang.setSyncFrequency("MONTHLY");
        dunhuang.setMaxRetries(5);
        dunhuang.setRetryIntervalSeconds(120);
        dunhuang.setTimeoutMs(60000L);
        dunhuang.setIsEnabled(true);
        dunhuang.setStatus("ACTIVE");
        dunhuang.setDescription("敦煌遗书数字化资源库");
        dunhuang.setTotalRecordsFetched(0L);
        dunhuang.setCreateTime(LocalDateTime.now());
        dataSources.put(3L, dunhuang);

        AncientDataSource palaceMuseum = new AncientDataSource();
        palaceMuseum.setId(4L);
        palaceMuseum.setSourceName("故宫博物院");
        palaceMuseum.setInstitution("故宫博物院");
        palaceMuseum.setRegion("北京");
        palaceMuseum.setApiEndpoint("https://api.dpm.org.cn/collections/v1");
        palaceMuseum.setAuthType("API_KEY");
        palaceMuseum.setDataFormat("JSON");
        palaceMuseum.setSyncFrequency("WEEKLY");
        palaceMuseum.setMaxRetries(3);
        palaceMuseum.setRetryIntervalSeconds(60);
        palaceMuseum.setTimeoutMs(30000L);
        palaceMuseum.setIsEnabled(true);
        palaceMuseum.setStatus("ACTIVE");
        palaceMuseum.setDescription("故宫博物院藏古籍善本");
        palaceMuseum.setTotalRecordsFetched(0L);
        palaceMuseum.setCreateTime(LocalDateTime.now());
        dataSources.put(4L, palaceMuseum);

        AncientDataSource fudan = new AncientDataSource();
        fudan.setId(5L);
        fudan.setSourceName("复旦大学图书馆");
        fudan.setInstitution("复旦大学");
        fudan.setRegion("上海");
        fudan.setApiEndpoint("https://api.library.fudan.edu.cn/ancient/v1");
        fudan.setAuthType("NONE");
        fudan.setDataFormat("JSON");
        fudan.setSyncFrequency("MONTHLY");
        fudan.setMaxRetries(3);
        fudan.setRetryIntervalSeconds(60);
        fudan.setTimeoutMs(30000L);
        fudan.setIsEnabled(true);
        fudan.setStatus("ACTIVE");
        fudan.setDescription("复旦大学古籍整理研究所藏本");
        fudan.setTotalRecordsFetched(0L);
        fudan.setCreateTime(LocalDateTime.now());
        dataSources.put(5L, fudan);
    }

    public List<AncientDataSource> getAllDataSources() {
        return new ArrayList<>(dataSources.values());
    }

    public AncientDataSource getDataSourceById(Long id) {
        return dataSources.get(id);
    }

    public AncientDataSource addDataSource(AncientDataSource dataSource) {
        Long newId = dataSources.keySet().stream().max(Long::compareTo).orElse(0L) + 1;
        dataSource.setId(newId);
        dataSource.setCreateTime(LocalDateTime.now());
        dataSource.setUpdateTime(LocalDateTime.now());
        dataSources.put(newId, dataSource);
        log.info("新增数据源: {} - {}", dataSource.getSourceName(), dataSource.getInstitution());
        return dataSource;
    }

    public AncientDataSource updateDataSource(Long id, AncientDataSource dataSource) {
        AncientDataSource existing = dataSources.get(id);
        if (existing != null) {
            dataSource.setId(id);
            dataSource.setUpdateTime(LocalDateTime.now());
            dataSources.put(id, dataSource);
            log.info("更新数据源: {}", dataSource.getSourceName());
        }
        return dataSource;
    }

    public boolean deleteDataSource(Long id) {
        AncientDataSource removed = dataSources.remove(id);
        if (removed != null) {
            log.info("删除数据源: {}", removed.getSourceName());
            return true;
        }
        return false;
    }

    public Map<String, Object> syncDataSource(Long sourceId) {
        AncientDataSource dataSource = dataSources.get(sourceId);
        if (dataSource == null) {
            return Map.of("success", false, "message", "数据源不存在");
        }

        if (!dataSource.getIsEnabled()) {
            return Map.of("success", false, "message", "数据源未启用");
        }

        if (syncTasks.containsKey(sourceId) && !syncTasks.get(sourceId).isDone()) {
            return Map.of("success", false, "message", "同步任务正在进行中");
        }

        Future<?> future = syncExecutor.submit(() -> performSync(dataSource));
        syncTasks.put(sourceId, future);

        log.info("启动数据源同步: {}", dataSource.getSourceName());
        return Map.of("success", true, "message", "同步任务已启动", "sourceId", sourceId);
    }

    private void performSync(AncientDataSource dataSource) {
        log.info("开始同步数据源: {}", dataSource.getSourceName());
        int fetchedCount = 0;

        try {
            dataSource.setStatus("SYNCING");
            dataSource.setLastSyncTime(LocalDateTime.now());

            List<AncientBookRecord> mockRecords = generateMockRecords(dataSource, 20);

            for (AncientBookRecord record : mockRecords) {
                String recordKey = dataSource.getId() + "_" + record.getExternalId();
                bookRecords.put(recordKey, record);
                fetchedCount++;

                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            dataSource.setTotalRecordsFetched(dataSource.getTotalRecordsFetched() + fetchedCount);
            dataSource.setStatus("ACTIVE");
            dataSource.setLastSyncResult("SUCCESS");

            log.info("数据源同步完成: {}, 新增 {} 条记录", dataSource.getSourceName(), fetchedCount);

        } catch (Exception e) {
            log.error("数据源同步失败: {}, 错误: {}", dataSource.getSourceName(), e.getMessage());
            dataSource.setStatus("ERROR");
            dataSource.setLastSyncResult("FAILED: " + e.getMessage());
        }
    }

    private List<AncientBookRecord> generateMockRecords(AncientDataSource dataSource, int count) {
        List<AncientBookRecord> records = new ArrayList<>();
        String[] dynasties = {"宋", "元", "明", "清"};
        String[] categories = {"经部", "史部", "子部", "集部"};
        String[] conditions = {"完好", "轻微破损", "中度破损", "严重破损"};

        for (int i = 0; i < count; i++) {
            AncientBookRecord record = new AncientBookRecord();
            record.setExternalId(dataSource.getId() + "_REC_" + System.currentTimeMillis() + "_" + i);
            record.setDataSourceId(dataSource.getId());
            record.setTitle("古籍样本_" + (i + 1));
            record.setOriginalTitle("古本_" + (i + 1));
            record.setAuthor("佚名");
            record.setDynasty(dynasties[new Random().nextInt(dynasties.length)]);
            record.setCategory(categories[new Random().nextInt(categories.length)]);
            record.setPageCount(100 + new Random().nextInt(500));
            record.setVolumeCount(1 + new Random().nextInt(20));
            record.setCondition(conditions[new Random().nextInt(conditions.length)]);
            record.setRepositoryLocation(dataSource.getRegion());
            record.setAccessLevel("PUBLIC");
            record.setCopyrightStatus("PUBLIC_DOMAIN");
            record.setFetchStatus("COMPLETED");
            record.setFetchTime(LocalDateTime.now());
            record.setRetryCount(0);
            record.setCreateTime(LocalDateTime.now());
            record.setUpdateTime(LocalDateTime.now());
            records.add(record);
        }

        return records;
    }

    public Map<String, Object> getSyncStatus(Long sourceId) {
        AncientDataSource dataSource = dataSources.get(sourceId);
        if (dataSource == null) {
            return Map.of("success", false, "message", "数据源不存在");
        }

        Future<?> task = syncTasks.get(sourceId);
        boolean isSyncing = task != null && !task.isDone();

        Map<String, Object> status = new HashMap<>();
        status.put("sourceId", sourceId);
        status.put("sourceName", dataSource.getSourceName());
        status.put("status", isSyncing ? "SYNCING" : dataSource.getStatus());
        status.put("isEnabled", dataSource.getIsEnabled());
        status.put("lastSyncTime", dataSource.getLastSyncTime());
        status.put("lastSyncResult", dataSource.getLastSyncResult());
        status.put("totalRecordsFetched", dataSource.getTotalRecordsFetched());
        status.put("isSyncing", isSyncing);

        return status;
    }

    public List<AncientBookRecord> searchRecords(String keyword, String region,
                                                   String dynasty, String category,
                                                   int page, int size) {
        return bookRecords.values().stream()
                .filter(r -> keyword == null || keyword.isEmpty() ||
                        r.getTitle().contains(keyword) ||
                        r.getAuthor().contains(keyword))
                .filter(r -> region == null || region.isEmpty() ||
                        r.getRepositoryLocation().contains(region))
                .filter(r -> dynasty == null || dynasty.isEmpty() ||
                        r.getDynasty().equals(dynasty))
                .filter(r -> category == null || category.isEmpty() ||
                        r.getCategory().equals(category))
                .skip((long) page * size)
                .limit(size)
                .toList();
    }

    public AncientBookRecord getRecordById(String recordKey) {
        return bookRecords.get(recordKey);
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalDataSources", dataSources.size());
        stats.put("activeDataSources", dataSources.values().stream()
                .filter(ds -> "ACTIVE".equals(ds.getStatus())).count());
        stats.put("totalRecords", bookRecords.size());
        stats.put("totalRecordsFetched", dataSources.values().stream()
                .mapToLong(AncientDataSource::getTotalRecordsFetched).sum());

        Map<String, Long> recordsByRegion = new HashMap<>();
        bookRecords.values().forEach(r -> {
            String region = r.getRepositoryLocation();
            recordsByRegion.put(region, recordsByRegion.getOrDefault(region, 0L) + 1);
        });
        stats.put("recordsByRegion", recordsByRegion);

        Map<String, Long> recordsByDynasty = new HashMap<>();
        bookRecords.values().forEach(r -> {
            String dynasty = r.getDynasty();
            recordsByDynasty.put(dynasty, recordsByDynasty.getOrDefault(dynasty, 0L) + 1);
        });
        stats.put("recordsByDynasty", recordsByDynasty);

        return stats;
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledSync() {
        log.info("执行定时数据源同步任务...");
        LocalDateTime now = LocalDateTime.now();
        int dayOfWeek = now.getDayOfWeek().getValue();
        int dayOfMonth = now.getDayOfMonth();

        for (AncientDataSource ds : dataSources.values()) {
            if (!ds.getIsEnabled()) continue;

            boolean shouldSync = switch (ds.getSyncFrequency()) {
                case "DAILY" -> true;
                case "WEEKLY" -> dayOfWeek == 1;
                case "MONTHLY" -> dayOfMonth == 1;
                default -> false;
            };

            if (shouldSync) {
                syncDataSource(ds.getId());
            }
        }
    }
}
