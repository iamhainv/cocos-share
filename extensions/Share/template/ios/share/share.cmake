# Share extension — iOS CMake build rules.
#
# Mirrors the structure and variable conventions of iap.cmake.
# Key differences from iap.cmake:
#   * NO xcframework — ShareServiceHub.mm uses only UIKit, which is already
#     linked by the Cocos engine target. No third-party static or dynamic lib.
#   * NO Swift runtime — implementation is pure ObjC (no Swift, no ARC-free C++
#     interop layer needed).
#   * NO ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES flag required.
#   * UIKit is the only system framework required and is already present;
#     target_link_libraries for UIKit is included defensively for clarity.
#
# Minimum iOS deployment target: iOS 13.0 (UIActivityViewController popover
# APIs used here are available from iOS 13; key-window API is iOS 2.0+).
# The Cocos project's CMAKE_OSX_DEPLOYMENT_TARGET should be ≥ 13.0.

# ---------------------------------------------------------------------------
# 1. Collect ObjC bridge sources
# ---------------------------------------------------------------------------

set(SHARE_PROJ_SOURCES)

list(APPEND SHARE_PROJ_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/ShareServiceHub.mm
    ${CMAKE_CURRENT_LIST_DIR}/ShareServiceHub.h
)

source_group(TREE ${CMAKE_CURRENT_LIST_DIR} PREFIX "Source Files" FILES ${SHARE_PROJ_SOURCES})

# Enable ARC on every source file (mirrors iap.cmake per-file approach).
foreach(file ${SHARE_PROJ_SOURCES})
    set_source_files_properties(${file} PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
endforeach()

# ---------------------------------------------------------------------------
# 2. Build the bridge as a static library
# ---------------------------------------------------------------------------

add_library(share ${SHARE_PROJ_SOURCES})

target_include_directories(share PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}
)

# ---------------------------------------------------------------------------
# 3. Link system frameworks
#
# UIKit is already linked transitively through the engine, but we name it
# explicitly to make the dependency self-documenting and survive refactors.
# ---------------------------------------------------------------------------

target_link_libraries(share "-framework UIKit")

# ---------------------------------------------------------------------------
# 4. Link engine and wire share into the final executable
# ---------------------------------------------------------------------------

target_link_libraries(share ${ENGINE_NAME})
target_include_directories(${EXECUTABLE_NAME} PUBLIC ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(${EXECUTABLE_NAME} share)

# Force-load ensures +load / constructor functions inside the static lib run
# even if no symbol from the lib is directly referenced.
target_link_options(${EXECUTABLE_NAME} PRIVATE -ObjC)
