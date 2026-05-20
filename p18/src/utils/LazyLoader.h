#ifndef LAZYLOADER_H
#define LAZYLOADER_H

#include <QObject>
#include <QMap>
#include <QString>
#include <QTimer>
#include <QElapsedTimer>
#include <QDebug>

class LazyLoader : public QObject
{
    Q_OBJECT
public:
    enum LoadPriority {
        CriticalPriority = 0,
        HighPriority = 1,
        NormalPriority = 2,
        LowPriority = 3,
        DeferredPriority = 4
    };

    struct LoadTask {
        QString taskId;
        LoadPriority priority;
        std::function<void()> loadFunction;
        bool loaded;
        qint64 loadTimeMs;

        LoadTask() : priority(NormalPriority), loaded(false), loadTimeMs(0) {}
    };

    static LazyLoader* instance();

    void registerTask(const QString& taskId, LoadPriority priority, 
                      std::function<void()> loadFunction);
    void loadCriticalTasks();
    void loadHighPriorityTasks();
    void loadNormalPriorityTasks();
    void loadLowPriorityTasks();
    void loadDeferredTasks();
    void startPhasedLoading();

    bool isTaskLoaded(const QString& taskId) const;
    qint64 getTaskLoadTime(const QString& taskId) const;
    qint64 getTotalLoadTime() const;
    QStringList getLoadedTasks() const;
    QStringList getPendingTasks() const;

    void enablePerformanceLogging(bool enabled);
    void setDelayBetweenPhases(int ms);

signals:
    void taskLoaded(const QString& taskId);
    void phaseCompleted(LoadPriority priority);
    void allTasksCompleted();
    void loadProgress(int percent);

private slots:
    void onPhaseTimer();
    void processNextPhase();

private:
    LazyLoader(QObject* parent = nullptr);
    ~LazyLoader();

    void loadTasksByPriority(LoadPriority priority);
    void updateProgress();

    QMap<QString, LoadTask> m_tasks;
    QList<LoadPriority> m_loadPhases;
    int m_currentPhaseIndex;
    QTimer* m_phaseTimer;
    int m_delayBetweenPhases;
    bool m_performanceLogging;
    QElapsedTimer m_totalTimer;
    qint64 m_totalLoadTime;

    static LazyLoader* s_instance;
};

#define LAZY_LOADER LazyLoader::instance()

#endif
