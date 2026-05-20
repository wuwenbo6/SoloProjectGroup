package com.textreader.accessibility

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class TextSelectionAccessibilityService : AccessibilityService() {

    companion object {
        const val CHANNEL_ID = "AccessibilityServiceChannel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP_SERVICE = "com.textreader.ACTION_STOP_SERVICE"

        private var instance: TextSelectionAccessibilityService? = null

        fun isRunning(): Boolean = instance != null
    }

    private var floatingWindowManager: FloatingWindowManager? = null
    private var lastSelectedText: String? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var debounceJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        floatingWindowManager = FloatingWindowManager(this)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED -> {
                handleTextSelection(event)
            }
        }
    }

    private fun handleTextSelection(event: AccessibilityEvent) {
        debounceJob?.cancel()
        debounceJob = serviceScope.launch {
            delay(200)
            val sourceNode = event.source ?: return@launch
            try {
                val selectedText = getSelectedText(sourceNode)
                if (selectedText != null && selectedText.isNotBlank() && selectedText != lastSelectedText) {
                    lastSelectedText = selectedText
                    showFloatingWindow(selectedText)
                }
            } finally {
                sourceNode.recycle()
            }
        }
    }

    private fun getSelectedText(node: AccessibilityNodeInfo): String? {
        val text = node.text ?: return null
        val selectionStart = node.textSelectionStart
        val selectionEnd = node.textSelectionEnd

        return if (selectionStart >= 0 && selectionEnd >= 0 && selectionStart < selectionEnd) {
            try {
                text.substring(selectionStart, selectionEnd)
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }

    private fun showFloatingWindow(text: String) {
        floatingWindowManager?.show(text)
    }

    override fun onInterrupt() {
        floatingWindowManager?.hide()
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        debounceJob?.cancel()
        floatingWindowManager?.destroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "文本朗读服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "无障碍服务正在运行，监听文本选择事件"
                enableVibration(false)
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, TextSelectionAccessibilityService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("文本朗读服务运行中")
            .setContentText("选择文本后可触发朗读功能")
            .setSmallIcon(android.R.drawable.ic_menu_speaker)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "停止服务",
                stopPendingIntent
            )
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SERVICE) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }
}
