package parser

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/types"
)

type Token struct {
	Type   string
	Value  string
	Line   int
	Column int
}

type Parser struct {
	tokens []Token
	pos    int
}

func ParseDSL(input string) (*types.StateMachine, error) {
	tokens, err := tokenize(input)
	if err != nil {
		return nil, err
	}

	parser := &Parser{tokens: tokens, pos: 0}
	return parser.parse()
}

func tokenize(input string) ([]Token, error) {
	var tokens []Token
	line := 1
	column := 1

	keywords := map[string]bool{
		"machine": true, "state": true, "action": true,
		"initial": true, "on": true, "Enter": true, "Exit": true, "print": true,
	}

	re := regexp.MustCompile(`\s+|#[^\n]*|->|".*?"|[a-zA-Z_][a-zA-Z0-9_]*|[{}:(),]`)
	matches := re.FindAllStringIndex(input, -1)

	lastPos := 0
	for _, match := range matches {
		start, end := match[0], match[1]

		for i := lastPos; i < start; i++ {
			if input[i] == '\n' {
				line++
				column = 1
			} else {
				column++
			}
		}

		tokenStr := input[start:end]
		tokenColumn := column

		for i, c := range tokenStr {
			if c == '\n' {
				line++
				column = 1
			} else {
				column++
			}
			if i == 0 {
				tokenColumn = column
			}
		}

		tokenStr = strings.TrimSpace(tokenStr)
		if tokenStr == "" || strings.HasPrefix(tokenStr, "#") {
			lastPos = end
			continue
		}

		tokenType := "IDENTIFIER"
		if keywords[tokenStr] {
			tokenType = "KEYWORD"
		} else if strings.HasPrefix(tokenStr, "\"") && strings.HasSuffix(tokenStr, "\"") {
			tokenType = "STRING"
			tokenStr = tokenStr[1 : len(tokenStr)-1]
		} else if tokenStr == "->" {
			tokenType = "ARROW"
		} else if len(tokenStr) == 1 {
			switch tokenStr[0] {
			case '{':
				tokenType = "LBRACE"
			case '}':
				tokenType = "RBRACE"
			case ':':
				tokenType = "COLON"
			case '(':
				tokenType = "LPAREN"
			case ')':
				tokenType = "RPAREN"
			}
		}

		tokens = append(tokens, Token{
			Type:   tokenType,
			Value:  tokenStr,
			Line:   line,
			Column: tokenColumn,
		})

		lastPos = end
	}

	tokens = append(tokens, Token{Type: "EOF", Line: line, Column: column})
	return tokens, nil
}

func (p *Parser) current() Token {
	return p.tokens[p.pos]
}

func (p *Parser) consume(expectedType string, expectedValue ...string) (Token, error) {
	token := p.current()
	if token.Type != expectedType {
		return token, fmt.Errorf("expected %s but got %s at line %d", expectedType, token.Type, token.Line)
	}
	if len(expectedValue) > 0 && token.Value != expectedValue[0] {
		return token, fmt.Errorf("expected %s but got %s at line %d", expectedValue[0], token.Value, token.Line)
	}
	p.pos++
	return token, nil
}

func (p *Parser) parse() (*types.StateMachine, error) {
	machine, err := p.parseMachine()
	if err != nil {
		return nil, err
	}

	for p.current().Type != "EOF" {
		if p.current().Type == "KEYWORD" && p.current().Value == "action" {
			action, err := p.parseAction()
			if err != nil {
				return nil, err
			}
			machine.Actions = append(machine.Actions, *action)
		} else {
			p.pos++
		}
	}

	return machine, nil
}

