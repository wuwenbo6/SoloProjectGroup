import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  Hover,
  Definition,
  Location,
  Range,
  Position
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDSL, Token } from './parser';
import { validateDSL, ValidationError } from './validator';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false
      }
    }
  };
  return result;
});

documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  try {
    const text = textDocument.getText();
    const { ast, tokens } = parseDSL(text);
    const errors = validateDSL(ast);

    const diagnostics: Diagnostic[] = errors.map(error => ({
      severity: error.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
      range: {
        start: { line: (error.line || 1) - 1, character: error.column || 0 },
        end: { line: (error.line || 1) - 1, character: (error.column || 0) + 10 }
      },
      message: error.message,
      source: 'fsm-lsp'
    }));

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (e: any) {
    connection.window.showErrorMessage(`Validation error: ${e.message}`);
  }
}

connection.onHover(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  try {
    const text = document.getText();
    const { ast, tokens } = parseDSL(text);

    const hoveredToken = findTokenAtPosition(tokens, params.position);
    if (!hoveredToken) return null;

    const hoverContent = getHoverContent(ast, hoveredToken);
    if (hoverContent) {
      return { contents: hoverContent };
    }
  } catch (e) {
    return null;
  }

  return null;
});

connection.onDefinition(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  try {
    const text = document.getText();
    const { ast, tokens } = parseDSL(text);

    const hoveredToken = findTokenAtPosition(tokens, params.position);
    if (!hoveredToken) return null;

    const definition = findDefinition(ast, tokens, hoveredToken, document.uri);
    return definition;
  } catch (e) {
    return null;
  }
});

function findTokenAtPosition(tokens: Token[], position: Position): Token | null {
  const line = position.line + 1;
  const character = position.character + 1;

  for (const token of tokens) {
    if (token.line === line && character >= token.column && character <= token.column + token.value.length) {
      return token;
    }
  }
  return null;
}

function getHoverContent(ast: any, token: Token): string | null {
  if (token.type !== 'IDENTIFIER') return null;

  const state = ast.states.find((s: any) => s.name === token.value);
  if (state) {
    return `**State**: ${state.name}\n\nTransitions: ${state.transitions.length}`;
  }

  const action = ast.actions.find((a: any) => a.name === token.value);
  if (action) {
    return `**Action**: ${action.name}`;
  }

  return null;
}

function findDefinition(ast: any, tokens: Token[], token: Token, uri: string): Definition | null {
  if (token.type !== 'IDENTIFIER') return null;

  const definitionToken = tokens.find(t => 
    t.type === 'IDENTIFIER' && 
    t.value === token.value &&
    tokens[tokens.indexOf(t) - 1]?.value === 'state'
  );

  if (!definitionToken) return null;

  return Location.create(uri, {
    start: { line: definitionToken.line - 1, character: definitionToken.column - 1 },
    end: { line: definitionToken.line - 1, character: definitionToken.column - 1 + definitionToken.value.length }
  });
}

documents.listen(connection);
connection.listen();

console.log('FSM Language Server started');
