cmake_minimum_required(VERSION 3.18)
project(fem_compute_node LANGUAGES CXX CUDA)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_STANDARD 14)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)

find_package(OpenMP REQUIRED)

if(OPENMP_FOUND)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
endif()

include(FetchContent)

FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.2
)

FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.14.0
)

FetchContent_MakeAvailable(nlohmann_json httplib)

option(USE_CUDA "Enable CUDA acceleration" ON)

set(SOURCES
    src/main.cpp
)

if(USE_CUDA)
    list(APPEND SOURCES
        src/cuda_kernels.cu
    )
endif()

add_executable(fem_compute_node ${SOURCES})

target_link_libraries(fem_compute_node
    PRIVATE
    nlohmann_json::nlohmann_json
    httplib
)

target_include_directories(fem_compute_node
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

if(USE_CUDA)
    target_compile_definitions(fem_compute_node PRIVATE USE_CUDA)
    set_target_properties(fem_compute_node PROPERTIES
        CUDA_SEPARABLE_COMPILATION ON
        CUDA_ARCHITECTURES "50;60;70;75;80"
    )
endif()

install(TARGETS fem_compute_node DESTINATION bin)
