use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub enum AudioMessage {
    ParamChange {
        plugin_id: String,
        param_id: u32,
        value: f64,
    },
    NoteOn {
        plugin_id: String,
        channel: u8,
        note: u8,
        velocity: u8,
    },
    NoteOff {
        plugin_id: String,
        channel: u8,
        note: u8,
    },
}

#[derive(Debug, Clone)]
pub enum GuiMessage {
    PluginLoaded {
        plugin_id: String,
        name: String,
    },
    ParamUpdated {
        plugin_id: String,
        param_id: u32,
        value: f64,
        normalized: f64,
    },
    GuiNeedsUpdate {
        plugin_id: String,
    },
    Error {
        plugin_id: String,
        message: String,
    },
}

pub struct MessageQueue {
    audio_to_gui: ringbuf::HeapProducer<GuiMessage>,
    gui_to_audio: ringbuf::HeapConsumer<AudioMessage>,
    has_pending: Arc<AtomicBool>,
}

impl MessageQueue {
    pub fn new(capacity: usize) -> (Self, MessageQueueHandle) {
        let (audio_prod, audio_cons) = ringbuf::HeapRb::new(capacity).split();
        let (gui_prod, gui_cons) = ringbuf::HeapRb::new(capacity).split();
        let has_pending = Arc::new(AtomicBool::new(false));

        (
            Self {
                audio_to_gui: audio_prod,
                gui_to_audio: gui_cons,
                has_pending: Arc::clone(&has_pending),
            },
            MessageQueueHandle {
                audio_to_gui: gui_cons,
                gui_to_audio: gui_prod,
                has_pending,
            },
        )
    }

    pub fn send_to_gui(&mut self, msg: GuiMessage) {
        if self.audio_to_gui.push(msg).is_ok() {
            self.has_pending.store(true, Ordering::Release);
        }
    }

    pub fn recv_from_gui(&mut self) -> Option<AudioMessage> {
        self.gui_to_audio.pop()
    }

    pub fn has_pending_messages(&self) -> bool {
        self.has_pending.load(Ordering::Acquire)
    }
}

pub struct MessageQueueHandle {
    audio_to_gui: ringbuf::HeapConsumer<GuiMessage>,
    gui_to_audio: ringbuf::HeapProducer<AudioMessage>,
    has_pending: Arc<AtomicBool>,
}

impl MessageQueueHandle {
    pub fn send_to_audio(&mut self, msg: AudioMessage) -> Result<(), AudioMessage> {
        self.gui_to_audio.push(msg)
    }

    pub fn recv_from_audio(&mut self) -> Option<GuiMessage> {
        let msg = self.audio_to_gui.pop();
        if self.audio_to_gui.is_empty() {
            self.has_pending.store(false, Ordering::Release);
        }
        msg
    }

    pub fn has_pending_messages(&self) -> bool {
        self.has_pending.load(Ordering::Acquire)
    }
}

unsafe impl Send for MessageQueue {}
unsafe impl Sync for MessageQueue {}
