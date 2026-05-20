package fbd

// FBD 功能块图类型定义

// Position 位置
type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Variable 变量
type Variable struct {
	Name        string `json:"name"`
	Type        string `json:"type"`        // bool, int, float
	Address     string `json:"address"`     // I0.0, M0.1 等
	Description string `json:"description"`
	Value       interface{} `json:"value,omitempty"`
}

// Wire 连接线
type Wire struct {
	ID     string   `json:"id"`
	From   Position `json:"from"`
	To     Position `json:"to"`
	FromBlock string `json:"fromBlock"`
	ToBlock   string `json:"toBlock"`
}

// BlockType 功能块类型
type BlockType string

const (
	BlockTypeAND    BlockType = "AND"
	BlockTypeOR     BlockType = "OR"
	BlockTypeNOT    BlockType = "NOT"
	BlockTypeTON    BlockType = "TON"
	BlockTypeTOF    BlockType = "TOF"
	BlockTypeTP     BlockType = "TP"
	BlockTypeCTU    BlockType = "CTU"
	BlockTypeCTD    BlockType = "CTD"
	BlockTypeCTUD   BlockType = "CTUD"
	BlockTypeMove   BlockType = "MOVE"
	BlockTypeInput  BlockType = "INPUT"
	BlockTypeOutput BlockType = "OUTPUT"
)

// Block 功能块
type Block struct {
	ID          string    `json:"id"`
	Type        BlockType `json:"type"`
	Name        string    `json:"name"`
	Position    Position  `json:"position"`
	Width       int       `json:"width"`
	Height      int       `json:"height"`
	Inputs      []string  `json:"inputs"`
	Outputs     []string  `json:"outputs"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// Program FBD程序
type Program struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Version     string     `json:"version"`
	Blocks      []Block    `json:"blocks"`
	Wires       []Wire     `json:"wires"`
	Variables   []Variable `json:"variables"`
	CreateTime  int64      `json:"createTime"`
	UpdateTime  int64      `json:"updateTime"`
}
