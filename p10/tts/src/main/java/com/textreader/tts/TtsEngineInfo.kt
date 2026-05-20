package com.textreader.tts

data class TtsEngineInfo(
    val name: String,
    val label: String,
    val packageName: String,
    val isSystem: Boolean = false
)
