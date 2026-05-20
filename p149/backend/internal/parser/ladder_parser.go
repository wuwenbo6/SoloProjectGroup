package parser

import (
	"encoding/json"
	"errors"
	"fmt"
	"plc-simulator/internal/models"
)

const (
	// MaxDepth 最大解析深度 - 防止栈溢出
	MaxDepth = 1000
	// MaxNodes 最大节点数 - 防止无限循环
	MaxNodes = 10000
)

// LadderParser 迭代式梯形图解析器
type LadderParser struct {
	depth     int
	nodeCount int
	stack     []interface{}
}

// NewLadderParser 创建新的解析器
func NewLadderParser() *LadderParser {
	return &LadderParser{
		depth:     0,
		nodeCount: 0,
		stack:     make([]interface{}, 0),
	}
}

// ParseProgram 解析梯形图程序（迭代式，避免栈溢出）
func (p *LadderParser) ParseProgram(jsonData string) ([]models.Rung, error) {
	p.Reset()

	var rungs []models.Rung
	if err := json.Unmarshal([]byte(jsonData), &rungs); err != nil {
		return nil, fmt.Errorf("JSON解析失败: %w", err)
	}

	// 迭代解析每个梯级
	for i, rung := range rungs {
		if err := p.parseRungIterative(rung); err != nil {
			return nil, fmt.Errorf("梯级 %d 解析失败: %w", i, err)
		}
	}

	return rungs, nil
}

// parseRungIterative 迭代解析单个梯级
func (p *LadderParser) parseRungIterative(rung models.Rung) error {
	if rung.Logic == nil {
		return nil
	}

	// 使用显式栈替代递归
	stack := []interface{}{rung.Logic}

	for len(stack) > 0 {
		// 弹出栈顶元素
		node := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		p.nodeCount++
		if p.nodeCount > MaxNodes {
			return errors.New("节点数超出最大限制，可能存在循环引用或程序过于复杂")
		}

		p.depth++
		if p.depth > MaxDepth {
			return fmt.Errorf("解析深度超出最大限制 %d", MaxDepth)
		}

		// 检查节点类型并处理子节点
		switch n := node.(type) {
		case map[string]interface{}:
			// 处理逻辑运算节点 (AND/OR)
			left, hasLeft := n["left"]
			right, hasRight := n["right"]

			if hasRight && right != nil {
				stack = append(stack, right)
			}
			if hasLeft && left != nil {
				stack = append(stack, left)
			}

		case []interface{}:
			// 处理数组 - 反向遍历保持顺序
			for i := len(n) - 1; i >= 0; i-- {
				if n[i] != nil {
					stack = append(stack, n[i])
				}
			}

		default:
			// 基本节点类型 - 叶子节点
		}

		p.depth--
	}

	return nil
}

// EvaluateLogicNode 求值逻辑节点（迭代式执行器）
func (p *LadderParser) EvaluateLogicNode(node interface{}, varGetter func(string) (bool, bool)) (bool, error) {
	type frame struct {
		node  interface{}
		done  bool
		op    string
		left  *bool
		right *bool
	}

	stack := []frame{{node: node, done: false}}
	results := make([]bool, 0)

	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if current.done {
			// 处理操作符节点
			switch current.op {
			case "and":
				if current.left != nil && current.right != nil {
					results = append(results, *current.left && *current.right)
				}
			case "or":
				if current.left != nil && current.right != nil {
					results = append(results, *current.left || *current.right)
				}
			case "not":
				if current.left != nil {
					results = append(results, !*current.left)
				}
			}
			continue
		}

		p.depth++
		if p.depth > MaxDepth {
			return false, fmt.Errorf("执行深度超出最大限制 %d", MaxDepth)
		}

		p.nodeCount++
		if p.nodeCount > MaxNodes {
			return false, errors.New("节点数超出最大限制")
		}

		switch n := current.node.(type) {
		case map[string]interface{}:
			if op, ok := n["operator"].(string); ok {
				// 逻辑运算节点 - 压入处理帧
				rightVal, hasRight := n["right"]
				leftVal, hasLeft := n["left"]

				if hasRight && hasLeft {
					// 二元操作
					stack = append(stack, frame{node: nil, done: true, op: op})
					stack = append(stack, frame{node: rightVal, done: false})
					stack = append(stack, frame{node: leftVal, done: false})
				} else if hasLeft {
					// 一元操作 (NOT)
					stack = append(stack, frame{node: nil, done: true, op: op})
					stack = append(stack, frame{node: leftVal, done: false})
				}
			} else if typ, ok := n["type"].(string); ok {
				// 基本元件节点
				if varName, ok := n["var"].(string); ok {
					switch typ {
					case "contact_no":
						val, ok := varGetter(varName)
						results = append(results, ok && val)
					case "contact_nc":
						val, ok := varGetter(varName)
						results = append(results, ok && !val)
					case "contact_m":
						val, ok := varGetter(varName)
						results = append(results, ok && val)
					default:
						results = append(results, false)
					}
				} else {
					results = append(results, false)
				}
			} else {
				results = append(results, false)
			}

		case bool:
			results = append(results, n)

		default:
			results = append(results, false)
		}

		p.depth--
	}

	if len(results) > 0 {
		return results[len(results)-1], nil
	}
	return false, nil
}

// ValidateProgram 验证程序复杂度（在执行前检查）
func ValidateProgram(rungs []models.Rung) error {
	parser := NewLadderParser()

	for i, rung := range rungs {
		if err := parser.parseRungIterative(rung); err != nil {
			return fmt.Errorf("梯级 %d 验证失败: %w", i, err)
		}
	}

	return nil
}

// GetStats 获取解析统计信息
func (p *LadderParser) GetStats() (depth int, nodeCount int) {
	return p.depth, p.nodeCount
}

// Reset 重置解析器状态
func (p *LadderParser) Reset() {
	p.depth = 0
	p.nodeCount = 0
	p.stack = p.stack[:0]
}
