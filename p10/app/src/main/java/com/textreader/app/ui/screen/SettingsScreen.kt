package com.textreader.app.ui.screen

import android.content.Context
import android.content.Intent
import android.provider.Settings
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
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.textreader.app.viewmodel.MainViewModel
import com.textreader.tts.TtsEngineInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    var autoPlay by remember { mutableStateOf(true) }
    var engineExpanded by remember { mutableStateOf(false) }
    val availableEngines = remember { viewModel.getAvailableEngines() }
    var selectedEngine by remember { mutableStateOf<TtsEngineInfo?>(null) }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("无障碍服务", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "启用无障碍服务以监听系统文本选择事件，实现全局朗读功能",
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { openAccessibilitySettings(context) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("打开无障碍设置")
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Default.ArrowForward, contentDescription = null)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("悬浮窗权限", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "需要悬浮窗权限以显示朗读控制悬浮窗",
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { openOverlaySettings(context) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("打开悬浮窗设置")
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Default.ArrowForward, contentDescription = null)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("TTS 引擎设置", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "选择和配置系统 TTS 引擎，支持第三方 TTS 引擎",
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))

                ExposedDropdownMenuBox(
                    expanded = engineExpanded,
                    onExpandedChange = { engineExpanded = !engineExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedEngine?.label ?: "选择 TTS 引擎",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = engineExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )

                    ExposedDropdownMenu(
                        expanded = engineExpanded,
                        onDismissRequest = { engineExpanded = false }
                    ) {
                        if (availableEngines.isEmpty()) {
                            DropdownMenuItem(
                                text = { Text("未检测到可用引擎") },
                                onClick = { engineExpanded = false }
                            )
                        } else {
                            availableEngines.forEach { engine ->
                                DropdownMenuItem(
                                    text = { Text(engine.label) },
                                    onClick = {
                                        selectedEngine = engine
                                        viewModel.switchEngine(engine.packageName)
                                        engineExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { openTTSSettings(context) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("打开系统 TTS 设置")
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Default.ArrowForward, contentDescription = null)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("其他设置", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "选中文本后自动播放",
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = autoPlay,
                        onCheckedChange = { autoPlay = it }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            "版本: 1.0.0",
            style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

fun openAccessibilitySettings(context: Context) {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    context.startActivity(intent)
}

fun openOverlaySettings(context: Context) {
    val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        android.net.Uri.parse("package:${context.packageName}")
    )
    context.startActivity(intent)
}

fun openTTSSettings(context: Context) {
    val intent = Intent("com.android.settings.TTS_SETTINGS")
    context.startActivity(intent)
}
