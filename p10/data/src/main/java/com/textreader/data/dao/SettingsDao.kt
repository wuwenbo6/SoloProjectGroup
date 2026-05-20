package com.textreader.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.textreader.data.entity.Settings
import kotlinx.coroutines.flow.Flow

@Dao
interface SettingsDao {
    @Query("SELECT * FROM settings WHERE id = 1")
    fun getSettings(): Flow<Settings?>

    @Insert
    suspend fun insertSettings(settings: Settings)

    @Update
    suspend fun updateSettings(settings: Settings)
}
