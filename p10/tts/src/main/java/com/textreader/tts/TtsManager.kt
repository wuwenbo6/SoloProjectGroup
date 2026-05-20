package com.textreader.tts

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.nio.charset.Charset
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.math.min

data class SpeechSegment(
    val id: String,
    val text: String,
    val index: Int
)

class TtsManager(private val context: Context) {

    companion object {
        private const val MAX_SEGMENT_LENGTH = 300
        private const val SEGMENT_DELAY_MS = 50L
        private const val MAX_RETRY_COUNT = 3
    }

    private var textToSpeech: TextToSpeech? = null
    private val ttsMutex = Mutex()

    private val _isInitialized = MutableStateFlow(false)
    val isInitialized: StateFlow<Boolean> = _isInitialized

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking

    private val _currentProgress = MutableStateFlow(0)
    val currentProgress: StateFlow<Int> = _currentProgress

    private val _totalSegments = MutableStateFlow(0)
    val totalSegments: StateFlow<Int> = _totalSegments

    private val _currentText = MutableStateFlow("")
    val currentText: StateFlow<String> = _currentText

    private var speechRate = 1.0f
    private var pitch = 1.0f
    private var volume = 1.0f
    private var currentEngine: String? = null
    private var currentLanguage = Locale.CHINA

    private val speechQueue = ConcurrentLinkedQueue<SpeechSegment>()
    private val coroutineScope = CoroutineScope(Dispatchers.Default + Job())
    private var speechJob: Job? = null
    private var currentSegmentIndex = 0
    private var isPaused = false
    private val pauseLock = Any()

