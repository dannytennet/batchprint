; Adds Batch Print to the Windows Explorer right-click menu and the Send To menu.
; Included by electron-builder's NSIS installer (see electron-builder.yml).
; SHCTX is HKCU for a per-user install and HKLM for an all-users install.
; Keep the extension list in sync with src/shared/fileTypes.ts (a test checks this).

!macro BatchPrintVerb KEY
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\BatchPrint" "" "Add to print batch"
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\BatchPrint" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  ; "Player" lets Explorer pass up to 100 selected files instead of 15 (each still arrives separately).
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\BatchPrint" "MultiSelectModel" "Player"
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\BatchPrint\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --add "%1"'
!macroend

!macro BatchPrintRemoveVerb KEY
  DeleteRegKey SHCTX "Software\Classes\${KEY}\shell\BatchPrint"
!macroend

!macro customInstall
  !insertmacro BatchPrintVerb "SystemFileAssociations\.pdf"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.png"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.jpg"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.jpeg"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.gif"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.bmp"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.tif"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.tiff"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.webp"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.doc"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.docx"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.docm"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.dot"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.dotx"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.rtf"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.odt"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.txt"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.xls"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.xlsx"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.xlsm"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.xlsb"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.ods"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.csv"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.ppt"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.pptx"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.pptm"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.pps"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.ppsx"
  !insertmacro BatchPrintVerb "SystemFileAssociations\.odp"
  !insertmacro BatchPrintVerb "Directory"
  CreateShortCut "$SENDTO\Batch Print.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--add"
  ; Tell Explorer the menus changed so it picks them up without a restart.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.pdf"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.png"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.jpg"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.jpeg"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.gif"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.bmp"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.tif"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.tiff"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.webp"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.doc"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.docx"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.docm"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.dot"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.dotx"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.rtf"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.odt"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.txt"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.xls"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.xlsx"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.xlsm"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.xlsb"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.ods"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.csv"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.ppt"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.pptx"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.pptm"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.pps"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.ppsx"
  !insertmacro BatchPrintRemoveVerb "SystemFileAssociations\.odp"
  !insertmacro BatchPrintRemoveVerb "Directory"
  Delete "$SENDTO\Batch Print.lnk"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
