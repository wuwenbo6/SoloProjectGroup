#!/bin/bash

mkdir -p build
cd build
emcmake cmake ..
emmake make
