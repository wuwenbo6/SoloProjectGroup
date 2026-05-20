package com.quakedetect.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.firestore.FirebaseFirestore
import com.quakedetect.app.R
import com.quakedetect.app.algorithm.DetectionResult
import com.quakedetect.app.algorithm.StaLtaDetector
import com.quakedetect.app.data.AppDatabase
import com.quakedetect.app.data.DetectionEvent
import com.quakedetect.app.data.SensorData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class SensorMonitorService : Service(), SensorEventListener {
    private val TAG = "SensorMonitorService"
    private val NOTIFICATION_ID = 12345
    private val CHANNEL_ID = "quake_detect_service"

    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var gyroscope: Sensor? = null

    private var currentAccelX = 0f
    private var currentAccelY = 0f
    private var currentAccelZ = 0f
    private var currentGyroX = 0f
    private var currentGyroY = 0f
    private var currentGyroZ = 0f

    private lateinit var staLtaDetector: StaLtaDetector
    private lateinit var db: AppDatabase
    private lateinit var firestore: FirebaseFirestore

    private val serviceScope = CoroutineScope(Dispatchers.Default + Job())
    private var sensorJob: Job? = null
    private var cleanupJob: Job? = null
    private var syncJob: Job? = null

    private var lastDetectionTime = 0L
    private val detectionCooldown = 30000L

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        staLtaDetector = StaLtaDetector()
        db = AppDatabase.getDatabase(this)
        firestore = FirebaseFirestore.getInstance()

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())

        registerSensors()
        startSensorProcessing()
        startCleanupJob()
        startSyncJob()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Quake Detection Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors sensors for earthquake detection"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Quake Detect")
            .setContentText("Monitoring for earthquakes...")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun registerSensors() {
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        gyroscope?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    private fun startSensorProcessing() {
        sensorJob = serviceScope.launch {
            while (true) {
                val timestamp = System.currentTimeMillis()
                val magnitude = kotlin.math.sqrt(
                    currentAccelX * currentAccelX +
                            currentAccelY * currentAccelY +
                            currentAccelZ * currentAccelZ
                ).toDouble()

                val sensorData = SensorData(
                    timestamp = timestamp,
                    accelX = currentAccelX,
                    accelY = currentAccelY,
                    accelZ = currentAccelZ,
                    gyroX = currentGyroX,
                    gyroY = currentGyroY,
                    gyroZ = currentGyroZ,
                    magnitude = magnitude.toFloat()
                )

                db.sensorDao().insertSensorData(sensorData)

                val result = staLtaDetector.addSample(
                    currentAccelX,
                    currentAccelY,
                    currentAccelZ
                )

                if (result.triggerStart) {
                    handleEarthquakeDetection(result)
                }

                delay(50)
            }
        }
    }

    private fun handleEarthquakeDetection(result: DetectionResult) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastDetectionTime < detectionCooldown) {
            return
        }
        lastDetectionTime = currentTime

        Log.d(TAG, "Earthquake detected! Intensity: ${result.intensity}, Ratio: ${result.ratio}")

        getCurrentLocation { location ->
            serviceScope.launch {
                val event = DetectionEvent(
                    timestamp = currentTime,
                    latitude = location?.latitude ?: 0.0,
                    longitude = location?.longitude ?: 0.0,
                    intensity = result.intensity,
                    staLtaRatio = result.ratio,
                    synced = false
                )
                db.sensorDao().insertDetectionEvent(event)
                syncEventToFirebase(event)
            }
        }
    }

    private fun getCurrentLocation(callback: (Location?) -> Unit) {
        try {
            val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
            fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                null
            ).addOnSuccessListener { location ->
                callback(location)
            }.addOnFailureListener {
                callback(null)
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied", e)
            callback(null)
        }
    }

    private suspend fun syncEventToFirebase(event: DetectionEvent) {
        val eventMap = hashMapOf(
            "deviceId" to android.provider.Settings.Secure.getString(
                contentResolver,
                android.provider.Settings.Secure.ANDROID_ID
            ),
            "timestamp" to event.timestamp,
            "latitude" to event.latitude,
            "longitude" to event.longitude,
            "intensity" to event.intensity,
            "staLtaRatio" to event.staLtaRatio
        )

        firestore.collection("detections")
            .add(eventMap)
            .addOnSuccessListener {
                serviceScope.launch {
                    db.sensorDao().markAsSynced(event.id)
                }
                Log.d(TAG, "Event synced to Firebase")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync event", e)
            }
    }

    private fun startCleanupJob() {
        cleanupJob = serviceScope.launch {
            while (true) {
                val cutoffTime = System.currentTimeMillis() - 3600000
                db.sensorDao().deleteOldData(cutoffTime)
                delay(60000)
            }
        }
    }

    private fun startSyncJob() {
        syncJob = serviceScope.launch {
            while (true) {
                val unsynced = db.sensorDao().getUnsyncedEvents()
                unsynced.forEach { event ->
                    syncEventToFirebase(event)
                }
                delay(30000)
            }
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            when (it.sensor.type) {
                Sensor.TYPE_ACCELEROMETER -> {
                    currentAccelX = it.values[0]
                    currentAccelY = it.values[1]
                    currentAccelZ = it.values[2]
                }
                Sensor.TYPE_GYROSCOPE -> {
                    currentGyroX = it.values[0]
                    currentGyroY = it.values[1]
                    currentGyroZ = it.values[2]
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        sensorManager.unregisterListener(this)
        sensorJob?.cancel()
        cleanupJob?.cancel()
        syncJob?.cancel()
        Log.d(TAG, "Service destroyed")
    }
}
