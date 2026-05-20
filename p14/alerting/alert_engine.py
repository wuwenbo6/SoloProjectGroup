import json
import smtplib
import threading
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Optional, Callable, Any
from enum import Enum
import queue


class AlertSeverity(Enum):
    """预警级别"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(Enum):
    """预警类型"""
    THRESHOLD_EXCEEDED = "threshold_exceeded"
    ANOMALY_DETECTED = "anomaly_detected"
    DATA_QUALITY_ISSUE = "data_quality_issue"
    SYSTEM_ERROR = "system_error"


class AlertChannel(Enum):
    """预警通知渠道"""
    EMAIL = "email"
    SMS = "sms"
    WEBHOOK = "webhook"
    IN_APP = "in_app"


class AlertRule:
    """预警规则定义"""

    def __init__(self, rule_id: str, name: str, description: str = "",
                 severity: AlertSeverity = AlertSeverity.WARNING):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.severity = severity
        self.conditions: List[Dict[str, Any]] = []
        self.channels: List[AlertChannel] = []
        self.recipients: List[str] = []
        self.enabled = True
        self.silence_until: Optional[float] = None
        self.cooldown_seconds: int = 300  # 默认5分钟冷却

    def add_threshold_condition(self, metric: str, operator: str,
                                threshold: float, window_seconds: int = 60):
        """添加阈值条件"""
        self.conditions.append({
            'type': 'threshold',
            'metric': metric,
            'operator': operator,
            'threshold': threshold,
            'window_seconds': window_seconds
        })
        return self

    def add_channel(self, channel: AlertChannel):
        """添加通知渠道"""
        self.channels.append(channel)
        return self

    def add_recipient(self, recipient: str):
        """添加接收人"""
        self.recipients.append(recipient)
        return self

    def is_ready(self) -> bool:
        """检查规则是否可以触发（冷却时间）"""
        if self.silence_until and time.time() < self.silence_until:
            return False
        return True

    def trigger_cooldown(self):
        """触发冷却时间"""
        self.silence_until = time.time() + self.cooldown_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            'rule_id': self.rule_id,
            'name': self.name,
            'description': self.description,
            'severity': self.severity.value,
            'conditions': self.conditions,
            'channels': [c.value for c in self.channels],
            'recipients': self.recipients,
            'enabled': self.enabled,
            'cooldown_seconds': self.cooldown_seconds
        }


class Alert:
    """预警实例"""

    def __init__(self, rule: AlertRule, triggered_values: Dict[str, float]):
        self.alert_id = f"alert_{int(time.time() * 1000)}_{rule.rule_id}"
        self.rule = rule
        self.triggered_values = triggered_values
        self.timestamp = datetime.now().isoformat()
        self.severity = rule.severity
        self.acknowledged = False
        self.resolved = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'alert_id': self.alert_id,
            'rule_id': self.rule.rule_id,
            'rule_name': self.rule.name,
            'severity': self.severity.value,
            'triggered_values': self.triggered_values,
            'timestamp': self.timestamp,
            'acknowledged': self.acknowledged,
            'resolved': self.resolved,
            'channels': [c.value for c in self.rule.channels],
            'recipients': self.rule.recipients
        }


class EmailNotifier:
    """邮件通知器"""

    def __init__(self, smtp_host: str, smtp_port: int,
                 username: str, password: str, use_tls: bool = True):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.use_tls = use_tls

    def send(self, recipients: List[str], alert: Alert) -> bool:
        """发送预警邮件"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.username
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = f"[{alert.severity.value.upper()}] {alert.rule.name}"

            body = self._generate_email_body(alert)
            msg.attach(MIMEText(body, 'html'))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)

            print(f"✅ 预警邮件已发送至: {', '.join(recipients)}")
            return True

        except Exception as e:
            print(f"❌ 邮件发送失败: {e}")
            return False

    def _generate_email_body(self, alert: Alert) -> str:
        """生成邮件内容HTML"""
        severity_colors = {
            'info': '#3498db',
            'warning': '#f39c12',
            'error': '#e74c3c',
            'critical': '#c0392b'
        }
        color = severity_colors.get(alert.severity.value, '#95a5a6')

        values_html = ''.join([
            f'<tr><td style="padding: 8px; border: 1px solid #ddd;">{k}</td>'
            f'<td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">{v:.4f}</td></tr>'
            for k, v in alert.triggered_values.items()
        ])

        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <div style="background: {color}; color: white; padding: 15px; border-radius: 5px;">
                    <h2>{alert.rule.name}</h2>
                </div>
                <div style="margin-top: 20px;">
                    <p><strong>预警时间:</strong> {alert.timestamp}</p>
                    <p><strong>预警级别:</strong> {alert.severity.value.upper()}</p>
                    <p><strong>预警描述:</strong> {alert.rule.description}</p>
                </div>
                <div style="margin-top: 20px;">
                    <h3>触发指标:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">指标名称</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">当前值</th>
                        </tr>
                        {values_html}
                    </table>
                </div>
                <div style="margin-top: 30px; color: #666; font-size: 12px;">
                    <p>此邮件由数据分析平台自动发送，请勿直接回复。</p>
                </div>
            </body>
        </html>
        """


class SMSNotifier:
    """短信通知器（支持Twilio等服务商）"""

    def __init__(self, provider: str = "twilio", **kwargs):
        self.provider = provider
        self.config = kwargs
        self._init_provider()

    def _init_provider(self):
        """初始化短信服务商"""
        if self.provider == "twilio":
            try:
                from twilio.rest import Client
                self.client = Client(
                    self.config.get('account_sid'),
                    self.config.get('auth_token')
                )
                self.from_number = self.config.get('from_number')
            except ImportError:
                print("⚠️  Twilio SDK 未安装，请运行: pip install twilio")
                self.client = None
        else:
            print(f"⚠️  不支持的短信服务商: {self.provider}")
            self.client = None

    def send(self, recipients: List[str], alert: Alert) -> bool:
        """发送短信预警"""
        if not self.client:
            print("⚠️  短信客户端未初始化")
            return False

        message = f"[{alert.severity.value.upper()}] {alert.rule.name}\n"
        message += f"时间: {alert.timestamp}\n"
        message += f"指标: {json.dumps(alert.triggered_values)}"

        success_count = 0
        for recipient in recipients:
            try:
                self.client.messages.create(
                    body=message,
                    from_=self.from_number,
                    to=recipient
                )
                success_count += 1
            except Exception as e:
                print(f"❌ 短信发送失败 {recipient}: {e}")

        print(f"✅ 已发送 {success_count}/{len(recipients)} 条预警短信")
        return success_count == len(recipients)


class WebhookNotifier:
    """Webhook通知器"""

    def __init__(self, webhook_url: str, method: str = "POST"):
        self.webhook_url = webhook_url
        self.method = method

    def send(self, recipients: List[str], alert: Alert) -> bool:
        """发送Webhook通知"""
        try:
            import requests
            payload = alert.to_dict()
            payload['recipients'] = recipients

            if self.method.upper() == "POST":
                response = requests.post(self.webhook_url, json=payload, timeout=10)
            else:
                response = requests.get(self.webhook_url, params=payload, timeout=10)

            response.raise_for_status()
            print(f"✅ Webhook通知已发送: {self.webhook_url}")
            return True
        except Exception as e:
            print(f"❌ Webhook发送失败: {e}")
            return False


class AlertEngine:
    """预警引擎 - 核心预警管理器"""

    def __init__(self):
        self.rules: Dict[str, AlertRule] = {}
        self.alerts: List[Alert] = []
        self.metric_data: Dict[str, deque] = {}
        self.notifiers: Dict[AlertChannel, Any] = {}
        self.alert_queue: queue.Queue = queue.Queue()
        self.running = False
        self.worker_thread: Optional[threading.Thread] = None
        self.callbacks: List[Callable[[Alert], None]] = []

    def add_rule(self, rule: AlertRule):
        """添加预警规则"""
        self.rules[rule.rule_id] = rule
        print(f"✅ 已添加预警规则: {rule.name}")

    def remove_rule(self, rule_id: str):
        """移除预警规则"""
        if rule_id in self.rules:
            del self.rules[rule_id]
            print(f"✅ 已移除预警规则: {rule_id}")

    def enable_rule(self, rule_id: str):
        """启用规则"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True

    def disable_rule(self, rule_id: str):
        """禁用规则"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False

    def register_notifier(self, channel: AlertChannel, notifier: Any):
        """注册通知器"""
        self.notifiers[channel] = notifier

    def register_callback(self, callback: Callable[[Alert], None]):
        """注册回调函数"""
        self.callbacks.append(callback)

    def update_metric(self, metric_name: str, value: float):
        """更新指标数据"""
        if metric_name not in self.metric_data:
            from collections import deque
            self.metric_data[metric_name] = deque(maxlen=1000)
        self.metric_data[metric_name].append({
            'value': value,
            'timestamp': time.time()
        })

    def evaluate_rules(self) -> List[Alert]:
        """评估所有规则"""
        triggered_alerts = []

        for rule_id, rule in self.rules.items():
            if not rule.enabled or not rule.is_ready():
                continue

            for condition in rule.conditions:
                if condition['type'] == 'threshold':
                    if self._check_threshold_condition(rule, condition):
                        alert = self._create_alert(rule, condition)
                        triggered_alerts.append(alert)
                        rule.trigger_cooldown()
                        break  # 每个规则每次只触发一次

        return triggered_alerts

    def _check_threshold_condition(self, rule: AlertRule,
                                    condition: Dict[str, Any]) -> bool:
        """检查阈值条件"""
        metric = condition['metric']
        operator = condition['operator']
        threshold = condition['threshold']
        window = condition.get('window_seconds', 60)

        if metric not in self.metric_data:
            return False

        # 获取窗口内的数据
        cutoff_time = time.time() - window
        window_data = [
            d for d in self.metric_data[metric]
            if d['timestamp'] >= cutoff_time
        ]

        if not window_data:
            return False

        # 使用窗口内的平均值
        avg_value = sum(d['value'] for d in window_data) / len(window_data)

        # 检查操作符
        operators = {
            '>': lambda v, t: v > t,
            '>=': lambda v, t: v >= t,
            '<': lambda v, t: v < t,
            '<=': lambda v, t: v <= t,
            '==': lambda v, t: v == t,
            '!=': lambda v, t: v != t
        }

        if operator in operators:
            return operators[operator](avg_value, threshold)

        return False

    def _create_alert(self, rule: AlertRule, condition: Dict) -> Alert:
        """创建预警实例"""
        metric = condition['metric']
        window_data = [
            d for d in self.metric_data.get(metric, [])
            if d['timestamp'] >= time.time() - condition.get('window_seconds', 60)
        ]

        avg_value = sum(d['value'] for d in window_data) / len(window_data) if window_data else 0

        alert = Alert(rule, {
            metric: avg_value,
            f'{metric}_threshold': condition['threshold'],
            f'{metric}_operator': condition['operator']
        })

        self.alerts.append(alert)
        return alert

    def _notification_worker(self):
        """通知工作线程"""
        while self.running or not self.alert_queue.empty():
            try:
                alert = self.alert_queue.get(timeout=1)
                self._send_notifications(alert)
                self.alert_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"❌ 通知工作线程异常: {e}")

    def _send_notifications(self, alert: Alert):
        """发送所有渠道的通知"""
        # 执行回调（用于应用内通知）
        for callback in self.callbacks:
            try:
                callback(alert)
            except Exception as e:
                print(f"❌ 预警回调执行失败: {e}")

        # 发送各渠道通知
        for channel in alert.rule.channels:
            if channel in self.notifiers and alert.rule.recipients:
                try:
                    self.notifiers[channel].send(alert.rule.recipients, alert)
                except Exception as e:
                    print(f"❌ {channel.value} 通知发送失败: {e}")

    def start(self):
        """启动预警引擎"""
        self.running = True
        self.worker_thread = threading.Thread(target=self._notification_worker, daemon=True)
        self.worker_thread.start()
        print("✅ 预警引擎已启动")

    def stop(self):
        """停止预警引擎"""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        print("✅ 预警引擎已停止")

    def check_and_notify(self):
        """检查并发送预警（建议定期调用）"""
        alerts = self.evaluate_rules()
        for alert in alerts:
            self.alert_queue.put(alert)
        return alerts

    def get_alerts(self, severity: Optional[AlertSeverity] = None,
                   limit: int = 100) -> List[Alert]:
        """获取预警历史"""
        filtered = self.alerts
        if severity:
            filtered = [a for a in filtered if a.severity == severity]
        return filtered[-limit:]

    def acknowledge_alert(self, alert_id: str) -> bool:
        """确认预警"""
        for alert in self.alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """解决预警"""
        for alert in self.alerts:
            if alert.alert_id == alert_id:
                alert.resolved = True
                return True
        return False


def create_demo_alert_engine() -> AlertEngine:
    """创建演示用的预警引擎"""
    engine = AlertEngine()

    # 创建示例规则1：CPU使用率过高
    rule1 = AlertRule(
        rule_id="cpu_high",
        name="CPU使用率过高",
        description="系统CPU使用率超过80%持续1分钟",
        severity=AlertSeverity.ERROR
    )
    rule1.add_threshold_condition('cpu_usage', '>', 80.0, window_seconds=60)
    rule1.add_channel(AlertChannel.EMAIL)
    rule1.add_channel(AlertChannel.IN_APP)
    rule1.add_recipient("admin@example.com")
    engine.add_rule(rule1)

    # 创建示例规则2：内存不足
    rule2 = AlertRule(
        rule_id="memory_high",
        name="内存使用率过高",
        description="系统内存使用率超过90%",
        severity=AlertSeverity.CRITICAL
    )
    rule2.add_threshold_condition('memory_usage', '>', 90.0, window_seconds=30)
    rule2.add_channel(AlertChannel.EMAIL)
    rule2.add_channel(AlertChannel.SMS)
    rule2.add_recipient("admin@example.com")
    rule2.add_recipient("+8613800138000")
    rule2.cooldown_seconds = 600  # 10分钟冷却
    engine.add_rule(rule2)

    # 创建示例规则3：异常检测
    rule3 = AlertRule(
        rule_id="anomaly_sales",
        name="销售数据异常",
        description="销售额出现异常波动",
        severity=AlertSeverity.WARNING
    )
    rule3.add_threshold_condition('sales_velocity', '>', 1000.0, window_seconds=300)
    rule3.add_channel(AlertChannel.EMAIL)
    rule3.add_recipient("sales@example.com")
    engine.add_rule(rule3)

    return engine


if __name__ == "__main__":
    # 演示预警引擎
    engine = create_demo_alert_engine()
    engine.start()

    # 模拟指标数据更新
    import random

    print("\n🚀 预警引擎演示模式")
    print("-" * 50)

    try:
        for i in range(30):
            # 模拟一些数据，故意让CPU高一些
            cpu = random.uniform(70, 95) if i > 5 else random.uniform(30, 60)
            memory = random.uniform(75, 92) if i > 10 else random.uniform(40, 70)
            sales = random.uniform(800, 1200)

            engine.update_metric('cpu_usage', cpu)
            engine.update_metric('memory_usage', memory)
            engine.update_metric('sales_velocity', sales)

            # 检查预警
            alerts = engine.check_and_notify()
            for alert in alerts:
                print(f"\n⚠️  预警触发: {alert.rule.name}")
                print(f"   级别: {alert.severity.value}")
                print(f"   触发值: {alert.triggered_values}")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\n停止演示...")

    engine.stop()
    print(f"\n演示结束，共产生 {len(engine.alerts)} 条预警")
