import { StateMachine, State, Transition, Action } from '../../shared/types';

export class Token {
  type: string;
  value: string;
  line: number;
  column: number;

  constructor(type: string, value: string, line: number, column: number) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }
}

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  private keywords = ['machine', 'state', 'action', 'initial', 'on', 'Enter', 'Exit', 'print'];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      
      if (/\s/.test(char)) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.pos++;
        continue;
      }

      if (char === '#') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      const symbolTokens = this.readSymbol();
      if (symbolTokens) {
        tokens.push(...symbolTokens);
        continue;
      }

      this.pos++;
      this.column++;
    }
    tokens.push(new Token('EOF', '', this.line, this.column));
    return tokens;
  }

  private readIdentifier(): Token {
    const start = this.pos;
    const startColumn = this.column;
    while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
      this.pos++;
      this.column++;
    }
    const value = this.input.slice(start, this.pos);
    const type = this.keywords.includes(value) ? 'KEYWORD' : 'IDENTIFIER';
    return new Token(type, value, this.line, startColumn);
  }

  private readString(quote: string): Token {
    const startColumn = this.column;
    this.pos++;
    this.column++;
    const start = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.column = 0;
      }
      this.pos++;
      this.column++;
    }
    const value = this.input.slice(start, this.pos);
    this.pos++;
    this.column++;
    return new Token('STRING', value, this.line, startColumn);
  }

  private readNumber(): Token {
    const start = this.pos;
    const startColumn = this.column;
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      this.pos++;
      this.column++;
    }
    return new Token('NUMBER', this.input.slice(start, this.pos), this.line, startColumn);
  }

  private readSymbol(): Token[] | null {
    const char = this.input[this.pos];
    const startColumn = this.column;
    const twoChar = this.input.slice(this.pos, this.pos + 2);
    
    if (twoChar === '->') {
      this.pos += 2;
      this.column += 2;
      return [new Token('ARROW', '->', this.line, startColumn)];
    }

    const symbols: { [key: string]: string } = {
      '{': 'LBRACE',
      '}': 'RBRACE',
      ':': 'COLON',
      ',': 'COMMA',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '.': 'DOT'
    };

    if (symbols[char]) {
      this.pos++;
      this.column++;
      return [new Token(symbols[char], char, this.line, startColumn)];
    }

    return null;
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private consume(type: string, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` ${value}` : ''} but got ${token.type} ${token.value} at line ${token.line}`);
    }
    this.pos++;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.pos + 1];
  }

  parse(): StateMachine {
    const machine = this.parseMachine();
    const actions: Action[] = [];
    
    while (this.current().type !== 'EOF') {
      if (this.current().type === 'KEYWORD' && this.current().value === 'action') {
        actions.push(this.parseAction());
      } else {
        this.pos++;
      }
    }

    return { ...machine, actions };
  }

  private parseMachine(): StateMachine {
    this.consume('KEYWORD', 'machine');
    const name = this.consume('IDENTIFIER').value;
    this.consume('LBRACE');
    
    this.consume('KEYWORD', 'initial');
    this.consume('COLON');
    const initial = this.consume('IDENTIFIER').value;

    const states: State[] = [];
    while (this.current().type !== 'RBRACE' && this.current().type !== 'EOF') {
      if (this.current().type === 'KEYWORD' && this.current().value === 'state') {
        states.push(this.parseState());
      } else {
        this.pos++;
      }
    }
    this.consume('RBRACE');

    return { name, initial, states, actions: [] };
  }

  private parseState(): State {
    this.consume('KEYWORD', 'state');
    const name = this.consume('IDENTIFIER').value;
    this.consume('LBRACE');

    const state: State = {
      name,
      transitions: []
    };

    while (this.current().type !== 'RBRACE' && this.current().type !== 'EOF') {
      if (this.current().type === 'KEYWORD' && this.current().value === 'on') {
        this.pos++;
        const nextToken = this.current();
        
        if (nextToken.type === 'KEYWORD' && nextToken.value === 'Enter') {
          this.pos++;
          this.consume('COLON');
          state.onEnter = this.consume('IDENTIFIER').value;
        } else if (nextToken.type === 'KEYWORD' && nextToken.value === 'Exit') {
          this.pos++;
          this.consume('COLON');
          state.onExit = this.consume('IDENTIFIER').value;
        } else if (nextToken.type === 'IDENTIFIER') {
          const event = nextToken.value;
          this.pos++;
          
          if (this.current().type === 'COLON') {
            this.pos++;
            const action = this.consume('IDENTIFIER').value;
            state.transitions.push({ event, target: '', action });
          } else if (this.current().type === 'ARROW') {
            this.pos++;
            const target = this.consume('IDENTIFIER').value;
            state.transitions.push({ event, target });
          }
        }
      } else {
        this.pos++;
      }
    }
    this.consume('RBRACE');

    return state;
  }

  private parseAction(): Action {
    this.consume('KEYWORD', 'action');
    const name = this.consume('IDENTIFIER').value;
    this.consume('LBRACE');
    
    let code = '';
    let braceCount = 1;
    while (braceCount > 0 && this.current().type !== 'EOF') {
      if (this.current().type === 'LBRACE') braceCount++;
      if (this.current().type === 'RBRACE') braceCount--;
      if (braceCount > 0) {
        code += this.current().value + ' ';
      }
      this.pos++;
    }

    return { name, code: code.trim() };
  }
}

export function parseDSL(input: string): { ast: StateMachine; tokens: Token[] } {
  const lexer = new Lexer(input);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return { ast, tokens };
}
