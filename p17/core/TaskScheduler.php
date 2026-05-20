<?php
namespace Core;

use Swoole\Coroutine;
use Swoole\Timer;

class TaskScheduler
{
    private static $instance = null;
    private $timerId = null;
    private $runningTasks = [];
    private $isRunning = false;

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
    }

    public function start(): void
    {
        if ($this->isRunning) {
            return;
        }

        $this->isRunning = true;
        logWrite('info', '定时任务调度器启动');

        $this->timerId = Timer::tick(60000, function () {
            $this->checkAndRunTasks();
        });

        $this->checkAndRunTasks();
    }

    public function stop(): void
    {
        if ($this->timerId) {
            Timer::clear($this->timerId);
            $this->timerId = null;
        }
        $this->isRunning = false;
        logWrite('info', '定时任务调度器停止');
    }

    private function checkAndRunTasks(): void
    {
        $db = Database::getInstance();
        $now = date('Y-m-d H:i:s');

        $tasks = $db->fetchAll("
            SELECT * FROM scheduled_tasks 
            WHERE status = 1 
            AND (next_run_time <= ? OR next_run_time IS NULL)
        ", [$now]);

        foreach ($tasks as $task) {
            if (isset($this->runningTasks[$task['id']])) {
                continue;
            }

            $this->runTask($task);
        }
    }

    private function runTask(array $task): void
    {
        $this->runningTasks[$task['id']] = true;

        Coroutine::create(function () use ($task) {
            $db = Database::getInstance();
            $startTime = microtime(true);
            $success = false;
            $errorMessage = '';
            $result = null;

            try {
                logWrite('info', "开始执行任务: {$task['task_name']} [{$task['task_code']}]", [
                    'task_id' => $task['id'],
                ]);

                $handler = $task['task_handler'];
                $params = $task['task_params'] ? json_decode($task['task_params'], true) : [];

                if (is_callable($handler)) {
                    $result = call_user_func($handler, $params);
                } elseif (is_string($handler) && strpos($handler, '@') !== false) {
                    [$class, $method] = explode('@', $handler, 2);
                    if (class_exists($class) && method_exists($class, $method)) {
                        $result = call_user_func([$class, $method], $params);
                    } else {
                        throw new \Exception("任务处理器不存在: {$handler}");
                    }
                } else {
                    throw new \Exception("无效的任务处理器: {$handler}");
                }

                $success = true;
                logWrite('info', "任务执行成功: {$task['task_name']}", [
                    'task_id' => $task['id'],
                    'result' => $result,
                ]);

            } catch (\Exception $e) {
                $errorMessage = $e->getMessage();
                logWrite('error', "任务执行失败: {$task['task_name']}", [
                    'task_id' => $task['id'],
                    'error' => $errorMessage,
                ]);
            }

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            $nextRunTime = $this->calculateNextRunTime($task);
            $runResult = json_encode([
                'success' => $success,
                'message' => $errorMessage,
                'result' => $result,
                'execution_time_ms' => $executionTime,
            ]);

            $db->query("
                UPDATE scheduled_tasks 
                SET last_run_time = NOW(),
                    next_run_time = ?,
                    last_run_result = ?,
                    run_count = run_count + 1,
                    success_count = success_count + ?,
                    fail_count = fail_count + ?
                WHERE id = ?
            ", [
                $nextRunTime,
                $runResult,
                $success ? 1 : 0,
                $success ? 0 : 1,
                $task['id'],
            ]);

            unset($this->runningTasks[$task['id']]);
        });
    }

    private function calculateNextRunTime(array $task): ?string
    {
        if ($task['task_type'] === 'one_time') {
            return null;
        }

        if ($task['task_type'] === 'interval' && $task['interval_seconds']) {
            return date('Y-m-d H:i:s', time() + $task['interval_seconds']);
        }

        if ($task['task_type'] === 'cron' && $task['cron_expression']) {
            return $this->parseCronExpression($task['cron_expression']);
        }

        return date('Y-m-d H:i:s', time() + 3600);
    }

    private function parseCronExpression(string $expression): ?string
    {
        $parts = explode(' ', $expression);
        if (count($parts) !== 5) {
            return date('Y-m-d H:i:s', time() + 3600);
        }

        [$minute, $hour, $day, $month, $weekday] = $parts;

        $nextMinute = $minute === '*' ? date('i') + 1 : (int)$minute;
        $nextHour = $hour === '*' ? date('H') : (int)$hour;
        $nextDay = $day === '*' ? date('d') : (int)$day;
        $nextMonth = $month === '*' ? date('m') : (int)$month;

        $nextTime = mktime($nextHour, $nextMinute, 0, $nextMonth, $nextDay);

        if ($nextTime <= time()) {
            $nextTime += 86400;
        }

        return date('Y-m-d H:i:s', $nextTime);
    }

    public function runTaskImmediately(string $taskCode): array
    {
        $db = Database::getInstance();
        $task = $db->fetchOne("SELECT * FROM scheduled_tasks WHERE task_code = ? AND status = 1", [$taskCode]);

        if (!$task) {
            return ['success' => false, 'message' => '任务不存在或已禁用'];
        }

        $this->runTask($task);

        return ['success' => true, 'message' => '任务已触发执行'];
    }

    public function getRunningTasks(): array
    {
        return array_keys($this->runningTasks);
    }

    public function isTaskRunning(int $taskId): bool
    {
        return isset($this->runningTasks[$taskId]);
    }
}