package com.quakedetect.app.util

import android.content.Context
import android.os.Environment
import com.quakedetect.app.data.DetectionEvent
import com.quakedetect.app.data.SensorData
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CsvExporter(private val context: Context) {

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault())
    private val timestampFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())

    fun exportSensorData(sensorDataList: List<SensorData>): File? {
        return try {
            val fileName = "sensor_data_${dateFormat.format(Date())}.csv"
            val file = createExportFile(fileName)

            FileWriter(file).use { writer ->
                writer.append("id,timestamp,datetime,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,magnitude\n")

                sensorDataList.forEach { data ->
                    writer.append("${data.id},")
                    writer.append("${data.timestamp},")
                    writer.append("${timestampFormat.format(Date(data.timestamp))},")
                    writer.append("${data.accelX},")
                    writer.append("${data.accelY},")
                    writer.append("${data.accelZ},")
                    writer.append("${data.gyroX},")
                    writer.append("${data.gyroY},")
                    writer.append("${data.gyroZ},")
                    writer.append("${data.magnitude}\n")
                }
            }

            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun exportDetectionEvents(events: List<DetectionEvent>): File? {
        return try {
            val fileName = "detection_events_${dateFormat.format(Date())}.csv"
            val file = createExportFile(fileName)

            FileWriter(file).use { writer ->
                writer.append("id,timestamp,datetime,latitude,longitude,intensity,sta_lta_ratio,synced\n")

                events.forEach { event ->
                    writer.append("${event.id},")
                    writer.append("${event.timestamp},")
                    writer.append("${timestampFormat.format(Date(event.timestamp))},")
                    writer.append("${event.latitude},")
                    writer.append("${event.longitude},")
                    writer.append("${event.intensity},")
                    writer.append("${event.staLtaRatio},")
                    writer.append("${event.synced}\n")
                }
            }

            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun exportCombinedData(
        sensorDataList: List<SensorData>,
        events: List<DetectionEvent>
    ): File? {
        return try {
            val fileName = "quake_export_${dateFormat.format(Date())}.csv"
            val file = createExportFile(fileName)

            FileWriter(file).use { writer ->
                writer.append("=== DETECTION EVENTS ===\n")
                writer.append("id,timestamp,datetime,latitude,longitude,intensity,sta_lta_ratio,synced\n")
                events.forEach { event ->
                    writer.append("${event.id},${event.timestamp},${timestampFormat.format(Date(event.timestamp))},")
                    writer.append("${event.latitude},${event.longitude},${event.intensity},${event.staLtaRatio},${event.synced}\n")
                }

                writer.append("\n=== SENSOR DATA ===\n")
                writer.append("id,timestamp,datetime,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,magnitude\n")
                sensorDataList.forEach { data ->
                    writer.append("${data.id},${data.timestamp},${timestampFormat.format(Date(data.timestamp))},")
                    writer.append("${data.accelX},${data.accelY},${data.accelZ},")
                    writer.append("${data.gyroX},${data.gyroY},${data.gyroZ},${data.magnitude}\n")
                }
            }

            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun exportMlFeatures(
        featuresList: List<MlFeatureRecord>
    ): File? {
        return try {
            val fileName = "ml_features_${dateFormat.format(Date())}.csv"
            val file = createExportFile(fileName)

            FileWriter(file).use { writer ->
                writer.append("timestamp,datetime,mean_amplitude,std_amplitude,peak_frequency,")
                writer.append("spectral_centroid,duration,rise_time,max_ratio,zero_crossing_rate,")
                writer.append("is_earthquake,quake_probability,confidence\n")

                featuresList.forEach { record ->
                    writer.append("${record.timestamp},")
                    writer.append("${timestampFormat.format(Date(record.timestamp))},")
                    writer.append("${record.features.meanAmplitude},")
                    writer.append("${record.features.stdAmplitude},")
                    writer.append("${record.features.peakFrequency},")
                    writer.append("${record.features.spectralCentroid},")
                    writer.append("${record.features.duration},")
                    writer.append("${record.features.riseTime},")
                    writer.append("${record.features.maxRatio},")
                    writer.append("${record.features.zeroCrossingRate},")
                    writer.append("${record.classification.isEarthquake},")
                    writer.append("${record.classification.earthquakeProbability},")
                    writer.append("${record.classification.confidence}\n")
                }
            }

            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun createExportFile(fileName: String): File {
        val exportDir = File(
            context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),
            "QuakeDetectExports"
        )
        if (!exportDir.exists()) {
            exportDir.mkdirs()
        }
        return File(exportDir, fileName)
    }

    fun getExportDirectory(): File? {
        return context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)?.let {
            File(it, "QuakeDetectExports")
        }
    }
}

data class MlFeatureRecord(
    val timestamp: Long,
    val features: com.quakedetect.app.algorithm.QuakeClassifier.FeatureVector,
    val classification: com.quakedetect.app.algorithm.QuakeClassifier.ClassificationResult
)
