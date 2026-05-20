#ifndef PLY_IO_H
#define PLY_IO_H

#include "point_cloud.h"
#include <string>

class PLYIO {
public:
    static bool read(const std::string& filename, PointCloud& cloud);
    static bool write(const std::string& filename, const PointCloud& cloud,
                     bool with_colors = true, bool with_normals = false);
    
    static bool writeWithErrors(const std::string& filename, 
                                const PointCloud& cloud,
                                const std::vector<double>& errors);
    
private:
    static bool readASCII(const std::string& filename, PointCloud& cloud);
    static bool readBinary(const std::string& filename, PointCloud& cloud);
    static bool writeASCII(const std::string& filename, const PointCloud& cloud,
                          bool with_colors, bool with_normals);
};

#endif
