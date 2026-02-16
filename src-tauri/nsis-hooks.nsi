!macro NSIS_HOOK_PREUNINSTALL
  ; Remove thumbnail cache and app data on uninstall
  RMDir /r "$APPDATA\com.sebastien.moodcrate"
  RMDir /r "$LOCALAPPDATA\com.sebastien.moodcrate"
!macroend
