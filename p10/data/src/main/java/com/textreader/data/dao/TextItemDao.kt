package com.textreader.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.textreader.data.entity.TextItem
import kotlinx.coroutines.flow.Flow

@Dao
interface TextItemDao {
    @Query("SELECT * FROM text_items ORDER BY createdAt DESC")
    fun getAllTextItems(): Flow<List<TextItem>>

    @Query("SELECT * FROM text_items WHERE isFavorite = 1 ORDER BY createdAt DESC")
    fun getFavoriteTextItems(): Flow<List<TextItem>>

    @Query("SELECT * FROM text_items WHERE category = :category ORDER BY createdAt DESC")
    fun getTextItemsByCategory(category: String): Flow<List<TextItem>>

    @Query("SELECT DISTINCT category FROM text_items")
    fun getAllCategories(): Flow<List<String>>

    @Insert
    suspend fun insertTextItem(textItem: TextItem)

    @Update
    suspend fun updateTextItem(textItem: TextItem)

    @Delete
    suspend fun deleteTextItem(textItem: TextItem)

    @Query("DELETE FROM text_items WHERE id = :id")
    suspend fun deleteTextItemById(id: Long)
}
