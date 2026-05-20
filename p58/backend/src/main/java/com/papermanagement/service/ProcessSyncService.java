package com.papermanagement.service;

import com.papermanagement.entity.ProcessLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProcessSyncService {

    private static final Logger logger = LoggerFactory.getLogger(ProcessSyncService.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private final ConcurrentHashMap<String, ProcessProgress> progressMap = new ConcurrentHashMap<>();

    public void broadcastProcessUpdate(ProcessLog processLog, int progress) {
        String key = processLog.getBatchNo() + "_" + processLog.getProcessCode();

        ProcessProgress progressObj = new ProcessProgress();
        progressObj.setBatchNo(processLog.getBatchNo());
        progressObj.setProcessCode(processLog.getProcessCode());
        progressObj.setProcessName(processLog.getProcessName());
        progressObj.setProgress(progress);
        progressObj.setStatus(processLog.getStatus());
        progressObj.setCraftsmanName(processLog.getCraftsmanName());
        progressObj.setUpdateTime(System.currentTimeMillis());

        progressMap.put(key, progressObj);

        messagingTemplate.convertAndSend("/topic/process-progress", progressObj);
        logger.debug("推送工序进度更新: batchNo={}, processCode={}, progress={}%",
                processLog.getBatchNo(), processLog.getProcessCode(), progress);
    }

    public void broadcastAbnormalWarning(ProcessLog processLog, String reason) {
        Map<String, Object> warning = new HashMap<>();
        warning.put("batchNo", processLog.getBatchNo());
        warning.put("processCode", processLog.getProcessCode());
        warning.put("processName", processLog.getProcessName());
        warning.put("craftsmanName", processLog.getCraftsmanName());
        warning.put("reason", reason);
        warning.put("time", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/process-abnormal", warning);
        logger.warn("推送工序异常警告: batchNo={}, processCode={}, reason={}",
                processLog.getBatchNo(), processLog.getProcessCode(), reason);
    }

    public void broadcastProcessComplete(ProcessLog processLog) {
        Map<String, Object> complete = new HashMap<>();
        complete.put("batchNo", processLog.getBatchNo());
        complete.put("processCode", processLog.getProcessCode());
        complete.put("processName", processLog.getProcessName());
        complete.put("craftsmanName", processLog.getCraftsmanName());
        complete.put("completeTime", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/process-complete", complete);
        logger.info("推送工序完成通知: batchNo={}, processCode={}",
                processLog.getBatchNo(), processLog.getProcessCode());
    }

    public void notifyUserProgress(String userId, ProcessLog processLog, int progress) {
        Map<String, Object> data = new HashMap<>();
        data.put("batchNo", processLog.getBatchNo());
        data.put("processCode", processLog.getProcessCode());
        data.put("processName", processLog.getProcessName());
        data.put("progress", progress);
        data.put("status", processLog.getStatus());

        messagingTemplate.convertAndSendToUser(userId, "/queue/personal-progress", data);
    }

    public static class ProcessProgress {
        private String batchNo;
        private String processCode;
        private String processName;
        private int progress;
        private String status;
        private String craftsmanName;
        private long updateTime;

        public String getBatchNo() {
            return batchNo;
        }

        public void setBatchNo(String batchNo) {
            this.batchNo = batchNo;
        }

        public String getProcessCode() {
            return processCode;
        }

        public void setProcessCode(String processCode) {
            this.processCode = processCode;
        }

        public String getProcessName() {
            return processName;
        }

        public void setProcessName(String processName) {
            this.processName = processName;
        }

        public int getProgress() {
            return progress;
        }

        public void setProgress(int progress) {
            this.progress = progress;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getCraftsmanName() {
            return craftsmanName;
        }

        public void setCraftsmanName(String craftsmanName) {
            this.craftsmanName = craftsmanName;
        }

        public long getUpdateTime() {
            return updateTime;
        }

        public void setUpdateTime(long updateTime) {
            this.updateTime = updateTime;
        }
    }
}
