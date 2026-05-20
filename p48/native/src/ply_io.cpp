#include "ply_io.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm>

bool PLYIO::read(const std::string& filename, PointCloud& cloud) {
    cloud.clear();
    
    std::ifstream file(filename);
    if (!file.is_open()) {
        std::cerr << "Cannot open file: " << filename << std::endl;
        return false;
    }
    
    std::string line;
    bool isBinary = false;
    size_t numVertices = 0;
    bool hasColor = false;
    bool hasNormal = false;
    
    while (std::getline(file, line)) {
        std::istringstream iss(line);
        std::string keyword;
        iss >> keyword;
        
        if (keyword == "format") {
            std::string format;
            iss >> format;
            isBinary = (format == "binary_little_endian" || 
                       format == "binary_big_endian");
        } else if (keyword == "element") {
            std::string element;
            iss >> element;
            if (element == "vertex") {
                iss >> numVertices;
            }
        } else if (keyword == "property") {
            std::string type, name;
            iss >> type >> name;
            if (name == "red" || name == "green" || name == "blue") {
                hasColor = true;
            }
            if (name == "nx" || name == "ny" || name == "nz") {
                hasNormal = true;
            }
        } else if (keyword == "end_header") {
            break;
        }
    }
    
    if (isBinary) {
        file.close();
        return readBinary(filename, cloud);
    }
    
    cloud.reserve(numVertices);
    
    for (size_t i = 0; i < numVertices && std::getline(file, line); ++i) {
        std::istringstream iss(line);
        double x, y, z;
        double r = 0, g = 0, b = 0;
        double nx = 0, ny = 0, nz = 0;
        
        iss >> x >> y >> z;
        
        if (hasNormal) {
            iss >> nx >> ny >> nz;
        }
        
        if (hasColor) {
            if (hasNormal) {
                iss >> r >> g >> b;
            } else {
                iss >> r >> g >> b;
            }
            r /= 255.0;
            g /= 255.0;
            b /= 255.0;
        }
        
        Point p(x, y, z, r, g, b);
        p.normal << nx, ny, nz;
        cloud.push_back(p);
    }
    
    file.close();
    return true;
}

bool PLYIO::readASCII(const std::string& filename, PointCloud& cloud) {
    return read(filename, cloud);
}

bool PLYIO::readBinary(const std::string& filename, PointCloud& cloud) {
    std::cerr << "Binary PLY reading not fully implemented, using ASCII fallback" << std::endl;
    return readASCII(filename, cloud);
}

bool PLYIO::write(const std::string& filename, const PointCloud& cloud,
                  bool with_colors, bool with_normals) {
    return writeASCII(filename, cloud, with_colors, with_normals);
}

bool PLYIO::writeASCII(const std::string& filename, const PointCloud& cloud,
                       bool with_colors, bool with_normals) {
    std::ofstream file(filename);
    if (!file.is_open()) {
        std::cerr << "Cannot open file for writing: " << filename << std::endl;
        return false;
    }
    
    file << "ply\n";
    file << "format ascii 1.0\n";
    file << "element vertex " << cloud.size() << "\n";
    file << "property float x\n";
    file << "property float y\n";
    file << "property float z\n";
    
    if (with_normals) {
        file << "property float nx\n";
        file << "property float ny\n";
        file << "property float nz\n";
    }
    
    if (with_colors) {
        file << "property uchar red\n";
        file << "property uchar green\n";
        file << "property uchar blue\n";
    }
    
    file << "end_header\n";
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        const Point& p = cloud[i];
        file << p.xyz.x() << " " << p.xyz.y() << " " << p.xyz.z();
        
        if (with_normals) {
            file << " " << p.normal.x() << " " << p.normal.y() << " " << p.normal.z();
        }
        
        if (with_colors) {
            int r = std::min(255, std::max(0, static_cast<int>(p.rgb.x() * 255.0)));
            int g = std::min(255, std::max(0, static_cast<int>(p.rgb.y() * 255.0)));
            int b = std::min(255, std::max(0, static_cast<int>(p.rgb.z() * 255.0)));
            file << " " << r << " " << g << " " << b;
        }
        
        file << "\n";
    }
    
    file.close();
    return true;
}

bool PLYIO::writeWithErrors(const std::string& filename, 
                            const PointCloud& cloud,
                            const std::vector<double>& errors) {
    if (errors.size() != cloud.size()) {
        std::cerr << "Error vector size mismatch" << std::endl;
        return false;
    }
    
    double maxErr = 0.0;
    for (double e : errors) {
        maxErr = std::max(maxErr, e);
    }
    if (maxErr < 1e-8) maxErr = 1.0;
    
    PointCloud coloredCloud = cloud;
    for (size_t i = 0; i < cloud.size(); ++i) {
        double normalized = std::min(1.0, errors[i] / maxErr);
        coloredCloud[i].rgb.x() = normalized;
        coloredCloud[i].rgb.y() = 1.0 - normalized;
        coloredCloud[i].rgb.z() = 0.0;
    }
    
    return write(filename, coloredCloud, true, false);
}
