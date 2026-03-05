!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var MoodcrateRemoveData
Var MoodcrateCheckHandle

Function un.MoodcrateDataPage
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 20u "Optional: remove stored Moodcrate data"
  Pop $0
  ${NSD_CreateCheckbox} 0 28u 100% 12u "Remove thumbnail cache and tags (stored in Documents\Moodcrate)"
  Pop $MoodcrateCheckHandle
  ${NSD_SetState} $MoodcrateCheckHandle ${BST_UNCHECKED}
  nsDialogs::Show
FunctionEnd

Function un.MoodcrateDataPageLeave
  ${NSD_GetState} $MoodcrateCheckHandle $MoodcrateRemoveData
FunctionEnd

UninstPage custom un.MoodcrateDataPage un.MoodcrateDataPageLeave

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $MoodcrateRemoveData == ${BST_CHECKED}
    RMDir /r "$APPDATA\com.sebastien.moodcrate"
    RMDir /r "$LOCALAPPDATA\com.sebastien.moodcrate"
    RMDir /r "$DOCUMENTS\Moodcrate"
  ${EndIf}
!macroend