func (p *Parser) parseMachine() (*types.StateMachine, error) {
	if _, err := p.consume("KEYWORD", "machine"); err != nil {
		return nil, err
	}

	nameToken, err := p.consume("IDENTIFIER")
	if err != nil {
		return nil, err
	}

	if _, err := p.consume("LBRACE"); err != nil {
		return nil, err
	}

	if _, err := p.consume("KEYWORD", "initial"); err != nil {
		return nil, err
	}

	if _, err := p.consume("COLON"); err != nil {
		return nil, err
	}

	initialToken, err := p.consume("IDENTIFIER")
	if err != nil {
		return nil, err
	}

	var states []types.State
	for p.current().Type != "RBRACE" && p.current().Type != "EOF" {
		if p.current().Type == "KEYWORD" && p.current().Value == "state" {
			state, err := p.parseState()
			if err != nil {
				return nil, err
			}
			states = append(states, *state)
		} else {
			p.pos++
		}
	}

	if _, err := p.consume("RBRACE"); err != nil {
		return nil, err
	}

	return &types.StateMachine{
		Name:    nameToken.Value,
		Initial: initialToken.Value,
		States:  states,
		Actions: []types.Action{},
	}, nil
}

func (p *Parser) parseState() (*types.State, error) {
	if _, err := p.consume("KEYWORD", "state"); err != nil {
		return nil, err
	}

	nameToken, err := p.consume("IDENTIFIER")
	if err != nil {
		return nil, err
	}

	if _, err := p.consume("LBRACE"); err != nil {
		return nil, err
	}

	state := &types.State{
		Name:        nameToken.Value,
		Transitions: []types.Transition{},
	}

	for p.current().Type != "RBRACE" && p.current().Type != "EOF" {
		if p.current().Type == "KEYWORD" && p.current().Value == "on" {
			p.pos++
			nextToken := p.current()

			if nextToken.Type == "KEYWORD" && nextToken.Value == "Enter" {
				p.pos++
				if _, err := p.consume("COLON"); err != nil {
					return nil, err
				}
				actionToken, err := p.consume("IDENTIFIER")
				if err != nil {
					return nil, err
				}
				state.OnEnter = actionToken.Value
			} else if nextToken.Type == "KEYWORD" && nextToken.Value == "Exit" {
				p.pos++
				if _, err := p.consume("COLON"); err != nil {
					return nil, err
				}
				actionToken, err := p.consume("IDENTIFIER")
				if err != nil {
					return nil, err
				}
				state.OnExit = actionToken.Value
			} else if nextToken.Type == "IDENTIFIER" {
				event := nextToken.Value
				p.pos++

				if p.current().Type == "COLON" {
					p.pos++
					actionToken, err := p.consume("IDENTIFIER")
					if err != nil {
						return nil, err
					}
					state.Transitions = append(state.Transitions, types.Transition{
						Event:  event,
						Action: actionToken.Value,
					})
				} else if p.current().Type == "ARROW" {
					p.pos++
					targetToken, err := p.consume("IDENTIFIER")
					if err != nil {
						return nil, err
					}
					state.Transitions = append(state.Transitions, types.Transition{
						Event:  event,
						Target: targetToken.Value,
					})
				}
			}
		} else {
			p.pos++
		}
	}

	if _, err := p.consume("RBRACE"); err != nil {
		return nil, err
	}

	return state, nil
}

func (p *Parser) parseAction() (*types.Action, error) {
	if _, err := p.consume("KEYWORD", "action"); err != nil {
		return nil, err
	}

	nameToken, err := p.consume("IDENTIFIER")
	if err != nil {
		return nil, err
	}

	if _, err := p.consume("LBRACE"); err != nil {
		return nil, err
	}

	var code strings.Builder
	braceCount := 1

	for braceCount > 0 && p.current().Type != "EOF" {
		if p.current().Type == "LBRACE" {
			braceCount++
		}
		if p.current().Type == "RBRACE" {
			braceCount--
		}
		if braceCount > 0 {
			code.WriteString(p.current().Value)
			code.WriteString(" ")
		}
		p.pos++
	}

	return &types.Action{
		Name: nameToken.Value,
		Code: strings.TrimSpace(code.String()),
	}, nil
}

func ParseFile(filename string) (*types.StateMachine, error) {
	content, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	return ParseDSL(string(content))
}
