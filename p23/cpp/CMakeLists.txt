cmake_minimum_required(VERSION 3.15)
project(QuantumSimulator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if (EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
    add_executable(quantum_simulator
        src/quantum_state.cpp
        src/bindings.cpp
    )
    target_include_directories(quantum_simulator PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_compile_options(quantum_simulator PRIVATE -O3)
    target_link_options(quantum_simulator PRIVATE
        -lembind
        -O3
        -s MODULARIZE=1
        -s EXPORT_NAME="createQuantumSimulator"
        -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']
        -s ALLOW_MEMORY_GROWTH=1
        -s MAXIMUM_MEMORY=512MB
        -s INITIAL_MEMORY=32MB
        -s STACK_SIZE=1MB
        -s ENVIRONMENT='web'
        -s ABORTING_MALLOC=0
        -s DISABLE_EXCEPTION_CATCHING=0
        -s SAFE_HEAP=1
    )
endif()
