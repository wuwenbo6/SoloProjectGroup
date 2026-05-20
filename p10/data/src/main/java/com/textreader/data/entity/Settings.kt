package com.textreader.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "settings")
data class Settings(
    @PrimaryKey val id: Int = 1,
    val speechRate: Float = 1.0f,
    val pitch: Float = 1.0f,
    val volume: Float = 1.0f,
    val currentEngine: String = "",
    val language: String = "zh-CN",
    val autoPlayOnSelect: Boolean = true
)
