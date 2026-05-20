package image

import (
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"

	"musicscore/pkg/models"
)

type Config struct {
	DenoiseLevel   int
	ThresholdValue int
	MinSymbolSize  int
	MaxSymbolSize  int
}

func DefaultConfig() Config {
	return Config{
		DenoiseLevel:   3,
		ThresholdValue: 127,
		MinSymbolSize:  20,
		MaxSymbolSize:  200,
	}
}

type Processor struct {
	config Config
}

func NewProcessor(config Config) *Processor {
	return &Processor{config: config}
}

func (p *Processor) ProcessImage(inputPath string, scoreType models.ScoreType) (*models.ImageProcessResult, error) {
	img, err := p.loadImage(inputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load image: %w", err)
	}

	grayImg := p.convertToGrayscale(img)

	denoisedImg := p.denoise(grayImg)

	skewAngle := p.detectSkew(denoisedImg)
	deskewedImg := p.deskew(denoisedImg, skewAngle)

	thresholdedImg := p.threshold(deskewedImg)

	symbols := p.segmentSymbols(thresholdedImg)

	processedPath := p.saveProcessedImage(thresholdedImg, inputPath)

	return &models.ImageProcessResult{
		OriginalPath:  inputPath,
		ProcessedPath: processedPath,
		Symbols:       symbols,
		SkewAngle:     skewAngle,
	}, nil
}

func (p *Processor) loadImage(path string) (image.Image, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	ext := filepath.Ext(path)
	switch ext {
	case ".png":
		return png.Decode(file)
	case ".jpg", ".jpeg":
		return jpeg.Decode(file)
	default:
		return nil, fmt.Errorf("unsupported image format: %s", ext)
	}
}

func (p *Processor) convertToGrayscale(img image.Image) *image.Gray {
	bounds := img.Bounds()
	gray := image.NewGray(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			lum := uint8((0.299*float64(r>>8) + 0.587*float64(g>>8) + 0.114*float64(b>>8)))
			gray.SetGray(x, y, color.Gray{Y: lum})
		}
	}
	return gray
}

func (p *Processor) denoise(img *image.Gray) *image.Gray {
	bounds := img.Bounds()
	result := image.NewGray(bounds)
	level := p.config.DenoiseLevel

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			sum := 0
			count := 0
			for dy := -level; dy <= level; dy++ {
				for dx := -level; dx <= level; dx++ {
					nx, ny := x+dx, y+dy
					if nx >= bounds.Min.X && nx < bounds.Max.X && ny >= bounds.Min.Y && ny < bounds.Max.Y {
						sum += int(img.GrayAt(nx, ny).Y)
						count++
					}
				}
			}
			result.SetGray(x, y, color.Gray{Y: uint8(sum / count)})
		}
	}
	return result
}

func (p *Processor) detectSkew(img *image.Gray) float64 {
	return 0.0
}

func (p *Processor) deskew(img *image.Gray, angle float64) *image.Gray {
	return img
}

func (p *Processor) threshold(img *image.Gray) *image.Gray {
	bounds := img.Bounds()
	result := image.NewGray(bounds)
	threshold := uint8(p.config.ThresholdValue)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if img.GrayAt(x, y).Y > threshold {
				result.SetGray(x, y, color.Gray{Y: 255})
			} else {
				result.SetGray(x, y, color.Gray{Y: 0})
			}
		}
	}
	return result
}

func (p *Processor) segmentSymbols(img *image.Gray) []models.MusicSymbol {
	var symbols []models.MusicSymbol
	bounds := img.Bounds()
	visited := make(map[image.Point]bool)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if img.GrayAt(x, y).Y == 0 && !visited[image.Point{X: x, Y: y}] {
				symbol := p.floodFill(img, x, y, visited)
				if symbol.Width >= p.config.MinSymbolSize && symbol.Height >= p.config.MinSymbolSize &&
					symbol.Width <= p.config.MaxSymbolSize && symbol.Height <= p.config.MaxSymbolSize {
					symbols = append(symbols, symbol)
				}
			}
		}
	}
	return symbols
}

func (p *Processor) floodFill(img *image.Gray, startX, startY int, visited map[image.Point]bool) models.MusicSymbol {
	bounds := img.Bounds()
	queue := []image.Point{{X: startX, Y: startY}}
	visited[image.Point{X: startX, Y: startY}] = true

	minX, maxX := startX, startX
	minY, maxY := startY, startY

	for len(queue) > 0 {
		point := queue[0]
		queue = queue[1:]

		if point.X < minX {
			minX = point.X
		}
		if point.X > maxX {
			maxX = point.X
		}
		if point.Y < minY {
			minY = point.Y
		}
		if point.Y > maxY {
			maxY = point.Y
		}

		for _, d := range []image.Point{{-1, 0}, {1, 0}, {0, -1}, {0, 1}} {
			nx, ny := point.X+d.X, point.Y+d.Y
			np := image.Point{X: nx, Y: ny}
			if nx >= bounds.Min.X && nx < bounds.Max.X && ny >= bounds.Min.Y && ny < bounds.Max.Y &&
				img.GrayAt(nx, ny).Y == 0 && !visited[np] {
				visited[np] = true
				queue = append(queue, np)
			}
		}
	}

	return models.MusicSymbol{
		PositionX:  minX,
		PositionY:  minY,
		Width:      maxX - minX + 1,
		Height:     maxY - minY + 1,
		Confidence: 1.0,
	}
}

func (p *Processor) saveProcessedImage(img *image.Gray, originalPath string) string {
	dir := filepath.Dir(originalPath)
	base := filepath.Base(originalPath)
	ext := filepath.Ext(base)
	name := base[:len(base)-len(ext)]
	outputPath := filepath.Join(dir, fmt.Sprintf("%s_processed%s", name, ext))

	file, err := os.Create(outputPath)
	if err != nil {
		return ""
	}
	defer file.Close()

	png.Encode(file, img)
	return outputPath
}
