package com.textreader.data.repository

import com.textreader.data.dao.SettingsDao
import com.textreader.data.dao.TextItemDao
import com.textreader.data.dao.VoiceProfileDao
import com.textreader.data.entity.Settings
import com.textreader.data.entity.TextItem
import com.textreader.data.entity.VoiceProfile
import kotlinx.coroutines.flow.Flow

class TextReaderRepository(
    private val textItemDao: TextItemDao,
    private val settingsDao: SettingsDao,
    private val voiceProfileDao: VoiceProfileDao
) {
    fun getAllTextItems(): Flow<List<TextItem>> = textItemDao.getAllTextItems()
    fun getFavoriteTextItems(): Flow<List<TextItem>> = textItemDao.getFavoriteTextItems()
    fun getTextItemsByCategory(category: String): Flow<List<TextItem>> = textItemDao.getTextItemsByCategory(category)
    fun getAllCategories(): Flow<List<String>> = textItemDao.getAllCategories()
    suspend fun insertTextItem(textItem: TextItem) = textItemDao.insertTextItem(textItem)
    suspend fun updateTextItem(textItem: TextItem) = textItemDao.updateTextItem(textItem)
    suspend fun deleteTextItem(textItem: TextItem) = textItemDao.deleteTextItem(textItem)
    suspend fun deleteTextItemById(id: Long) = textItemDao.deleteTextItemById(id)

    fun getSettings(): Flow<Settings?> = settingsDao.getSettings()
    suspend fun insertSettings(settings: Settings) = settingsDao.insertSettings(settings)
    suspend fun updateSettings(settings: Settings) = settingsDao.updateSettings(settings)

    fun getAllVoiceProfiles(): Flow<List<VoiceProfile>> = voiceProfileDao.getAllVoiceProfiles()
    fun getDefaultVoiceProfile(): Flow<VoiceProfile?> = voiceProfileDao.getDefaultVoiceProfile()
    suspend fun insertVoiceProfile(profile: VoiceProfile) = voiceProfileDao.insertVoiceProfile(profile)
    suspend fun updateVoiceProfile(profile: VoiceProfile) = voiceProfileDao.updateVoiceProfile(profile)
    suspend fun deleteVoiceProfile(profile: VoiceProfile) = voiceProfileDao.deleteVoiceProfile(profile)
}
