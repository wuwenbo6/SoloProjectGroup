package com.textreader.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "text_items")
data class TextItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val content: String,
    val title: String = "",
    val category: String = "默认",
    val isFavorite: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val lastReadAt: Long? = null
)
