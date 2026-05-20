class MidiConverter:
    NOTE_BASE = 60
    
    NOTE_MAP = {
        1: 0,
        2: 2,
        3: 4,
        4: 5,
        5: 7,
        6: 9,
        7: 11
    }
    
    def __init__(self, tempo=120, time_signature=(4, 4)):
        self.tempo = tempo
        self.time_signature = time_signature
        self.quarter_note_duration = 60.0 / tempo
    
    def note_to_midi(self, note_value, octave=0):
        if note_value not in self.NOTE_MAP:
            return None
        
        semitone = self.NOTE_MAP[note_value]
        midi_note = self.NOTE_BASE + (octave * 12) + semitone
        
        return max(0, min(127, midi_note))
    
    def duration_to_ticks(self, duration, resolution=480):
        quarter_notes = duration * 4 / self.time_signature[0]
        return int(quarter_notes * resolution)
    
    def notes_to_midi_events(self, notes, channel=0, velocity=64):
        events = []
        current_time = 0
        
        for note in notes:
            midi_note = self.note_to_midi(note.get('value', 1), note.get('octave', 0))
            
            if midi_note is None:
                continue
            
            duration = note.get('duration', 1.0)
            duration_seconds = duration * self.quarter_note_duration
            
            events.append({
                'type': 'note_on',
                'note': midi_note,
                'velocity': velocity,
                'channel': channel,
                'time': current_time,
                'time_seconds': current_time
            })
            
            current_time += duration_seconds
            
            events.append({
                'type': 'note_off',
                'note': midi_note,
                'velocity': 0,
                'channel': channel,
                'time': current_time,
                'time_seconds': current_time
            })
        
        return events
    
    def generate_midi_file_data(self, notes, filename=None):
        try:
            import mido
            from mido import Message, MidiFile, MidiTrack
        except ImportError:
            return None
        
        mid = MidiFile()
        track = MidiTrack()
        mid.tracks.append(track)
        
        track.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.tempo)))
        track.append(mido.MetaMessage('time_signature', 
                                       numerator=self.time_signature[0],
                                       denominator=self.time_signature[1]))
        
        events = self.notes_to_midi_events(notes)
        events.sort(key=lambda e: e['time'])
        
        last_time = 0
        for event in events:
            delta_time = int((event['time'] - last_time) * 480)
            
            if event['type'] == 'note_on':
                track.append(Message('note_on', note=event['note'], 
                                     velocity=event['velocity'], time=delta_time))
            else:
                track.append(Message('note_off', note=event['note'], 
                                     velocity=0, time=delta_time))
            
            last_time = event['time']
        
        if filename:
            mid.save(filename)
        
        return mid
    
    def get_web_midi_events(self, notes):
        events = []
        current_time = 0
        
        for note in notes:
            midi_note = self.note_to_midi(note.get('value', 1), note.get('octave', 0))
            
            if midi_note is None:
                continue
            
            duration = note.get('duration', 1.0)
            duration_seconds = duration * self.quarter_note_duration
            
            events.append({
                'type': 'noteOn',
                'noteNumber': midi_note,
                'velocity': 64,
                'time': current_time
            })
            
            current_time += duration_seconds
            
            events.append({
                'type': 'noteOff',
                'noteNumber': midi_note,
                'velocity': 0,
                'time': current_time
            })
        
        return {
            'events': events,
            'duration': current_time,
            'tempo': self.tempo
        }
