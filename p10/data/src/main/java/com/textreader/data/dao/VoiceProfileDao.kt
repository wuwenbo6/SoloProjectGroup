package com.textreader.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.textreader.data.entity.VoiceProfile
import kotlinx.coroutines.flow.Flow

@Dao
interface VoiceProfileDao {
    @Query("SELECT * FROM voice_profiles ORDER BY id ASC")
    fun getAllVoiceProfiles(): Flow<List<VoiceProfile>>

    @Query("SELECT * FROM voice_profiles WHERE isDefault = 1 LIMIT 1")
    fun getDefaultVoiceProfile(): Flow<VoiceProfile?>

    @Insert
    suspend fun insertVoiceProfile(profile: VoiceProfile)

    @Update
    suspend fun updateVoiceProfile(profile: VoiceProfile)

    @Delete
    suspend fun deleteVoiceProfile(profile: VoiceProfile)
}
