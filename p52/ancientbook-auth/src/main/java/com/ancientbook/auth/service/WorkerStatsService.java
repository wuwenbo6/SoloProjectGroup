package com.ancientbook.auth.service;

import com.ancientbook.auth.dto.TaskRecordDTO;
import com.ancientbook.auth.dto.WorkerStatsDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerStatsService {

    private final Map<String, TaskRecordDTO> taskRecords = new ConcurrentHashMap<>();

    public void initMockData() {
        String[] workers = {"张修复师", "李修复师", "王修复师", "赵修复师", "陈修复师"};
        Long[] workerIds = {1L, 2L, 3L, 4L, 5L};
        String[] bookTypes = {"古籍善本", "手抄本", "刻本", "版画", "舆图"};
        String[] dynasties = {"宋", "元", "明", "清", "民国"};
        String[] processes = {"除尘清洁", "脱酸处理", "纸张修补", "托裱加固", "装订复原"};

        Random random = new Random();

        for (int i = 0; i < 200; i++) {
            TaskRecordDTO record = new TaskRecordDTO();
            record.setTaskId("TASK_" + System.currentTimeMillis() + "_" + i);

            int workerIndex = random.nextInt(workers.length);
            record.setWorkerId(workerIds[workerIndex]);
            record.setWorkerName(workers[workerIndex]);
            record.setSkillLevel(1 + random.nextInt(4));

            record.setBookId(1000L + random.nextInt(500));
            record.setBookCode("BOOK_" + (1000 + random.nextInt(500)));
            record.setBookName("古籍样本_" + (random.nextInt(100) + 1));
            record.setBookType(bookTypes[random.nextInt(bookTypes.length)]);
            record.setDynasty(dynasties[random.nextInt(dynasties.length)]);

            int processIdx = random.nextInt(processes.length);
            record.setProcessType(processIdx + 1);
            record.setProcessName(processes[processIdx]);

            LocalDateTime startTime = LocalDateTime.now()
                    .minusDays(random.nextInt(90))
                    .minusHours(random.nextInt(24))
                    .minusMinutes(random.nextInt(60));
            record.setStartTime(startTime);

            int duration = 30 + random.nextInt(180);
            record.setDurationMinutes(duration);

            int status = random.nextInt(4);
            if (status == 0) {
                record.setEndTime(null);
                record.setQualityScore(null);
            } else {
                record.setEndTime(startTime.plusMinutes(duration));
                record.setQualityScore(BigDecimal.valueOf(60 + random.nextInt(41)).setScale(1, RoundingMode.HALF_UP));
            }
            record.setStatus(status);

            record.setMaterialUsed("宣纸,浆糊,绫绢");
            record.setRemark("修复工序记录");
            record.setCreateTime(startTime);

            taskRecords.put(record.getTaskId(), record);
        }

        log.info("初始化模拟数据完成，共{}条记录", taskRecords.size());
    }

    public List<WorkerStatsDTO> getAllWorkerStats() {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        Map<Long, List<TaskRecordDTO>> workerTasks = taskRecords.values().stream()
                .collect(Collectors.groupingBy(TaskRecordDTO::getWorkerId));

        List<WorkerStatsDTO> statsList = new ArrayList<>();

        for (Map.Entry<Long, List<TaskRecordDTO>> entry : workerTasks.entrySet()) {
            WorkerStatsDTO stats = calculateWorkerStats(entry.getKey(), entry.getValue());
            statsList.add(stats);
        }

        statsList.sort((a, b) -> b.getTotalTasks().compareTo(a.getTotalTasks()));

        for (int i = 0; i < statsList.size(); i++) {
            statsList.get(i).setRanking(i + 1);
        }

        return statsList;
    }

    public WorkerStatsDTO getWorkerStatsById(Long workerId) {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        List<TaskRecordDTO> workerTaskList = taskRecords.values().stream()
                .filter(t -> workerId.equals(t.getWorkerId()))
                .collect(Collectors.toList());

        return calculateWorkerStats(workerId, workerTaskList);
    }

    private WorkerStatsDTO calculateWorkerStats(Long workerId, List<TaskRecordDTO> tasks) {
        WorkerStatsDTO stats = new WorkerStatsDTO();
        stats.setWorkerId(workerId);

        if (!tasks.isEmpty()) {
            TaskRecordDTO sample = tasks.get(0);
            stats.setWorkerName(sample.getWorkerName());
            stats.setSkillLevel(sample.getSkillLevel());
            stats.setSpecialty(sample.getWorkerName() + "擅长工艺");
        }

        stats.setTotalTasks((long) tasks.size());

        long completed = tasks.stream().filter(t -> t.getStatus() == 3).count();
        long inProgress = tasks.stream().filter(t -> t.getStatus() == 1 || t.getStatus() == 2).count();
        long pending = tasks.stream().filter(t -> t.getStatus() == 0).count();

        stats.setCompletedTasks(completed);
        stats.setInProgressTasks(inProgress);
        stats.setPendingTasks(pending);

        stats.setTotalBooks(tasks.stream().map(TaskRecordDTO::getBookId).distinct().count());

        stats.setTotalDurationMinutes(tasks.stream()
                .filter(t -> t.getDurationMinutes() != null)
                .mapToLong(TaskRecordDTO::getDurationMinutes)
                .sum());

        Double avgScore = tasks.stream()
                .filter(t -> t.getQualityScore() != null)
                .mapToDouble(t -> t.getQualityScore().doubleValue())
                .average()
                .orElse(0.0);
        stats.setAvgQualityScore(BigDecimal.valueOf(avgScore).setScale(1, RoundingMode.HALF_UP));

        BigDecimal completionRate = stats.getTotalTasks() > 0
                ? BigDecimal.valueOf(completed * 100.0 / stats.getTotalTasks()).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        stats.setCompletionRate(completionRate);

        YearMonth currentMonth = YearMonth.now();
        LocalDateTime monthStart = currentMonth.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = currentMonth.atEndOfMonth().atTime(LocalTime.MAX);

        List<TaskRecordDTO> monthTasks = tasks.stream()
                .filter(t -> t.getCreateTime() != null
                        && !t.getCreateTime().isBefore(monthStart)
                        && !t.getCreateTime().isAfter(monthEnd))
                .collect(Collectors.toList());

        stats.setCurrentMonthTasks((long) monthTasks.size());
        stats.setCurrentMonthBooks(monthTasks.stream().map(TaskRecordDTO::getBookId).distinct().count());

        return stats;
    }

    public List<TaskRecordDTO> queryTaskRecords(Long workerId, String bookType,
                                                 LocalDateTime startTime, LocalDateTime endTime,
                                                 Integer processType, Integer status,
                                                 Integer pageNum, Integer pageSize) {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        return taskRecords.values().stream()
                .filter(t -> workerId == null || workerId.equals(t.getWorkerId()))
                .filter(t -> bookType == null || bookType.isEmpty() || bookType.equals(t.getBookType()))
                .filter(t -> processType == null || processType.equals(t.getProcessType()))
                .filter(t -> status == null || status.equals(t.getStatus()))
                .filter(t -> startTime == null || t.getCreateTime() == null || !t.getCreateTime().isBefore(startTime))
                .filter(t -> endTime == null || t.getCreateTime() == null || !t.getCreateTime().isAfter(endTime))
                .sorted((a, b) -> b.getCreateTime().compareTo(a.getCreateTime()))
                .skip((long) (pageNum - 1) * pageSize)
                .limit(pageSize)
                .collect(Collectors.toList());
    }

    public long countTaskRecords(Long workerId, String bookType,
                                 LocalDateTime startTime, LocalDateTime endTime,
                                 Integer processType, Integer status) {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        return taskRecords.values().stream()
                .filter(t -> workerId == null || workerId.equals(t.getWorkerId()))
                .filter(t -> bookType == null || bookType.isEmpty() || bookType.equals(t.getBookType()))
                .filter(t -> processType == null || processType.equals(t.getProcessType()))
                .filter(t -> status == null || status.equals(t.getStatus()))
                .filter(t -> startTime == null || t.getCreateTime() == null || !t.getCreateTime().isBefore(startTime))
                .filter(t -> endTime == null || t.getCreateTime() == null || !t.getCreateTime().isAfter(endTime))
                .count();
    }

    public Map<String, Object> getStatsSummary() {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        Map<String, Object> summary = new LinkedHashMap<>();

        summary.put("totalWorkers", taskRecords.values().stream().map(TaskRecordDTO::getWorkerId).distinct().count());
        summary.put("totalTasks", taskRecords.size());
        summary.put("totalBooks", taskRecords.values().stream().map(TaskRecordDTO::getBookId).distinct().count());
        summary.put("totalDurationHours", taskRecords.values().stream()
                .filter(t -> t.getDurationMinutes() != null)
                .mapToLong(TaskRecordDTO::getDurationMinutes)
                .sum() / 60.0);

        Map<String, Long> bookTypeStats = taskRecords.values().stream()
                .collect(Collectors.groupingBy(TaskRecordDTO::getBookType, Collectors.counting()));
        summary.put("bookTypeDistribution", bookTypeStats);

        Map<String, Long> dynastyStats = taskRecords.values().stream()
                .collect(Collectors.groupingBy(TaskRecordDTO::getDynasty, Collectors.counting()));
        summary.put("dynastyDistribution", dynastyStats);

        Map<String, Long> processStats = taskRecords.values().stream()
                .collect(Collectors.groupingBy(TaskRecordDTO::getProcessName, Collectors.counting()));
        summary.put("processDistribution", processStats);

        Double avgScore = taskRecords.values().stream()
                .filter(t -> t.getQualityScore() != null)
                .mapToDouble(t -> t.getQualityScore().doubleValue())
                .average()
                .orElse(0.0);
        summary.put("avgQualityScore", BigDecimal.valueOf(avgScore).setScale(1, RoundingMode.HALF_UP));

        return summary;
    }

    public List<Map<String, Object>> getMonthlyTrend(int months) {
        if (taskRecords.isEmpty()) {
            initMockData();
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.from(today.minusMonths(i));
            LocalDateTime monthStart = ym.atDay(1).atStartOfDay();
            LocalDateTime monthEnd = ym.atEndOfMonth().atTime(LocalTime.MAX);

            List<TaskRecordDTO> monthTasks = taskRecords.values().stream()
                    .filter(t -> t.getCreateTime() != null
                            && !t.getCreateTime().isBefore(monthStart)
                            && !t.getCreateTime().isAfter(monthEnd))
                    .collect(Collectors.toList());

            Map<String, Object> monthData = new LinkedHashMap<>();
            monthData.put("month", ym.toString());
            monthData.put("monthName", ym.getMonthValue() + "月");
            monthData.put("taskCount", (long) monthTasks.size());
            monthData.put("bookCount", monthTasks.stream().map(TaskRecordDTO::getBookId).distinct().count());

            Double avgScore = monthTasks.stream()
                    .filter(t -> t.getQualityScore() != null)
                    .mapToDouble(t -> t.getQualityScore().doubleValue())
                    .average()
                    .orElse(0.0);
            monthData.put("avgQualityScore", BigDecimal.valueOf(avgScore).setScale(1, RoundingMode.HALF_UP));

            Long totalDuration = monthTasks.stream()
                    .filter(t -> t.getDurationMinutes() != null)
                    .mapToLong(TaskRecordDTO::getDurationMinutes)
                    .sum();
            monthData.put("totalDurationHours", Math.round(totalDuration / 60.0 * 10) / 10.0);

            trend.add(monthData);
        }

        return trend;
    }
}
