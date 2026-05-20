import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

const GLOBAL_TYPES = `
declare interface MidiMessage {
  type: 'noteon' | 'noteoff' | 'cc' | 'pitch' | 'program' | 'sysex'
  note?: number
  velocity?: number
  controller?: number
  value?: number
  channel: number
  _type?: string
}

declare function sendMidi(message: MidiMessage): void
declare function log(...args: any[]): void
declare const state: Record<string, any>
declare const message: MidiMessage
`

const DEFAULT_SCRIPT = `// MIDI Message Handler
// Available variables:
// - message: { type: 'noteon' | 'noteoff' | 'cc' | 'pitch', ... }
// - sendMidi(message): function to send MIDI messages
// - log(...args): function to log messages
// - state: persistent object to store data

log('Received:', message.type);

// Example: Transpose notes by 2 semitones
if (message.type === 'noteon' || message.type === 'noteoff') {
  sendMidi({
    ...message,
    note: message.note + 2
  });
}

// Example: CC to Note conversion
if (message.type === 'cc' && message.controller === 1) {
  if (message.value > 64) {
    sendMidi({
      type: 'noteon',
      note: 60,
      velocity: 100,
      channel: message.channel
    });
  }
}`

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        1375,
        7027,
        2304,
        2554,
        2568,
        6133,
        18002,
        18003
      ]
    })

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      allowJs: true,
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      strictFunctionTypes: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      allowSyntheticDefaultImports: true,
      lib: ['es2020']
    })

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      GLOBAL_TYPES,
      'ts:filename/globals.d.ts'
    )

    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const suggestions: monaco.languages.CompletionItem[] = [
          {
            label: 'sendMidi',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'sendMidi(${1:message})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Send a MIDI message',
            detail: 'function'
          },
          {
            label: 'log',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'log(${1:...args})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Log messages to console',
            detail: 'function'
          },
          {
            label: 'state',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: 'state',
            documentation: 'Persistent state object',
            detail: 'Record<string, any>'
          },
          {
            label: 'message',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: 'message',
            documentation: 'Current MIDI message',
            detail: 'MidiMessage'
          },
          {
            label: 'noteon',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'noteon',
            documentation: 'Note On message type'
          },
          {
            label: 'noteoff',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'noteoff',
            documentation: 'Note Off message type'
          },
          {
            label: 'cc',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'cc',
            documentation: 'Control Change message type'
          },
          {
            label: 'pitch',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'pitch',
            documentation: 'Pitch Bend message type'
          }
        ]
        return { suggestions }
      }
    })

    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      value: value || DEFAULT_SCRIPT,
      language: 'javascript',
      theme: 'vs-dark',
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      scrollbar: {
        useShadows: false,
        verticalSliderSize: 10,
        horizontalSliderSize: 10
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showFiles: false
      }
    })

    editorRef.current = editor

    editor.onDidChangeModelContent(() => {
      onChange(editor.getValue())
    })

    const disposable = monaco.editor.onDidCreateModel((model) => {
      if (model.getModeId() === 'javascript') {
        monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
      }
    })

    return () => {
      disposable.dispose()
      editor.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value || DEFAULT_SCRIPT)
    }
  }, [value])

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }} 
    />
  )
}
