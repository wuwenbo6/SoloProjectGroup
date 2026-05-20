class ChordAccompaniment:
    MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
    MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]
    
    COMMON_CHORDS = {
        'C':  {'notes': [60, 64, 67], 'name': 'C', 'function': 'I'},
        'Dm': {'notes': [62, 65, 69], 'name': 'Dm', 'function': 'ii'},
        'Em': {'notes': [64, 67, 71], 'name': 'Em', 'function': 'iii'},
        'F':  {'notes': [65, 69, 72], 'name': 'F', 'function': 'IV'},
        'G':  {'notes': [67, 71, 74], 'name': 'G', 'function': 'V'},
        'Am': {'notes': [69, 72, 76], 'name': 'Am', 'function': 'vi'},
        'Bdim': {'notes': [71, 74, 77], 'name': 'Bdim', 'function': 'vii°'},
        'C7': {'notes': [60, 64, 67, 70], 'name': 'C7', 'function': 'I7'},
        'G7': {'notes': [67, 71, 74, 77], 'name': 'G7', 'function': 'V7'},
        'F7': {'notes': [65, 69, 72, 75], 'name': 'F7', 'function': 'IV7'},
        'Am7': {'notes': [69, 72, 76, 79], 'name': 'Am7', 'function': 'vi7'},
        'Dm7': {'notes': [62, 65, 69, 72], 'name': 'Dm7', 'function': 'ii7'},
    }
    
    CHORD_PROGRESSIONS = [
        ['C', 'F', 'G', 'C'],
        ['C', 'Am', 'F', 'G'],
        ['C', 'G', 'Am', 'F'],
        ['Am', 'F', 'C', 'G'],
        ['C', 'F', 'C', 'G'],
        ['C', 'Dm', 'G', 'C'],
        ['Am', 'Dm', 'G', 'C'],
    ]
    
    def __init__(self, key='C', style='piano'):
        self.key = key
        self.style = style
        self.key_offset = self._get_key_offset(key)
    
    def _get_key_offset(self, key):
        note_map = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
        if key.endswith('#'):
            return note_map.get(key[0], 0) + 1
        elif key.endswith('b'):
            return note_map.get(key[0], 0) - 1
        return note_map.get(key, 0)
    
    def note_to_scale_degree(self, midi_note):
        """将MIDI音符转换为音阶度数"""
        note_in_octave = (midi_note - self.key_offset) % 12
        return note_in_octave
    
    def find_best_chord(self, notes, current_chord_idx=0):
        """为一组音符找到最匹配的和弦"""
        if not notes:
            return self.COMMON_CHORDS['C']
        
        note_values = [n % 12 for n in notes]
        
        best_chord = None
        best_score = -1
        
        for chord_name, chord in self.COMMON_CHORDS.items():
            chord_notes = [(n - 60 + self.key_offset) % 12 for n in chord['notes']]
            
            score = 0
            for nv in note_values:
                if nv in chord_notes:
                    score += 2
                elif (nv + 7) % 12 in chord_notes:
                    score += 1
            
            root_in_notes = chord_notes[0] in note_values
            if root_in_notes:
                score += 3
            
            if score > best_score:
                best_score = score
                best_chord = chord
        
        if best_chord is None:
            prog = self.CHORD_PROGRESSIONS[0]
            best_chord = self.COMMON_CHORDS[prog[current_chord_idx % len(prog)]]
        
        return best_chord
    
    def generate_accompaniment(self, melody_notes, beats_per_measure=4, tempo=120):
        """为旋律生成伴奏"""
        if len(melody_notes) == 0:
            return []
        
        quarter_note = 60.0 / tempo
        
        measures = []
        current_measure = []
        current_duration = 0
        
        for note in melody_notes:
            duration = note.get('duration', 1.0) * quarter_note
            current_measure.append(note)
            current_duration += duration
            
            if current_duration >= beats_per_measure * quarter_note * 0.9:
                measures.append(current_measure)
                current_measure = []
                current_duration = 0
        
        if current_measure:
            measures.append(current_measure)
        
        accompaniment = []
        current_time = 0
        
        for measure_idx, measure in enumerate(measures):
            melody_midis = []
            for note in measure:
                midi_val = self._note_to_midi(note)
                if midi_val:
                    melody_midis.append(midi_val)
            
            chord = self.find_best_chord(melody_midis, measure_idx)
            
            measure_duration = beats_per_measure * quarter_note
            chord_events = self._generate_chord_pattern(
                chord, current_time, measure_duration, measure_idx
            )
            accompaniment.extend(chord_events)
            
            current_time += measure_duration
        
        return accompaniment
    
    def _note_to_midi(self, note):
        value = note.get('value', 1)
        octave = note.get('octave', 0)
        
        note_map = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11}
        if value not in note_map:
            return None
        
        base_note = 60 + note_map[value] + (octave * 12) + self.key_offset
        return base_note
    
    def _generate_chord_pattern(self, chord, start_time, duration, measure_idx):
        """生成和弦伴奏音型"""
        events = []
        chord_notes = chord['notes']
        
        if self.style == 'piano':
            bass_note = chord_notes[0] - 12
            
            events.append({
                'type': 'noteOn',
                'noteNumber': bass_note,
                'velocity': 60,
                'time': start_time,
                'is_accompaniment': True,
                'chord': chord['name']
            })
            events.append({
                'type': 'noteOff',
                'noteNumber': bass_note,
                'velocity': 0,
                'time': start_time + duration,
                'is_accompaniment': True
            })
            
            beat_duration = duration / 4
            for beat in range(4):
                if beat % 2 == 0:
                    for i, cn in enumerate(chord_notes[1:]):
                        events.append({
                            'type': 'noteOn',
                            'noteNumber': cn,
                            'velocity': 50 - i * 5,
                            'time': start_time + beat * beat_duration,
                            'is_accompaniment': True
                        })
                        events.append({
                            'type': 'noteOff',
                            'noteNumber': cn,
                            'velocity': 0,
                            'time': start_time + (beat + 0.8) * beat_duration,
                            'is_accompaniment': True
                        })
        
        elif self.style == 'arpeggio':
            note_duration = duration / 8
            for i in range(8):
                note_idx = i % len(chord_notes)
                cn = chord_notes[note_idx] + (i // len(chord_notes)) * 12
                events.append({
                    'type': 'noteOn',
                    'noteNumber': cn,
                    'velocity': 55,
                    'time': start_time + i * note_duration,
                    'is_accompaniment': True,
                    'chord': chord['name']
                })
                events.append({
                    'type': 'noteOff',
                    'noteNumber': cn,
                    'velocity': 0,
                    'time': start_time + (i + 0.9) * note_duration,
                    'is_accompaniment': True
                })
        
        else:
            for cn in chord_notes:
                events.append({
                    'type': 'noteOn',
                    'noteNumber': cn,
                    'velocity': 45,
                    'time': start_time,
                    'is_accompaniment': True,
                    'chord': chord['name']
                })
                events.append({
                    'type': 'noteOff',
                    'noteNumber': cn,
                    'velocity': 0,
                    'time': start_time + duration,
                    'is_accompaniment': True
                })
        
        return events
    
    def get_chord_symbols(self, melody_notes, beats_per_measure=4, tempo=120):
        """获取和弦标记序列"""
        if len(melody_notes) == 0:
            return []
        
        quarter_note = 60.0 / tempo
        
        measures = []
        current_measure = []
        current_duration = 0
        
        for note in melody_notes:
            duration = note.get('duration', 1.0) * quarter_note
            current_measure.append(note)
            current_duration += duration
            
            if current_duration >= beats_per_measure * quarter_note * 0.9:
                measures.append(current_measure)
                current_measure = []
                current_duration = 0
        
        if current_measure:
            measures.append(current_measure)
        
        chords = []
        current_time = 0
        
        for measure_idx, measure in enumerate(measures):
            melody_midis = []
            for note in measure:
                midi_val = self._note_to_midi(note)
                if midi_val:
                    melody_midis.append(midi_val)
            
            chord = self.find_best_chord(melody_midis, measure_idx)
            measure_duration = beats_per_measure * quarter_note
            
            chords.append({
                'name': chord['name'],
                'function': chord['function'],
                'time': current_time,
                'duration': measure_duration,
                'measure': measure_idx + 1
            })
            
            current_time += measure_duration
        
        return chords