    fun initialize(enginePackageName: String? = null) {
        coroutineScope.launch {
            ttsMutex.withLock {
                if (textToSpeech != null) {
                    textToSpeech?.shutdown()
                    textToSpeech = null
                }

                val initListener = TextToSpeech.OnInitListener { status ->
                    coroutineScope.launch {
                        if (status == TextToSpeech.SUCCESS) {
                            _isInitialized.value = true
                            setupTtsParameters()
                        }
                    }
                }

                textToSpeech = try {
                    if (enginePackageName != null) {
                        TextToSpeech(context, initListener, enginePackageName)
                    } else {
                        TextToSpeech(context, initListener)
                    }
                } catch (e: Exception) {
                    TextToSpeech(context, initListener)
                }

                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String) {
                        _isSpeaking.value = true
                    }

                    override fun onDone(utteranceId: String) {
                        currentSegmentIndex++
                        _currentProgress.value = currentSegmentIndex
                    }

                    override fun onError(utteranceId: String) {
                    }

                    override fun onError(utteranceId: String, errorCode: Int) {
                    }

                    override fun onRangeStart(utteranceId: String, start: Int, end: Int, frame: Int) {
                    }
                })
            }
        }
    }

    private fun setupTtsParameters() {
        textToSpeech?.let { tts ->
            try {
                val result = tts.setLanguage(currentLanguage)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.getDefault())
                }
            } catch (e: Exception) {
                tts.setLanguage(Locale.getDefault())
            }

            tts.setSpeechRate(speechRate)
            tts.setPitch(pitch)
            setupAudioAttributes()
        }
    }

    private fun setupAudioAttributes() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                textToSpeech?.setAudioAttributes(audioAttributes)
            } catch (e: Exception) {
            }
        }
    }

    fun speak(text: String) {
        if (!_isInitialized.value) return

        stop()
        _currentText.value = text

        coroutineScope.launch {
            val segments = splitTextToSegments(text)
            _totalSegments.value = segments.size
            _currentProgress.value = 0
            currentSegmentIndex = 0

            speechQueue.clear()
            segments.forEach { speechQueue.add(it) }

            startSpeechProcessing()
        }
    }

    fun speakSegmented(text: String) = speak(text)

    private suspend fun splitTextToSegments(text: String): List<SpeechSegment> = withContext(Dispatchers.Default) {
        val segments = mutableListOf<SpeechSegment>()
        var index = 0

        val cleanText = normalizeText(text)

        val sentenceSplitters = listOf("。", "！", "？", "\n", ".", "!", "?", ";", "；")
        var remainingText = cleanText

        while (remainingText.isNotEmpty()) {
            val segment = extractSegment(remainingText, sentenceSplitters)
            if (segment.isNotBlank()) {
                segments.add(SpeechSegment(id = "seg_$index", text = segment.trim(), index = index))
                index++
            }
            remainingText = remainingText.substring(min(segment.length, remainingText.length))
        }

        segments
    }

    private fun normalizeText(text: String): String {
        var normalized = text

        normalized = normalized.replace("\u0000", "")
        normalized = normalized.replace("\uFFFD", "")

        normalized = try {
            val bytes = normalized.toByteArray(Charsets.UTF_8)
            String(bytes, Charsets.UTF_8)
        } catch (e: Exception) {
            normalized
        }

        normalized = normalized.replace("[\\p{Cntrl}&&[^\n\r]]".toRegex(), "")

        return normalized
    }

    private fun extractSegment(text: String, splitters: List<String>): String {
        if (text.length <= MAX_SEGMENT_LENGTH) {
            return text
        }

        for (splitter in splitters) {
            val pos = text.indexOf(splitter, 0)
            if (pos > 0 && pos <= MAX_SEGMENT_LENGTH) {
                return text.substring(0, pos + splitter.length)
            }
        }

        val commaPos = text.indexOf("，", MAX_SEGMENT_LENGTH / 2)
        if (commaPos in 1 until MAX_SEGMENT_LENGTH) {
            return text.substring(0, commaPos + 1)
        }

        val spacePos = text.indexOf(" ", MAX_SEGMENT_LENGTH / 2)
        if (spacePos in 1 until MAX_SEGMENT_LENGTH) {
            return text.substring(0, spacePos + 1)
        }

        return text.substring(0, MAX_SEGMENT_LENGTH)
    }

    private fun startSpeechProcessing() {
        speechJob?.cancel()
        speechJob = coroutineScope.launch {
            isPaused = false

            while (speechQueue.isNotEmpty() && !isPaused) {
                val segment = speechQueue.poll() ?: break
                speakSegment(segment)
                delay(SEGMENT_DELAY_MS)

                while (isPaused) {
                    delay(100)
                }
            }

            if (speechQueue.isEmpty()) {
                _isSpeaking.value = false
            }
        }
    }

    private suspend fun speakSegment(segment: SpeechSegment) {
        ttsMutex.withLock {
            if (!_isInitialized.value) return@withLock

            val params = Bundle()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume)
            }

            var retryCount = 0
            var success = false

            while (retryCount < MAX_RETRY_COUNT && !success) {
                try {
                    val result = textToSpeech?.speak(
                        segment.text,
                        if (segment.index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD,
                        params,
                        segment.id
                    )

                    if (result == TextToSpeech.SUCCESS) {
                        success = true
                        _isSpeaking.value = true
                    } else {
                        retryCount++
                        delay(100)
                    }
                } catch (e: Exception) {
                    retryCount++
                    delay(100)
                }
            }
        }
    }

    fun pause() {
        isPaused = true
        textToSpeech?.stop()
        _isSpeaking.value = false
    }

    fun resume() {
        if (isPaused && speechQueue.isNotEmpty()) {
            isPaused = false
            startSpeechProcessing()
        }
    }

    fun stop() {
        isPaused = false
        speechJob?.cancel()
        speechJob = null
        speechQueue.clear()
        currentSegmentIndex = 0
        textToSpeech?.stop()
        _isSpeaking.value = false
        _currentProgress.value = 0
        _totalSegments.value = 0
        _currentText.value = ""
    }

    fun setSpeechRate(rate: Float) {
        speechRate = rate.coerceIn(0.1f, 2.0f)
        coroutineScope.launch {
            ttsMutex.withLock {
                try {
                    textToSpeech?.setSpeechRate(speechRate)
                } catch (e: Exception) {
                }
            }
        }
    }

    fun setPitch(pitchValue: Float) {
        pitch = pitchValue.coerceIn(0.5f, 2.0f)
        coroutineScope.launch {
            ttsMutex.withLock {
                try {
                    textToSpeech?.setPitch(pitch)
                } catch (e: Exception) {
                }
            }
        }
    }

    fun setVolume(volumeValue: Float) {
        volume = volumeValue.coerceIn(0.0f, 1.0f)
    }

    fun setLanguage(locale: Locale): Boolean {
        currentLanguage = locale
        val result = textToSpeech?.setLanguage(locale)
        return result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
    }

    fun getAvailableEngines(): List<TtsEngineInfo> {
        val engines = mutableListOf<TtsEngineInfo>()
        try {
            textToSpeech?.engines?.forEach { engine ->
                engines.add(
                    TtsEngineInfo(
                        name = engine.name,
                        label = engine.label.toString(),
                        packageName = engine.name
                    )
                )
            }
        } catch (e: Exception) {
        }
        return engines
    }

    fun getAvailableLanguages(): List<Locale> {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                textToSpeech?.availableLanguages?.toList() ?: emptyList()
            } else {
                listOf(Locale.CHINA, Locale.US, Locale.JAPAN, Locale.KOREA)
            }
        } catch (e: Exception) {
            listOf(Locale.CHINA, Locale.US, Locale.JAPAN, Locale.KOREA)
        }
    }

    fun switchEngine(enginePackageName: String) {
        stop()
        shutdown()
        currentEngine = enginePackageName
        initialize(enginePackageName)
    }

    fun shutdown() {
        stop()
        coroutineScope.launch {
            ttsMutex.withLock {
                try {
                    textToSpeech?.shutdown()
                } catch (e: Exception) {
                }
                textToSpeech = null
                _isInitialized.value = false
            }
        }
    }

    fun getSpeechRate(): Float = speechRate
    fun getPitch(): Float = pitch
    fun getVolume(): Float = volume

    fun isPaused(): Boolean = isPaused
    fun getRemainingSegmentsCount(): Int = speechQueue.size
}
