package com.mortise.tenon.service;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RestorationSimulationService {

    private final Map<String, RestorationPlan> plans = new ConcurrentHashMap<>();
    private final Map<String, SimulationSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, DamageCase> damageCases = new ConcurrentHashMap<>();

    public static class RestorationPlan {
        public String id;
        public String name;
        public String modelId;
        public String description;
        public String damageType;
        public int severity;
        public List<RestorationStep> steps = new ArrayList<>();
        public String materialRecommendation;
        public String toolRecommendation;
        public int estimatedHours;
        public int difficulty;
        public String creatorId;
        public Date createTime;
        public boolean isVerified;
        public int successRate;
    }

    public static class RestorationStep {
        public int stepIndex;
        public String name;
        public String description;
        public String operationType;
        public int duration;
        public double accuracyThreshold;
        public List<String> warnings;
        public List<String> tips;
        public boolean isCritical;
    }

    public static class SimulationSession {
        public String sessionId;
        public String planId;
        public String userId;
        public int currentStep;
        public double stepProgress;
        public double overallAccuracy;
        public long startTime;
        public long lastUpdateTime;
        public boolean isPaused;
        public boolean isFinished;
        public List<String> operationLog = new ArrayList<>();
        public Map<Integer, Double> stepResults = new ConcurrentHashMap<>();
    }

    public static class DamageCase {
        public String id;
        public String name;
        public String category;
        public String description;
        public String imageUrl;
        public List<String> possibleCauses;
        public List<String> solutions;
        public int frequency;
        public String historicalPeriod;
    }

    @PostConstruct
    public void init() {
        initDamageCases();
        initRestorationPlans();
    }

    private void initDamageCases() {
        DamageCase case1 = new DamageCase();
        case1.id = "damage_1";
        case1.name = "榫头断裂";
        case1.category = "structural";
        case1.description = "榫头因年久或受力过大导致断裂，常见于梁枋连接处";
        case1.possibleCauses = Arrays.asList("年久木材老化", "地震等自然灾害", "过度承重", "安装时受力不均");
        case1.solutions = Arrays.asList("更换新榫头", "采用螺栓加固", "使用树脂粘合", "增加辅助支撑构件");
        case1.frequency = 85;
        case1.historicalPeriod = "各朝代均有发生";
        damageCases.put(case1.id, case1);

        DamageCase case2 = new DamageCase();
        case2.id = "damage_2";
        case2.name = "卯眼槽口磨损";
        case2.category = "wear";
        case2.description = "卯眼因长期使用导致槽口变形，连接松动";
        case2.possibleCauses = Arrays.asList("木结构自然伸缩", "长期振动影响", "工艺缺陷", "维护不当");
        case2.solutions = Arrays.asList("填塞木片加固", "重新开卯眼", "使用铁件包裹加固", "更换整个构件");
        case2.frequency = 72;
        case2.historicalPeriod = "明清建筑中较为常见";
        damageCases.put(case2.id, case2);

        DamageCase case3 = new DamageCase();
        case3.id = "damage_3";
        case3.name = "木材虫蛀损坏";
        case3.category = "biological";
        case3.description = "白蚁或其他木虫蛀食导致榫卯结构破坏";
        case3.possibleCauses = Arrays.asList("白蚁侵蚀", "木蠹虫破坏", "潮湿环境滋生", "缺乏防虫处理");
        case3.solutions = Arrays.asList("熏蒸杀虫处理", "替换受损构件", "注入防虫药剂", "安装金属套管加固");
        case3.frequency = 68;
        case3.historicalPeriod = "南方潮湿地区古建筑";
        damageCases.put(case3.id, case3);

        DamageCase case4 = new DamageCase();
        case4.id = "damage_4";
        case4.name = "木材糟朽腐烂";
        case4.category = "decay";
        case4.description = "木材因潮湿或菌类侵蚀导致腐朽，强度大幅下降";
        case4.possibleCauses = Arrays.asList("长期雨水浸泡", "通风不良", "雨水渗漏", "地下潮气上升");
        case4.solutions = Arrays.asList("环氧灌封加固", "截换修复法", "墩接处理", "化学防腐处理");
        case4.frequency = 90;
        case4.historicalPeriod = "所有地区高发性病害";
        damageCases.put(case4.id, case4);

        DamageCase case5 = new DamageCase();
        case5.id = "damage_5";
        case5.name = "斗拱构件脱榫";
        case5.category = "structural";
        case5.description = "斗拱各层构件之间连接松动，整体结构失稳";
        case5.possibleCauses = Arrays.asList("地震影响", "地基沉降不均", "木材干缩变形", "斗拱负载过大");
        case5.solutions = Arrays.asList("逐层归安复位", "添加隐藏销钉", "使用碳纤维加固", "增设角梁支撑");
        case5.frequency = 55;
        case5.historicalPeriod = "殿堂式建筑常见问题";
        damageCases.put(case5.id, case5);
    }

    private void initRestorationPlans() {
        RestorationPlan plan1 = new RestorationPlan();
        plan1.id = "plan_1";
        plan1.name = "燕尾榫断裂修复方案";
        plan1.modelId = "mortise1";
        plan1.description = "针对燕尾榫榫头断裂的标准化修复方案，适用于梁枋连接";
        plan1.damageType = "structural";
        plan1.severity = 4;
        plan1.materialRecommendation = "硬松木、榆木或与原建筑同材质木材，环氧树脂，木粉填料";
        plan1.toolRecommendation = "木工锯、凿子、羊角锤、夹具、砂纸、电动打磨机";
        plan1.estimatedHours = 8;
        plan1.difficulty = 3;
        plan1.creatorId = "expert";
        plan1.createTime = new Date();
        plan1.isVerified = true;
        plan1.successRate = 92;
        
        plan1.steps.add(createStep(1, "拆卸记录", "完整记录拆卸前状态，拍照留存，标记各构件位置", "record", 60, 0.95, 
            Arrays.asList("注意保护原有构件不要造成二次损伤", "详细记录各构件相对位置"),
            Arrays.asList("使用编号标签标记构件", "拍摄各角度照片留存"), true));
        
        plan1.steps.add(createStep(2, "清理损坏部位", "清理断裂处碎屑，去除腐朽部分，评估实际损坏范围", "clean", 45, 0.9,
            Arrays.asList("清理时不要扩大损坏范围", "注意保留原始加工痕迹"),
            Arrays.asList("使用软毛刷清理", "可用吸尘器辅助清除碎屑"), false));
        
        plan1.steps.add(createStep(3, "制作新榫头", "按照原榫头尺寸1:1制作新榫头，注意木纹方向", "fabricate", 120, 0.98,
            Arrays.asList("木纹方向必须与原构件一致", "尺寸精度要求±0.5mm"),
            Arrays.asList("先制作样板比对", "使用与原构件同密度木材"), true));
        
        plan1.steps.add(createStep(4, "卯眼修整", "修整卯眼使其与新榫头完美配合，达到紧密配合", "fit", 90, 0.97,
            Arrays.asList("宁紧勿松，最后逐步修整", "保持原有卯眼形状"),
            Arrays.asList("使用砂纸逐步打磨", "反复试装确认配合度"), true));
        
        plan1.steps.add(createStep(5, "粘接加固", "使用环氧树脂粘接，必要时加暗销加固", "bond", 60, 0.95,
            Arrays.asList("胶层厚度控制在0.1-0.3mm", "粘接后24小时内不可受力"),
            Arrays.asList("室温25℃时固化最佳", "使用夹具确保位置固定"), true));
        
        plan1.steps.add(createStep(6, "组装归位", "将修复后的构件按照原始位置组装归位", "assemble", 45, 0.9,
            Arrays.asList("按照拆卸逆序进行", "检查各连接部位配合"),
            Arrays.asList("使用橡皮锤轻轻敲击", "避免暴力安装"), false));
        
        plan1.steps.add(createStep(7, "外观修复", "修复连接处外观，尽量与原有木材色泽一致", "finish", 30, 0.85,
            Arrays.asList("尽量保留木材原有纹理", "修复处需有可识别痕迹"),
            Arrays.asList("使用木材染料调色", "保留修复痕迹以便后人识别"), false));
        
        plans.put(plan1.id, plan1);

        RestorationPlan plan2 = new RestorationPlan();
        plan2.id = "plan_2";
        plan2.name = "斗拱脱榫复位方案";
        plan2.modelId = "mortise3";
        plan2.description = "针对斗拱系统脱榫、松动问题的系统修复方案";
        plan2.damageType = "structural";
        plan2.severity = 5;
        plan2.materialRecommendation = "碳纤维布、环氧树脂、不锈钢销钉、传统灰浆";
        plan2.toolRecommendation = "千斤顶、临时支撑架、激光水平仪、扭矩扳手";
        plan2.estimatedHours = 24;
        plan2.difficulty = 5;
        plan2.creatorId = "expert";
        plan2.createTime = new Date();
        plan2.isVerified = true;
        plan2.successRate = 88;
        
        plan2.steps.add(createStep(1, "支撑保护", "设置临时支撑系统，确保拆卸过程中结构安全", "support", 120, 0.98,
            Arrays.asList("支撑需覆盖所有受力点", "定期检查支撑状态"),
            Arrays.asList("使用可调式千斤顶", "支撑点需垫木片保护"), true));
        
        plan2.steps.add(createStep(2, "逐层拆解", "按照从外到内、从上到下顺序拆解斗拱", "disassemble", 180, 0.95,
            Arrays.asList("每一步都要拍照记录", "构件编号必须清晰"),
            Arrays.asList("使用绘图板记录相对位置", "按顺序收纳构件"), true));
        
        plan2.steps.add(createStep(3, "构件检测", "检测各构件损坏情况，分类标记处理方案", "inspect", 90, 0.9,
            Arrays.asList("注意隐藏的内部损坏", "使用探针检测内部腐朽"),
            Arrays.asList("超声波检测木材内部状况", "记录损坏部位和程度"), false));
        
        plan2.steps.add(createStep(4, "碳纤维加固", "对主要受力构件使用碳纤维布进行加固", "reinforce", 120, 0.97,
            Arrays.asList("碳纤维布纹理方向需与木纹一致", "每层搭接长度不小于10cm"),
            Arrays.asList("表面必须打磨粗糙", "环氧树脂必须充分浸润"), true));
        
        plan2.steps.add(createStep(5, "逐件复位安装", "按照拆解逆序逐层安装，确保各构件受力均匀", "install", 240, 0.98,
            Arrays.asList("使用激光水平仪监控位移", "同步缓慢加载"),
            Arrays.asList("多人配合同步操作", "随时监测位移变化"), true));
        
        plan2.steps.add(createStep(6, "设置隐形销钉", "在隐蔽位置设置不锈钢销钉，防止再次脱榫", "pin", 60, 0.95,
            Arrays.asList("销钉位置必须隐蔽", "不能破坏构件外观"),
            Arrays.asList("销钉直径不超过构件厚度1/5", "销钉需做防锈处理"), false));
        
        plan2.steps.add(createStep(7, "应力监测", "安装传感器监测修复后结构应力变化", "monitor", 30, 0.9,
            Arrays.asList("监测周期不少于3个月", "建立应力基准值"),
            Arrays.asList("使用光纤应变传感器", "数据自动记录分析"), false));
        
        plans.put(plan2.id, plan2);

        RestorationPlan plan3 = new RestorationPlan();
        plan3.id = "plan_3";
        plan3.name = "虫蛀损坏修复方案";
        plan3.modelId = "mortise2";
        plan3.description = "针对木材虫蛀损坏的系统性修复与加固方案";
        plan3.damageType = "biological";
        plan3.severity = 3;
        plan3.materialRecommendation = "硼酸防虫剂、环氧灌缝胶、木粉、玻璃纤维布";
        plan3.toolRecommendation = "注射器、热风枪、夹具、毛刷、砂纸";
        plan3.estimatedHours = 12;
        plan3.difficulty = 2;
        plan3.creatorId = "expert";
        plan3.createTime = new Date();
        plan3.isVerified = true;
        plan3.successRate = 95;
        
        plan3.steps.add(createStep(1, "杀虫处理", "使用硼酸溶液或熏蒸法彻底杀灭蛀虫", "treat", 60, 0.95,
            Arrays.asList("确保药剂渗透到所有虫道", "注意施工人员防护"),
            Arrays.asList("使用注射器注入药剂", "密闭空间可用熏蒸法"), true));
        
        plan3.steps.add(createStep(2, "清理虫道", "清理虫道内粪便、木屑和死虫，直至露出新鲜木材", "clean", 45, 0.9,
            Arrays.asList("不要过度清理导致构件强度下降", "注意虫道走向"),
            Arrays.asList("高压空气清理", "细钢丝钩清除碎屑"), false));
        
        plan3.steps.add(createStep(3, "环氧树脂灌封", "使用低粘度环氧树脂灌封所有虫道", "inject", 90, 0.95,
            Arrays.asList("从低端向高端注射", "确保无空洞残留"),
            Arrays.asList("真空灌注效果最佳", "分次注入避免气泡"), true));
        
        plan3.steps.add(createStep(4, "外部包裹加固", "在损坏严重部位包裹玻璃纤维布加固", "wrap", 60, 0.9,
            Arrays.asList("纤维方向与受力方向一致", "搭接长度不小于5cm"),
            Arrays.asList("至少包裹两层", "层间树脂必须饱满"), false));
        
        plan3.steps.add(createStep(5, "表面修复", "木粉混合树脂填补表面，修复外观", "finish", 45, 0.85,
            Arrays.asList("填料颜色尽量匹配", "保持原有纹理"),
            Arrays.asList("加入对应颜色颜料", "纹理可用工具复刻"), false));
        
        plans.put(plan3.id, plan3);
    }

    private RestorationStep createStep(int index, String name, String description, String type, int duration, double threshold,
                                        List<String> warnings, List<String> tips, boolean isCritical) {
        RestorationStep step = new RestorationStep();
        step.stepIndex = index;
        step.name = name;
        step.description = description;
        step.operationType = type;
        step.duration = duration;
        step.accuracyThreshold = threshold;
        step.warnings = warnings;
        step.tips = tips;
        step.isCritical = isCritical;
        return step;
    }

    public JSONArray listPlans() {
        JSONArray list = new JSONArray();
        for (RestorationPlan plan : plans.values()) {
            JSONObject json = new JSONObject();
            json.put("id", plan.id);
            json.put("name", plan.name);
            json.put("modelId", plan.modelId);
            json.put("damageType", plan.damageType);
            json.put("severity", plan.severity);
            json.put("difficulty", plan.difficulty);
            json.put("estimatedHours", plan.estimatedHours);
            json.put("description", plan.description);
            json.put("isVerified", plan.isVerified);
            json.put("successRate", plan.successRate);
            json.put("stepCount", plan.steps.size());
            list.add(json);
        }
        return list;
    }

    public JSONObject getPlanDetail(String planId) {
        RestorationPlan plan = plans.get(planId);
        if (plan == null) {
            JSONObject result = new JSONObject();
            result.put("success", false);
            result.put("message", "修复方案不存在");
            return result;
        }
        
        JSONObject json = new JSONObject();
        json.put("id", plan.id);
        json.put("name", plan.name);
        json.put("modelId", plan.modelId);
        json.put("description", plan.description);
        json.put("damageType", plan.damageType);
        json.put("severity", plan.severity);
        json.put("materialRecommendation", plan.materialRecommendation);
        json.put("toolRecommendation", plan.toolRecommendation);
        json.put("estimatedHours", plan.estimatedHours);
        json.put("difficulty", plan.difficulty);
        json.put("isVerified", plan.isVerified);
        json.put("successRate", plan.successRate);
        
        JSONArray stepsJson = new JSONArray();
        for (RestorationStep step : plan.steps) {
            JSONObject stepJson = new JSONObject();
            stepJson.put("stepIndex", step.stepIndex);
            stepJson.put("name", step.name);
            stepJson.put("description", step.description);
            stepJson.put("operationType", step.operationType);
            stepJson.put("duration", step.duration);
            stepJson.put("accuracyThreshold", step.accuracyThreshold);
            stepJson.put("warnings", step.warnings);
            stepJson.put("tips", step.tips);
            stepJson.put("isCritical", step.isCritical);
            stepsJson.add(stepJson);
        }
        json.put("steps", stepsJson);
        
        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("plan", json);
        return result;
    }

    public JSONObject startSimulation(String planId, String userId) {
        JSONObject result = new JSONObject();
        RestorationPlan plan = plans.get(planId);
        if (plan == null) {
            result.put("success", false);
            result.put("message", "修复方案不存在");
            return result;
        }
        
        String sessionId = "sim_" + System.currentTimeMillis() + "_" + new Random().nextInt(1000);
        
        SimulationSession session = new SimulationSession();
        session.sessionId = sessionId;
        session.planId = planId;
        session.userId = userId;
        session.currentStep = 1;
        session.stepProgress = 0;
        session.overallAccuracy = 0;
        session.startTime = System.currentTimeMillis();
        session.lastUpdateTime = System.currentTimeMillis();
        session.isPaused = false;
        session.isFinished = false;
        
        sessions.put(sessionId, session);
        
        result.put("success", true);
        result.put("sessionId", sessionId);
        result.put("message", "模拟开始");
        result.put("totalSteps", plan.steps.size());
        result.put("firstStep", plan.steps.get(0));
        return result;
    }

    public JSONObject updateSimulationStep(String sessionId, double accuracy, boolean stepComplete) {
        JSONObject result = new JSONObject();
        SimulationSession session = sessions.get(sessionId);
        if (session == null) {
            result.put("success", false);
            result.put("message", "模拟会话不存在");
            return result;
        }
        
        RestorationPlan plan = plans.get(session.planId);
        if (plan == null) {
            result.put("success", false);
            result.put("message", "修复方案不存在");
            return result;
        }
        
        session.stepResults.put(session.currentStep, accuracy);
        session.operationLog.add(String.format("Step %d completed with accuracy %.2f", session.currentStep, accuracy));
        
        if (stepComplete) {
            if (session.currentStep >= plan.steps.size()) {
                session.isFinished = true;
                session.overallAccuracy = session.stepResults.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                
                result.put("finished", true);
                result.put("overallAccuracy", session.overallAccuracy);
                result.put("estimatedSuccessRate", Math.min(100, plan.successRate * session.overallAccuracy));
                result.put("totalTime", (System.currentTimeMillis() - session.startTime) / 1000);
            } else {
                session.currentStep++;
                session.stepProgress = 0;
                result.put("nextStep", plan.steps.get(session.currentStep - 1));
            }
        } else {
            session.stepProgress = Math.min(1.0, session.stepProgress + 0.1);
        }
        
        session.lastUpdateTime = System.currentTimeMillis();
        result.put("success", true);
        result.put("currentStep", session.currentStep);
        result.put("stepProgress", session.stepProgress);
        return result;
    }

    public JSONObject getSimulationState(String sessionId) {
        JSONObject result = new JSONObject();
        SimulationSession session = sessions.get(sessionId);
        if (session == null) {
            result.put("success", false);
            result.put("message", "模拟会话不存在");
            return result;
        }
        
        RestorationPlan plan = plans.get(session.planId);
        
        result.put("success", true);
        result.put("sessionId", session.sessionId);
        result.put("currentStep", session.currentStep);
        result.put("stepProgress", session.stepProgress);
        result.put("isPaused", session.isPaused);
        result.put("isFinished", session.isFinished);
        result.put("stepResults", session.stepResults);
        result.put("totalSteps", plan != null ? plan.steps.size() : 0);
        result.put("elapsedTime", (System.currentTimeMillis() - session.startTime) / 1000);
        return result;
    }

    public JSONArray listDamageCases() {
        JSONArray list = new JSONArray();
        for (DamageCase damage : damageCases.values()) {
            JSONObject json = new JSONObject();
            json.put("id", damage.id);
            json.put("name", damage.name);
            json.put("category", damage.category);
            json.put("description", damage.description);
            json.put("frequency", damage.frequency);
            json.put("historicalPeriod", damage.historicalPeriod);
            json.put("solutionCount", damage.solutions.size());
            list.add(json);
        }
        return list;
    }

    public JSONObject getDamageCaseDetail(String damageId) {
        JSONObject result = new JSONObject();
        DamageCase damage = damageCases.get(damageId);
        if (damage == null) {
            result.put("success", false);
            result.put("message", "损坏案例不存在");
            return result;
        }
        
        result.put("success", true);
        result.put("damage", JSONObject.parseObject(JSONObject.toJSONString(damage)));
        
        JSONArray relatedPlans = new JSONArray();
        for (RestorationPlan plan : plans.values()) {
            if (plan.damageType.equals(damage.category)) {
                JSONObject p = new JSONObject();
                p.put("id", plan.id);
                p.put("name", plan.name);
                p.put("successRate", plan.successRate);
                relatedPlans.add(p);
            }
        }
        result.put("relatedPlans", relatedPlans);
        
        return result;
    }

    public JSONObject pauseSimulation(String sessionId) {
        JSONObject result = new JSONObject();
        SimulationSession session = sessions.get(sessionId);
        if (session == null) {
            result.put("success", false);
            result.put("message", "模拟会话不存在");
            return result;
        }
        session.isPaused = true;
        result.put("success", true);
        result.put("message", "模拟已暂停");
        return result;
    }

    public JSONObject resumeSimulation(String sessionId) {
        JSONObject result = new JSONObject();
        SimulationSession session = sessions.get(sessionId);
        if (session == null) {
            result.put("success", false);
            result.put("message", "模拟会话不存在");
            return result;
        }
        session.isPaused = false;
        result.put("success", true);
        result.put("message", "模拟已继续");
        return result;
    }

    public JSONObject endSimulation(String sessionId) {
        JSONObject result = new JSONObject();
        SimulationSession session = sessions.remove(sessionId);
        if (session == null) {
            result.put("success", false);
            result.put("message", "模拟会话不存在");
            return result;
        }
        result.put("success", true);
        result.put("message", "模拟已结束");
        return result;
    }
}
