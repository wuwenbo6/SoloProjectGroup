package com.quakedetect.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SensorDao {
    @Insert
    suspend fun insertSensorData(data: SensorData)

    @Query("SELECT * FROM sensor_data WHERE timestamp >= :startTime ORDER BY timestamp DESC")
    suspend fun getSensorDataSince(startTime: Long): List<SensorData>

    @Query("DELETE FROM sensor_data WHERE timestamp < :cutoffTime")
    suspend fun deleteOldData(cutoffTime: Long)

    @Insert
    suspend fun insertDetectionEvent(event: DetectionEvent)

    @Query("SELECT * FROM detection_events WHERE synced = 0 ORDER BY timestamp DESC")
    suspend fun getUnsyncedEvents(): List<DetectionEvent>

    @Query("UPDATE detection_events SET synced = 1 WHERE id = :eventId")
    suspend fun markAsSynced(eventId: Long)

    @Query("SELECT * FROM detection_events ORDER BY timestamp DESC LIMIT 50")
    fun getRecentEvents(): Flow<List<DetectionEvent>>
}
