# Light Field Refocus Tool

A desktop application for processing light field images using Electron and OpenCV C++ addon.

## Features

- Load Lytro-style raw light field images
- Real-time refocus with interactive depth and aperture controls
- All-in-focus image computation
- Depth map generation with hole-filling
- Multi-threaded processing for performance
- Memory leak prevention with proper resource management
- Export processed images

## Prerequisites

- Node.js (v16 or higher)
- CMake (v3.15 or higher)
- OpenCV (v4 or higher)
- C++17 compatible compiler (GCC, Clang, or MSVC)

### Installing OpenCV

**macOS:**
```bash
brew install opencv
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libopencv-dev
```

**Windows:**
Download OpenCV from [opencv.org](https://opencv.org/releases/) and set the environment variables.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the C++ addon:
```bash
npm run rebuild
```

## Running the Application

```bash
npm start
```

## Usage

1. **Load a Light Field Image**
   - Click "Load Light Field Image" button
   - Select an image file (supports Lytro-style raw images)
   - Set the number of views X and Y (typically 15x15 for Lytro)

2. **Refocus Controls**
   - Drag "Focus Depth" slider to change focus plane
   - Drag "Aperture" slider to adjust depth of field
   - The image updates in real-time as you adjust

3. **View Modes**
   - **Refocus**: Standard refocus view with controls
   - **All Focus**: Compute fully focused image
   - **Depth**: Generate depth map visualization

4. **Export**
   - Click "Export Image" to save the current view

## Bug Fixes Implemented

### Memory Leak Fixes

1. **Proper cv::Mat Release**: All OpenCV matrices are explicitly released after use
2. **Thread-local Accumulators**: Each thread has its own result matrix to prevent data races
3. **Copied Buffer Data**: NAPI Buffer creates a copy of image data instead of referencing cv::Mat internal memory
4. **Automatic Garbage Collection**: JavaScript side has explicit memory cleanup triggers
5. **Smart Pointers**: Uses std::unique_ptr for addon instance management

### Depth Map Hole Fixes

1. **Inpainting**: Uses OpenCV inpaint to fill low-confidence regions
2. **Bilateral Filter**: Edge-preserving smoothing to reduce noise
3. **Variance-based Masking**: Detects unreliable depth regions based on neighborhood variance
4. **Multi-depth Sampling**: Samples multiple depth planes to find maximum variance

## Architecture

```
├── src/
│   ├── addon/
│   │   ├── lightfield.h      # C++ addon header
│   │   └── lightfield.cpp    # C++ implementation with OpenCV
│   ├── main.js               # Electron main process
│   ├── renderer.js           # Electron renderer process
│   └── index.html            # UI interface
├── CMakeLists.txt            # C++ build configuration
├── package.json              # Project dependencies
└── README.md
```

## Technical Details

### Refocus Algorithm

The refocus is implemented using sub-aperture image shifting:
1. Extract sub-aperture images from the raw light field
2. Shift each view based on its position and desired focus depth
3. Average shifted images with appropriate weighting
4. Multi-threaded processing for performance

### Depth Map Computation

1. Compute refocused images at multiple depth levels
2. Calculate local variance for each pixel at each depth
3. Select depth with maximum variance (sharpest focus)
4. Apply inpainting to fill holes in smooth/textureless regions
5. Apply bilateral filtering for smooth, edge-preserving results

## Performance Optimizations

- Multi-threaded processing using std::thread
- Thread-local accumulators to reduce mutex contention
- Efficient pixel access using ptr<> instead of at<>
- Debounced UI updates for smooth interaction
- Memory pooling for repeated operations

## License

MIT
