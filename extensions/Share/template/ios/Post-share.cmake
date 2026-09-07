# Share extension — iOS post-build hook.
#
# Mirrors the structure of Post-iap.cmake exactly.  RES_DIR is the Cocos
# native project resource directory set by the Cocos build pipeline before
# this file is included.

if(EXISTS ${RES_DIR}/proj/share)
    include(${RES_DIR}/proj/share/share.cmake)
endif()
