package com.textreader.app.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.textreader.app.viewmodel.MainViewModel

@Composable
fun ReaderScreen(viewModel: MainViewModel) {
    var inputText by remember { mutableStateOf("") }
    val isSpeaking by viewModel.isSpeaking
    val isPaused by viewModel.isPaused
    val currentProgress by viewModel.currentProgress
    val totalSegments by viewModel.totalSegments
    val speechRate by viewModel.speechRate
    val pitch by viewModel.pitch
    val volume by viewModel.volume

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        OutlinedTextField(
            value = inputText,
            onValueChange = { inputText = it },
            label = { Text("输入要朗读的文本") },
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            maxLines = 10
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (totalSegments > 0) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("朗读进度")
                    Spacer(modifier = Modifier.height(8.dp))
                    val progress = if (totalSegments > 0) currentProgress.toFloat() / totalSegments.toFloat() else 0f
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("$currentProgress / $totalSegments 段")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }

        Row {
            Button(
                onClick = { viewModel.speak(inputText) },
                enabled = inputText.isNotBlank()
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = "播放")
                Spacer(modifier = Modifier.width(8.dp))
                Text("播放")
            }

            Spacer(modifier = Modifier.width(8.dp))

            Button(
                onClick = {
                    if (isPaused) {
                        viewModel.resumeSpeaking()
                    } else {
                        viewModel.pauseSpeaking()
                    }
                },
                enabled = isSpeaking || isPaused
            ) {
                Icon(Icons.Default.Pause, contentDescription = if (isPaused) "继续" else "暂停")
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (isPaused) "继续" else "暂停")
            }

            Spacer(modifier = Modifier.width(8.dp))

            Button(
                onClick = { viewModel.stopSpeaking() },
                enabled = isSpeaking || isPaused
            ) {
                Icon(Icons.Default.Stop, contentDescription = "停止")
                Spacer(modifier = Modifier.width(8.dp))
                Text("停止")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("语音设置", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)

                Spacer(modifier = Modifier.height(16.dp))

                Text("语速: ${String.format("%.1f", speechRate)}x")
                androidx.compose.material3.Slider(
                    value = speechRate,
                    onValueChange = { viewModel.setSpeechRate(it) },
                    valueRange = 0.1f..2.0f,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text("音调: ${String.format("%.1f", pitch)}x")
                androidx.compose.material3.Slider(
                    value = pitch,
                    onValueChange = { viewModel.setPitch(it) },
                    valueRange = 0.5f..2.0f,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text("音量: ${String.format("%.0f", volume * 100)}%")
                androidx.compose.material3.Slider(
                    value = volume,
                    onValueChange = { viewModel.setVolume(it) },
                    valueRange = 0.0f..1.0f,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
