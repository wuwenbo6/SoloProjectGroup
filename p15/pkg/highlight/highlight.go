package highlight

import (
	"strings"
)

type LanguageStyle struct {
	Keyword    string
	String     string
	Comment    string
	Function   string
	Number     string
	Type       string
	Constant   string
	Reset      string
}

var DefaultStyle = LanguageStyle{
	Keyword:    "\033[38;5;197m",
	String:     "\033[38;5;42m",
	Comment:    "\033[38;5;246m",
	Function:   "\033[38;5;75m",
	Number:     "\033[38;5;208m",
	Type:       "\033[38;5;180m",
	Constant:   "\033[38;5;141m",
	Reset:      "\033[0m",
}

var pythonKeywords = map[string]bool{
	"def": true, "class": true, "return": true, "if": true, "else": true,
	"elif": true, "for": true, "while": true, "import": true, "from": true,
	"as": true, "try": true, "except": true, "finally": true, "with": true,
	"lambda": true, "yield": true, "raise": true, "pass": true, "break": true,
	"continue": true, "and": true, "or": true, "not": true, "in": true,
	"is": true, "None": true, "True": true, "False": true, "print": true,
	"global": true, "nonlocal": true, "assert": true, "del": true,
}

var goKeywords = map[string]bool{
	"func": true, "struct": true, "type": true, "var": true, "const": true,
	"return": true, "if": true, "else": true, "for": true, "range": true,
	"switch": true, "case": true, "default": true, "import": true, "package": true,
	"go": true, "chan": true, "defer": true, "map": true, "interface": true,
	"select": true, "break": true, "continue": true, "goto": true, "fallthrough": true,
	"true": true, "false": true, "nil": true, "iota": true,
}

var jsKeywords = map[string]bool{
	"function": true, "const": true, "let": true, "var": true, "return": true,
	"if": true, "else": true, "for": true, "while": true, "do": true, "switch": true,
	"case": true, "default": true, "try": true, "catch": true, "finally": true,
	"throw": true, "new": true, "class": true, "import": true, "export": true,
	"from": true, "async": true, "await": true, "yield": true, "typeof": true,
	"instanceof": true, "true": true, "false": true, "null": true, "undefined": true,
	"this": true, "super": true, "extends": true, "static": true, "get": true, "set": true,
}

var bashKeywords = map[string]bool{
	"if": true, "then": true, "else": true, "elif": true, "fi": true, "for": true,
	"do": true, "done": true, "while": true, "until": true, "case": true, "esac": true,
	"in": true, "function": true, "echo": true, "export": true, "local": true,
	"readonly": true, "return": true, "exit": true, "source": true, "readonly": true,
	"declare": true, "typeset": true, "true": true, "false": true,
}

var goTypes = map[string]bool{
	"int": true, "string": true, "bool": true, "float64": true, "float32": true,
	"int64": true, "int32": true, "int16": true, "int8": true, "uint": true,
	"uint64": true, "uint32": true, "uint16": true, "uint8": true, "byte": true,
	"rune": true, "error": true, "complex64": true, "complex128": true,
}

func Highlight(code, language string) string {
	style := DefaultStyle
	keywords := getKeywords(language)
	types := getTypes(language)

	lines := strings.Split(code, "\n")
	var result strings.Builder

	for _, line := range lines {
		highlighted := highlightLine(line, keywords, types, style)
		result.WriteString(highlighted)
		result.WriteString("\n")
	}

	return result.String()
}

func highlightLine(line string, keywords, types map[string]bool, style LanguageStyle) string {
	var result strings.Builder
	runes := []rune(line)
	i := 0

	for i < len(runes) {
		if i+1 < len(runes) && runes[i] == '/' && runes[i+1] == '/' {
			result.WriteString(style.Comment)
			result.WriteString(string(runes[i:]))
			result.WriteString(style.Reset)
			break
		}

		if runes[i] == '#' {
			result.WriteString(style.Comment)
			result.WriteString(string(runes[i:]))
			result.WriteString(style.Reset)
			break
		}

		if runes[i] == '"' || runes[i] == '\'' || runes[i] == '`' {
			quote := runes[i]
			result.WriteString(style.String)
			result.WriteRune(quote)
			i++
			for i < len(runes) && runes[i] != quote {
				result.WriteRune(runes[i])
				i++
			}
			if i < len(runes) {
				result.WriteRune(quote)
			}
			result.WriteString(style.Reset)
			i++
			continue
		}

		if isDigit(runes[i]) {
			start := i
			for i < len(runes) && (isDigit(runes[i]) || runes[i] == '.' || runes[i] == 'x' || runes[i] == 'X' || isHexDigit(runes[i])) {
				i++
			}
			result.WriteString(style.Number)
			result.WriteString(string(runes[start:i]))
			result.WriteString(style.Reset)
			continue
		}

		if isIdentifierStart(runes[i]) {
			start := i
			for i < len(runes) && isIdentifierPart(runes[i]) {
				i++
			}
			word := string(runes[start:i])

			if i < len(runes) && runes[i] == '(' {
				result.WriteString(style.Function)
				result.WriteString(word)
				result.WriteString(style.Reset)
			} else if keywords[word] {
				result.WriteString(style.Keyword)
				result.WriteString(word)
				result.WriteString(style.Reset)
			} else if types[word] {
				result.WriteString(style.Type)
				result.WriteString(word)
				result.WriteString(style.Reset)
			} else if isAllUpper(word) {
				result.WriteString(style.Constant)
				result.WriteString(word)
				result.WriteString(style.Reset)
			} else {
				result.WriteString(word)
			}
			continue
		}

		result.WriteRune(runes[i])
		i++
	}

	return result.String()
}

func getKeywords(language string) map[string]bool {
	switch strings.ToLower(language) {
	case "python":
		return pythonKeywords
	case "go":
		return goKeywords
	case "javascript", "js":
		return jsKeywords
	case "bash", "shell":
		return bashKeywords
	default:
		return make(map[string]bool)
	}
}

func getTypes(language string) map[string]bool {
	switch strings.ToLower(language) {
	case "go":
		return goTypes
	default:
		return make(map[string]bool)
	}
}

func isDigit(r rune) bool {
	return r >= '0' && r <= '9'
}

func isHexDigit(r rune) bool {
	return isDigit(r) || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func isIdentifierStart(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_'
}

func isIdentifierPart(r rune) bool {
	return isIdentifierStart(r) || isDigit(r)
}

func isAllUpper(s string) bool {
	for _, r := range s {
		if r >= 'a' && r <= 'z' {
			return false
		}
	}
	return len(s) > 0
}
