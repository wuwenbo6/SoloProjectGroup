#include "LazyLoader.h"

LazyLoader* LazyLoader::s_instance = nullptr;

LazyLoader* LazyLoader::instance()
{
    if (!s_instance) {
        s_instance = new LazyLoader();
    }
    return s_instance;
}

LazyLoader::LazyLoader(QObject* parent)
    : QObject(parent)
    , m_currentPhaseIndex(0)
    , m_phaseTimer(new QTimer(this))
    , m_delayBetweenPhases(50)
    , m_performanceLogging(true)
    , m_totalLoadTime(0)
{
    m_loadPhases << CriticalPriority << HighPriority << NormalPriority 
                 << LowPriority << DeferredPriority;
    
    connect(m_phaseTimer, &QTimer::timeout, this, &LazyLoader::onPhaseTimer);
    m_phaseTimer->setSingleShot(true);
}

LazyLoader::~LazyLoader()
{
}

void LazyLoader::registerTask(const QString& taskId, LoadPriority priority, 
                               std::function<void()> loadFunction)
{
    LoadTask task;
    task.taskId = taskId;
    task.priority = priority;
    task.loadFunction = loadFunction;
    task.loaded = false;
    task.loadTimeMs = 0;
    
    m_tasks[taskId] = task;
}

void LazyLoader::loadCriticalTasks()
{
    loadTasksByPriority(CriticalPriority);
}

void LazyLoader::loadHighPriorityTasks()
{
    loadTasksByPriority(HighPriority);
}

void LazyLoader::loadNormalPriorityTasks()
{
    loadTasksByPriority(NormalPriority);
}

void LazyLoader::loadLowPriorityTasks()
{
    loadTasksByPriority(LowPriority);
}

void LazyLoader::loadDeferredTasks()
{
    loadTasksByPriority(DeferredPriority);
}

void LazyLoader::startPhasedLoading()
{
    if (m_performanceLogging) {
        m_totalTimer.start();
        qDebug() << "[LazyLoader] Starting phased loading...";
    }
    
    m_currentPhaseIndex = 0;
    processNextPhase();
}

bool LazyLoader::isTaskLoaded(const QString& taskId) const
{
    if (m_tasks.contains(taskId)) {
        return m_tasks[taskId].loaded;
    }
    return false;
}

qint64 LazyLoader::getTaskLoadTime(const QString& taskId) const
{
    if (m_tasks.contains(taskId)) {
        return m_tasks[taskId].loadTimeMs;
    }
    return 0;
}

qint64 LazyLoader::getTotalLoadTime() const
{
    return m_totalLoadTime;
}

QStringList LazyLoader::getLoadedTasks() const
{
    QStringList loaded;
    for (auto it = m_tasks.constBegin(); it != m_tasks.constEnd(); ++it) {
        if (it.value().loaded) {
            loaded << it.key();
        }
    }
    return loaded;
}

QStringList LazyLoader::getPendingTasks() const
{
    QStringList pending;
    for (auto it = m_tasks.constBegin(); it != m_tasks.constEnd(); ++it) {
        if (!it.value().loaded) {
            pending << it.key();
        }
    }
    return pending;
}

void LazyLoader::enablePerformanceLogging(bool enabled)
{
    m_performanceLogging = enabled;
}

void LazyLoader::setDelayBetweenPhases(int ms)
{
    m_delayBetweenPhases = ms;
}

void LazyLoader::onPhaseTimer()
{
    processNextPhase();
}

void LazyLoader::processNextPhase()
{
    if (m_currentPhaseIndex >= m_loadPhases.size()) {
        m_totalLoadTime = m_totalTimer.elapsed();
        
        if (m_performanceLogging) {
            qDebug() << "[LazyLoader] All tasks completed in" << m_totalLoadTime << "ms";
        }
        
        emit allTasksCompleted();
        return;
    }
    
    LoadPriority priority = m_loadPhases[m_currentPhaseIndex];
    loadTasksByPriority(priority);
    emit phaseCompleted(priority);
    
    updateProgress();
    
    m_currentPhaseIndex++;
    
    if (m_currentPhaseIndex < m_loadPhases.size()) {
        m_phaseTimer->start(m_delayBetweenPhases);
    } else {
        processNextPhase();
    }
}

void LazyLoader::loadTasksByPriority(LoadPriority priority)
{
    QElapsedTimer phaseTimer;
    if (m_performanceLogging) {
        phaseTimer.start();
    }
    
    int taskCount = 0;
    for (auto& task : m_tasks) {
        if (task.priority == priority && !task.loaded) {
            QElapsedTimer taskTimer;
            taskTimer.start();
            
            if (task.loadFunction) {
                task.loadFunction();
            }
            
            task.loaded = true;
            task.loadTimeMs = taskTimer.elapsed();
            taskCount++;
            
            emit taskLoaded(task.taskId);
            
            if (m_performanceLogging) {
                qDebug() << "[LazyLoader] Loaded" << task.taskId << "in" << task.loadTimeMs << "ms";
            }
        }
    }
    
    if (m_performanceLogging && taskCount > 0) {
        qDebug() << "[LazyLoader] Priority" << priority << "completed in" 
                 << phaseTimer.elapsed() << "ms," << taskCount << "tasks";
    }
}

void LazyLoader::updateProgress()
{
    int total = m_tasks.size();
    int loaded = getLoadedTasks().size();
    int percent = (total > 0) ? (loaded * 100 / total) : 100;
    emit loadProgress(percent);
}
