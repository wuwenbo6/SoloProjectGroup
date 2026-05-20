package com.textreader.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.textreader.data.database.AppDatabase
import com.textreader.data.entity.TextItem
import com.textreader.data.repository.TextReaderRepository
import com.textreader.tts.TtsManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: TextReaderRepository
    private val ttsManager: TtsManager

    private val _speechRate = MutableStateFlow(1.0f)
    val speechRate: StateFlow<Float> = _speechRate.asStateFlow()

    private val _pitch = MutableStateFlow(1.0f)
    val pitch: StateFlow<Float> = _pitch.asStateFlow()

    private val _volume = MutableStateFlow(1.0f)
    val volume: StateFlow<Float> = _volume.asStateFlow()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

    private val _currentProgress = MutableStateFlow(0)
    val currentProgress: StateFlow<Int> = _currentProgress.asStateFlow()

    private val _totalSegments = MutableStateFlow(0)
    val totalSegments: StateFlow<Int> = _totalSegments.asStateFlow()

    private val _textItems = MutableStateFlow<List<TextItem>>(emptyList())
    val textItems: StateFlow<List<TextItem>> = _textItems.asStateFlow()

    private val _selectedCategory = MutableStateFlow("全部")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val _categories = MutableStateFlow<List<String>>(emptyList())
    val categories: StateFlow<List<String>> = _categories.asStateFlow()

    init {
        val db = AppDatabase.getDatabase(application)
        repository = TextReaderRepository(
            db.textItemDao(),
            db.settingsDao(),
            db.voiceProfileDao()
        )
        ttsManager = TtsManager(application)
        ttsManager.initialize()

        loadData()
        observeTtsState()
    }

    private fun loadData() {
        viewModelScope.launch {
            repository.getAllTextItems().collect { items ->
                _textItems.value = items
            }
        }
        viewModelScope.launch {
            repository.getAllCategories().collect { cats ->
                _categories.value = listOf("全部", "收藏") + cats
            }
        }
    }

    private fun observeTtsState() {
        viewModelScope.launch {
            ttsManager.isSpeaking.collect { speaking ->
                _isSpeaking.value = speaking
            }
        }
        viewModelScope.launch {
            ttsManager.currentProgress.collect { progress ->
                _currentProgress.value = progress
            }
        }
        viewModelScope.launch {
            ttsManager.totalSegments.collect { total ->
                _totalSegments.value = total
            }
        }
    }

    fun setSpeechRate(rate: Float) {
        _speechRate.value = rate
        ttsManager.setSpeechRate(rate)
    }

    fun setPitch(pitchValue: Float) {
        _pitch.value = pitchValue
        ttsManager.setPitch(pitchValue)
    }

    fun setVolume(volumeValue: Float) {
        _volume.value = volumeValue
        ttsManager.setVolume(volumeValue)
    }

    fun speak(text: String) {
        ttsManager.speak(text)
        _isPaused.value = false
    }

    fun stopSpeaking() {
        ttsManager.stop()
        _isSpeaking.value = false
        _isPaused.value = false
    }

    fun pauseSpeaking() {
        ttsManager.pause()
        _isPaused.value = true
    }

    fun resumeSpeaking() {
        ttsManager.resume()
        _isPaused.value = false
    }

    fun addTextItem(content: String, title: String = "", category: String = "默认") {
        viewModelScope.launch {
            val textItem = TextItem(
                content = content,
                title = title,
                category = category
            )
            repository.insertTextItem(textItem)
        }
    }

    fun deleteTextItem(textItem: TextItem) {
        viewModelScope.launch {
            repository.deleteTextItem(textItem)
        }
    }

    fun toggleFavorite(textItem: TextItem) {
        viewModelScope.launch {
            val updated = textItem.copy(isFavorite = !textItem.isFavorite)
            repository.updateTextItem(updated)
        }
    }

    fun setCategory(category: String) {
        _selectedCategory.value = category
    }

    fun getAvailableEngines() = ttsManager.getAvailableEngines()
    fun switchEngine(enginePackageName: String) = ttsManager.switchEngine(enginePackageName)

    override fun onCleared() {
        super.onCleared()
        ttsManager.shutdown()
    }
}
