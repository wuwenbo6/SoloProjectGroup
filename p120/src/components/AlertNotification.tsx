
import { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useSensorStore } from '../store/sensorStore';

const sensorLabels: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    salinity: '盐度',
    ph: 'pH值',
};

export const AlertNotification = () => {
    const latestAlert = useSensorStore((state) => state.latestAlert);
    const showAlertNotification = useSensorStore((state) => state.showAlertNotification);
    const setShowAlertNotification = useSensorStore((state) => state.setShowAlertNotification);
    const lastAlertIdRef = useRef<number | null>(null);
    const [displayAlert, setDisplayAlert] = useState(latestAlert);

    useEffect(() => {
        if (latestAlert && latestAlert.id !== lastAlertIdRef.current) {
            lastAlertIdRef.current = latestAlert.id;
            setDisplayAlert(latestAlert);
        }
    }, [latestAlert]);

    useEffect(() => {
        if (showAlertNotification && displayAlert) {
            const timer = setTimeout(() => {
                setShowAlertNotification(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showAlertNotification, displayAlert, setShowAlertNotification]);

    if (!showAlertNotification || !displayAlert) return null;

    return (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className="bg-red-500 text-white rounded-xl p-4 shadow-2xl max-w-sm">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-lg">异常告警</p>
                        <p className="text-sm opacity-90 mt-1">
                            {sensorLabels[displayAlert.sensor_type]}: {displayAlert.current_value}
                            {displayAlert.alert_type === 'high' ? ' 高于' : ' 低于'}阈值 {displayAlert.threshold_value}
                        </p>
                        <p className="text-xs opacity-70 mt-2">
                            {new Date(displayAlert.created_at).toLocaleString('zh-CN')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAlertNotification(false)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

