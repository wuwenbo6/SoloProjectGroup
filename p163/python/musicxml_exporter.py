import xml.etree.ElementTree as ET
from xml.dom import minidom

class MusicXMLExporter:
    NOTE_MAP = {
        1: 'C',
        2: 'D',
        3: 'E',
        4: 'F',
        5: 'G',
        6: 'A',
        7: 'B'
    }
    
    DURATION_MAP = {
        0.25: '16th',
        0.5: 'eighth',
        1.0: 'quarter',
        1.5: 'quarter',
        2.0: 'half',
        3.0: 'half',
        4.0: 'whole'
    }
    
    def __init__(self, title='简谱导出', composer='', key='C', time_signature=(4, 4), tempo=120):
        self.title = title
        self.composer = composer
        self.key = key
        self.time_signature = time_signature
        self.tempo = tempo
        self.divisions = 4
    
    def _get_pitch(self, value, octave=0):
        base_octave = 4
        actual_octave = base_octave + octave
        
        note_name = self.NOTE_MAP.get(value, 'C')
        alter = 0
        
        if self.key in ['G', 'D', 'A', 'E']:
            sharps = ['G', 'D', 'A', 'E']
            if note_name in ['F', 'C', 'G', 'D']:
                sharp_count = sharps.index(self.key) + 1
                sharp_notes = ['F', 'C', 'G', 'D', 'A', 'E', 'B'][:sharp_count]
                if note_name in sharp_notes:
                    alter = 1
        
        return note_name, alter, actual_octave
    
    def _get_note_type(self, duration):
        for d in sorted(self.DURATION_MAP.keys(), reverse=True):
            if duration >= d * 0.9:
                return self.DURATION_MAP[d]
        return 'quarter'
    
    def _get_duration_divisions(self, duration):
        return int(duration * self.divisions)
    
    def export_to_string(self, notes, chord_symbols=None):
        score_partwise = ET.Element('score-partwise')
        score_partwise.set('version', '3.1')
        
        work = ET.SubElement(score_partwise, 'work')
        work_title = ET.SubElement(work, 'work-title')
        work_title.text = self.title
        
        identification = ET.SubElement(score_partwise, 'identification')
        if self.composer:
            creator = ET.SubElement(identification, 'creator')
            creator.set('type', 'composer')
            creator.text = self.composer
        
        part_list = ET.SubElement(score_partwise, 'part-list')
        
        score_part1 = ET.SubElement(part_list, 'score-part')
        score_part1.set('id', 'P1')
        part_name1 = ET.SubElement(score_part1, 'part-name')
        part_name1.text = '旋律'
        
        score_part2 = ET.SubElement(part_list, 'score-part')
        score_part2.set('id', 'P2')
        part_name2 = ET.SubElement(score_part2, 'part-name')
        part_name2.text = '伴奏'
        
        part1 = ET.SubElement(score_partwise, 'part')
        part1.set('id', 'P1')
        self._add_measures(part1, notes, chord_symbols, is_melody=True)
        
        part2 = ET.SubElement(score_partwise, 'part')
        part2.set('id', 'P2')
        self._add_measures(part2, notes, chord_symbols, is_melody=False)
        
        xml_str = ET.tostring(score_partwise, encoding='unicode')
        pretty_xml = minidom.parseString(xml_str).toprettyxml(indent='  ')
        
        return pretty_xml
    
    def _add_measures(self, parent, notes, chord_symbols, is_melody=True):
        beats, beat_type = self.time_signature
        measure_duration = beats * self.divisions
        
        current_time = 0
        measure_idx = 1
        
        measure_notes = []
        measure_duration_count = 0
        
        for note in notes:
            value = note.get('value', 1)
            octave = note.get('octave', 0)
            duration = note.get('duration', 1.0)
            duration_divs = self._get_duration_divisions(duration)
            
            if is_melody:
                measure_notes.append((value, octave, duration_divs, duration))
                measure_duration_count += duration_divs
            else:
                measure_duration_count += duration_divs
            
            if measure_duration_count >= measure_duration * 0.9:
                self._add_measure(parent, measure_idx, measure_notes, chord_symbols, is_melody)
                measure_idx += 1
                measure_notes = []
                measure_duration_count = 0
        
        if measure_notes or not is_melody:
            self._add_measure(parent, measure_idx, measure_notes, chord_symbols, is_melody)
    
    def _add_measure(self, parent, number, notes, chord_symbols, is_melody):
        measure = ET.SubElement(parent, 'measure')
        measure.set('number', str(number))
        
        if number == 1:
            attributes = ET.SubElement(measure, 'attributes')
            
            divisions = ET.SubElement(attributes, 'divisions')
            divisions.text = str(self.divisions)
            
            key = ET.SubElement(attributes, 'key')
            fifths = ET.SubElement(key, 'fifths')
            key_fifths = {'C': 0, 'G': 1, 'D': 2, 'F': -1, 'Bb': -2}
            fifths.text = str(key_fifths.get(self.key, 0))
            
            time = ET.SubElement(attributes, 'time')
            beats = ET.SubElement(time, 'beats')
            beats.text = str(self.time_signature[0])
            beat_type = ET.SubElement(time, 'beat-type')
            beat_type.text = str(self.time_signature[1])
            
            clef = ET.SubElement(attributes, 'clef')
            clef_sign = ET.SubElement(clef, 'sign')
            clef_sign.text = 'G' if is_melody else 'F'
            clef_line = ET.SubElement(clef, 'line')
            clef_line.text = '2' if is_melody else '4'
            
            sound = ET.SubElement(measure, 'sound')
            sound.set('tempo', str(self.tempo))
        
        if chord_symbols:
            for cs in chord_symbols:
                if cs['measure'] == number:
                    harmony = ET.SubElement(measure, 'harmony')
                    root = ET.SubElement(harmony, 'root')
                    root_step = ET.SubElement(root, 'root-step')
                    root_step.text = cs['name'][0]
                    if len(cs['name']) > 1 and cs['name'][1] in ['#', 'b']:
                        root_alter = ET.SubElement(root, 'root-alter')
                        root_alter.text = '1' if cs['name'][1] == '#' else '-1'
                    
                    kind = ET.SubElement(harmony, 'kind')
                    kind.text = 'minor' if 'm' in cs['name'] else 'major'
        
        if is_melody:
            for value, octave, duration, orig_duration in notes:
                note_elem = ET.SubElement(measure, 'note')
                
                pitch = ET.SubElement(note_elem, 'pitch')
                note_name, alter, actual_octave = self._get_pitch(value, octave)
                step = ET.SubElement(pitch, 'step')
                step.text = note_name
                
                if alter != 0:
                    alter_elem = ET.SubElement(pitch, 'alter')
                    alter_elem.text = str(alter)
                
                octave_elem = ET.SubElement(pitch, 'octave')
                octave_elem.text = str(actual_octave)
                
                duration_elem = ET.SubElement(note_elem, 'duration')
                duration_elem.text = str(duration)
                
                note_type = ET.SubElement(note_elem, 'type')
                note_type.text = self._get_note_type(orig_duration)
                
                if orig_duration > 1.0 and abs(orig_duration - 1.5) < 0.1:
                    dot = ET.SubElement(note_elem, 'dot')
        else:
            if chord_symbols:
                current_chord = None
                for cs in chord_symbols:
                    if cs['measure'] == number:
                        current_chord = cs
                        break
                
                if current_chord:
                    chord_notes = self._get_chord_notes(current_chord['name'])
                    for i, cn in enumerate(chord_notes):
                        note_elem = ET.SubElement(measure, 'note')
                        if i > 0:
                            chord_elem = ET.SubElement(note_elem, 'chord')
                        
                        pitch = ET.SubElement(note_elem, 'pitch')
                        step = ET.SubElement(pitch, 'step')
                        step.text = cn[0]
                        
                        octave_elem = ET.SubElement(pitch, 'octave')
                        octave_elem.text = str(cn[1])
                        
                        duration_elem = ET.SubElement(note_elem, 'duration')
                        duration_elem.text = str(self.time_signature[0] * self.divisions)
                        
                        note_type = ET.SubElement(note_elem, 'type')
                        note_type.text = 'whole' if self.time_signature[0] == 4 else 'half'
    
    def _get_chord_notes(self, chord_name):
        base_map = {'C': ('C', 4), 'D': ('D', 4), 'E': ('E', 4), 'F': ('F', 4),
                    'G': ('G', 4), 'A': ('A', 3), 'B': ('B', 3)}
        
        root = chord_name[0]
        base_note = base_map.get(root, ('C', 4))
        
        is_minor = 'm' in chord_name
        
        intervals = [0, 3, 7] if is_minor else [0, 4, 7]
        
        notes = []
        for interval in intervals:
            note_num = ord(base_note[0]) - ord('C')
            new_num = (note_num + interval) % 7
            new_note = chr(ord('C') + new_num)
            octave_adjust = (note_num + interval) // 7
            notes.append((new_note, base_note[1] + octave_adjust))
        
        return notes
    
    def export_to_file(self, filepath, notes, chord_symbols=None):
        xml_content = self.export_to_string(notes, chord_symbols)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(xml_content)
        return filepath
