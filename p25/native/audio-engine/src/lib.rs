use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

mod message_queue;
pub use message_queue::{AudioMessage, GuiMessage, MessageQueue, MessageQueueHandle};

pub struct TrackState {
    pub id: String,
    pub latency: u32,
    pub manual_offset: i32,
    pub pdc_enabled: bool,
    pub delay_line: VecDeque<f32>,
}

impl TrackState {
    pub fn new(id: String) -> Self {
        Self {
            id,
            latency: 0,
            manual_offset: 0,
            pdc_enabled: true,
            delay_line: VecDeque::with_capacity(8192),
        }
    }

    pub fn get_total_delay(&self) -> i32 {
        self.latency as i32 + self.manual_offset
    }

    pub fn push_sample(&mut self, sample: f32) {
        self.delay_line.push_back(sample);
    }

    pub fn pop_delayed_sample(&mut self, delay: u32) -> f32 {
        if delay == 0 || self.delay_line.is_empty() {
            return 0.0;
        }

        let idx = self.delay_line.len().saturating_sub(delay as usize);
        if idx > 0 {
            self.delay_line.drain(..idx);
        }

        self.delay_line.pop_front().unwrap_or(0.0)
    }

    pub fn set_latency(&mut self, latency: u32) {
        self.latency = latency;
    }

    pub fn set_manual_offset(&mut self, offset: i32) {
        self.manual_offset = offset;
    }

    pub fn set_pdc_enabled(&mut self, enabled: bool) {
        self.pdc_enabled = enabled;
    }
}

pub struct AudioEngine {
    sample_rate: u32,
    buffer_size: u32,
    is_playing: Arc<AtomicBool>,
    playhead: Arc<Mutex<f64>>,
    stream: Option<Stream>,
    message_queue: Option<MessageQueue>,
    vst3_host: Option<vst3_host::Vst3Host>,
    tracks: Arc<Mutex<Vec<TrackState>>>,
    max_latency: Arc<Mutex<u32>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            sample_rate: 44100,
            buffer_size: 128,
            is_playing: Arc::new(AtomicBool::new(false)),
            playhead: Arc::new(Mutex::new(0.0)),
            stream: None,
            message_queue: None,
            vst3_host: None,
            tracks: Arc::new(Mutex::new(Vec::new())),
            max_latency: Arc::new(Mutex::new(0)),
        }
    }

    pub fn add_track(&mut self, track_id: String) {
        let mut tracks = self.tracks.lock();
        tracks.push(TrackState::new(track_id));
        self.update_max_latency();
    }

    pub fn remove_track(&mut self, track_id: &str) {
        let mut tracks = self.tracks.lock();
        tracks.retain(|t| t.id != track_id);
        self.update_max_latency();
    }

    pub fn set_track_latency(&mut self, track_id: &str, latency: u32) {
        let mut tracks = self.tracks.lock();
        if let Some(track) = tracks.iter_mut().find(|t| t.id == track_id) {
            track.set_latency(latency);
            drop(tracks);
            self.update_max_latency();
        }
    }

    pub fn set_track_manual_offset(&mut self, track_id: &str, offset: i32) {
        let mut tracks = self.tracks.lock();
        if let Some(track) = tracks.iter_mut().find(|t| t.id == track_id) {
            track.set_manual_offset(offset);
            drop(tracks);
            self.update_max_latency();
        }
    }

    pub fn set_track_pdc_enabled(&mut self, track_id: &str, enabled: bool) {
        let mut tracks = self.tracks.lock();
        if let Some(track) = tracks.iter_mut().find(|t| t.id == track_id) {
            track.set_pdc_enabled(enabled);
        }
    }

    fn update_max_latency(&self) {
        let tracks = self.tracks.lock();
        let max = tracks
            .iter()
            .filter(|t| t.pdc_enabled)
            .map(|t| t.get_total_delay().max(0) as u32)
            .max()
            .unwrap_or(0);
        *self.max_latency.lock() = max;
    }

    pub fn get_track_compensation(&self, track_id: &str) -> u32 {
        let tracks = self.tracks.lock();
        let max_latency = *self.max_latency.lock();

        if let Some(track) = tracks.iter().find(|t| t.id == track_id) {
            if !track.pdc_enabled {
                return 0;
            }
            let total_delay = track.get_total_delay().max(0) as u32;
            return max_latency.saturating_sub(total_delay);
        }
        0
    }

    pub fn with_message_queue(mut self, queue: MessageQueue) -> Self {
        self.message_queue = Some(queue);
        self
    }

    pub fn with_vst3_host(mut self, host: vst3_host::Vst3Host) -> Self {
        self.vst3_host = Some(host);
        self
    }

    pub fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("No output device")?;

        let config = StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(self.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.buffer_size),
        };

        let is_playing = Arc::clone(&self.is_playing);
        let playhead = Arc::clone(&self.playhead);
        let tracks = Arc::clone(&self.tracks);
        let max_latency = Arc::clone(&self.max_latency);

        let err_fn = |err| eprintln!("Audio stream error: {}", err);

        let stream = device.build_output_stream(
            &config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                if !is_playing.load(Ordering::Acquire) {
                    for sample in data.iter_mut() {
                        *sample = 0.0;
                    }
                    return;
                }

                let mut ph = playhead.lock();
                let mut tracks = tracks.lock();
                let current_max_latency = *max_latency.lock();

                for frame in data.chunks_mut(2) {
                    let t = *ph;
                    
                    let mut mixed_left = 0.0;
                    let mut mixed_right = 0.0;
                    
                    for track in tracks.iter_mut() {
                        let track_sample = (t * 440.0 * 2.0 * std::f64::consts::PI).sin() as f32 * 0.15;
                        
                        if track.pdc_enabled {
                            let compensation = current_max_latency.saturating_sub(
                                track.get_total_delay().max(0) as u32
                            );
                            track.push_sample(track_sample);
                            let delayed_sample = track.pop_delayed_sample(compensation);
                            mixed_left += delayed_sample;
                            mixed_right += delayed_sample;
                        } else {
                            mixed_left += track_sample;
                            mixed_right += track_sample;
                        }
                    }
                    
                    if tracks.is_empty() {
                        mixed_left = (t * 440.0 * 2.0 * std::f64::consts::PI).sin() as f32 * 0.3;
                        mixed_right = mixed_left;
                    }

                    frame[0] = mixed_left;
                    frame[1] = mixed_right;
                    *ph += 1.0 / 44100.0;
                }
            },
            err_fn,
            None,
        )?;

        stream.play()?;
        self.stream = Some(stream);
        self.is_playing.store(true, Ordering::Release);

        Ok(())
    }

    pub fn stop(&mut self) {
        self.is_playing.store(false, Ordering::Release);
        self.stream = None;
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Acquire)
    }

    pub fn get_playhead(&self) -> f64 {
        *self.playhead.lock()
    }

    pub fn set_playhead(&self, position: f64) {
        *self.playhead.lock() = position;
    }

    pub fn process_parameter_change(&mut self, plugin_id: &str, param_id: u32, value: f64) {
        if let Some(host) = &mut self.vst3_host {
            let _ = host.set_parameter_rt(plugin_id, param_id, value);
        }
    }

    pub fn get_parameter_value(&self, plugin_id: &str, param_id: u32) -> Option<f64> {
        self.vst3_host
            .as_ref()
            .and_then(|h| h.get_parameter_rt(plugin_id, param_id))
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new()
    }
}
