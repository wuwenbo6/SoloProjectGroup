package com.textreader.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "voice_profiles")
data class VoiceProfile(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val speechRate: Float,
    val pitch: Float,
    val volume: Float,
    val engine: String,
    val isDefault: Boolean = false
)
