import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from note_detector import NoteDetector
from midi_converter import MidiConverter
from accompaniment import ChordAccompaniment
from musicxml_exporter import MusicXMLExporter

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'status': 'ready', 'message': 'Python backend ready'}))
        return
    
    command = sys.argv[1]
    
    if command == 'process':
        try:
            if len(sys.argv) < 3:
                print(json.dumps({'error': 'No image paths provided'}))
                return
            
            params = json.loads(sys.argv[2])
            image_paths = params.get('images', []) if isinstance(params, dict) else params
            key = params.get('key', 'C') if isinstance(params, dict) else 'C'
            style = params.get('style', 'piano') if isinstance(params, dict) else 'piano'
            tempo = params.get('tempo', 120) if isinstance(params, dict) else 120
            with_accompaniment = params.get('withAccompaniment', True) if isinstance(params, dict) else True
            
            detector = NoteDetector()
            
            if len(image_paths) == 1:
                result = detector.process_image(image_paths[0])
            else:
                result = detector.process_multiple_images(image_paths)
            
            notes = result.get('notes', [])
            
            converter = MidiConverter(tempo=tempo)
            midi_data = converter.get_web_midi_events(notes)
            
            chord_symbols = []
            accompaniment_events = []
            if with_accompaniment:
                accompanist = ChordAccompaniment(key=key, style=style)
                chord_symbols = accompanist.get_chord_symbols(notes, tempo=tempo)
                accompaniment_events = accompanist.generate_accompaniment(notes, tempo=tempo)
            
            all_midi_events = midi_data['events'] + accompaniment_events
            all_midi_events.sort(key=lambda e: e['time'])
            
            response = {
                'success': True,
                'notes': notes,
                'midiEvents': all_midi_events,
                'duration': midi_data['duration'],
                'tempo': midi_data['tempo'],
                'imageCount': result.get('image_count', len(image_paths)),
                'chordSymbols': chord_symbols,
                'accompanimentEvents': accompaniment_events
            }
            
            print(json.dumps(response))
            
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': str(e)
            }))
    
    elif command == 'export_musicxml':
        try:
            params = json.loads(sys.argv[2])
            notes = params.get('notes', [])
            chord_symbols = params.get('chordSymbols', [])
            output_path = params.get('outputPath', 'output.musicxml')
            title = params.get('title', '简谱导出')
            key = params.get('key', 'C')
            tempo = params.get('tempo', 120)
            time_sig = params.get('timeSignature', [4, 4])
            
            exporter = MusicXMLExporter(
                title=title, 
                key=key, 
                tempo=tempo,
                time_signature=tuple(time_sig)
            )
            
            exporter.export_to_file(output_path, notes, chord_symbols)
            
            print(json.dumps({
                'success': True,
                'outputPath': output_path
            }))
            
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': str(e)
            }))
    
    elif command == 'generate_chords':
        try:
            params = json.loads(sys.argv[2])
            notes = params.get('notes', [])
            key = params.get('key', 'C')
            style = params.get('style', 'piano')
            tempo = params.get('tempo', 120)
            
            accompanist = ChordAccompaniment(key=key, style=style)
            chord_symbols = accompanist.get_chord_symbols(notes, tempo=tempo)
            accompaniment_events = accompanist.generate_accompaniment(notes, tempo=tempo)
            
            print(json.dumps({
                'success': True,
                'chordSymbols': chord_symbols,
                'accompanimentEvents': accompaniment_events
            }))
            
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': str(e)
            }))
    
    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))

if __name__ == '__main__':
    main()
