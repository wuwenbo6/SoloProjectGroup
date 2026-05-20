package com.textreader.accessibility

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import com.textreader.tts.TtsManager

class FloatingWindowManager(private val context: Context) {

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var ttsManager: TtsManager? = null
    private var currentText: String = ""

    init {
        windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        ttsManager = TtsManager(context)
        ttsManager?.initialize()
    }

    fun show(text: String) {
        currentText = text
        if (floatingView == null) {
            createFloatingView()
        }
        floatingView?.visibility = View.VISIBLE
    }

    fun hide() {
        floatingView?.visibility = View.GONE
        ttsManager?.stop()
    }

    private fun createFloatingView() {
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        params.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        params.y = 100

        val playButton = Button(context).apply {
            text = "播放"
            setOnClickListener { playText() }
        }

        val pauseButton = Button(context).apply {
            text = "暂停"
            setOnClickListener { pauseText() }
        }

        val resumeButton = Button(context).apply {
            text = "继续"
            setOnClickListener { resumeText() }
        }

        val stopButton = Button(context).apply {
            text = "停止"
            setOnClickListener { stopText() }
        }

        val closeButton = Button(context).apply {
            text = "关闭"
            setOnClickListener { hide() }
        }

        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(16, 16, 16, 16)
            setBackgroundColor(0xFFE0E0E0.toInt())
            addView(playButton)
            addView(pauseButton)
            addView(resumeButton)
            addView(stopButton)
            addView(closeButton)
        }

        floatingView = layout
        windowManager?.addView(floatingView, params)
    }

    private fun playText() {
        ttsManager?.speak(currentText)
    }

    private fun pauseText() {
        ttsManager?.pause()
    }

    private fun resumeText() {
        ttsManager?.resume()
    }

    private fun stopText() {
        ttsManager?.stop()
    }

    fun destroy() {
        ttsManager?.shutdown()
        floatingView?.let {
            windowManager?.removeView(it)
        }
        floatingView = null
    }
}
