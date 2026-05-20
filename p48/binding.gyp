{
  "targets": [
    {
      "target_name": "registration",
      "sources": [
        "native/src/addon.cpp",
        "native/src/ply_io.cpp",
        "native/src/embedded_deformation.cpp",
        "native/src/visibility_test.cpp",
        "native/src/quality_evaluation.cpp",
        "native/src/registration.cpp",
        "native/src/point_cloud.cpp",
        "native/src/temporal_registration.cpp"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "native/include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17", "-stdlib=libc++"]
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}
