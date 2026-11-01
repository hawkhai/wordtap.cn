Unicode True
RequestExecutionLevel user
ManifestDPIAware true

!ifndef MyAppVersion
!define MyAppVersion "0.0.0-dev"
!endif

!ifndef MyAppVersionQuad
!define MyAppVersionQuad "0.0.0.0"
!endif

!ifndef SourceDir
!define SourceDir "..\local-service\wordtap-service\target\release"
!endif

!ifndef OutputDir
!define OutputDir "..\public\downloads"
!endif

!define MyAppName "WordTap 全文朗读服务"
!define MyAppPublisher "WordTap"
!define MyAppExeName "wordtap-service.exe"
!define MyAppId "{BC68BC30-8941-4F9C-B8F4-20399147C207}"
!define MyUninstallKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\${MyAppId}"
!define MyStartupKey "Software\Microsoft\Windows\CurrentVersion\Run"
!define MyStartupValue "WordTapGateway"

!include LogicLib.nsh
!include FileFunc.nsh
!insertmacro GetParameters
!insertmacro GetOptions
!include MUI2.nsh

Name "${MyAppName}"
OutFile "${OutputDir}\WordTapGatewaySetup.exe"
InstallDir "$LOCALAPPDATA\Programs\WordTap Gateway"
InstallDirRegKey HKCU "${MyUninstallKey}" "InstallLocation"
Icon "..\public\favicon.ico"
UninstallIcon "..\public\favicon.ico"
SetCompressor /SOLID lzma
XPStyle on

VIProductVersion "${MyAppVersionQuad}"
VIAddVersionKey "CompanyName" "${MyAppPublisher}"
VIAddVersionKey "Comments" "Official website: wordtap.cn"
VIAddVersionKey "FileDescription" "${MyAppName} 安装程序"
VIAddVersionKey "FileVersion" "${MyAppVersion}"
VIAddVersionKey "LegalCopyright" "Copyright (C) WordTap"
VIAddVersionKey "ProductName" "${MyAppName}"
VIAddVersionKey "ProductVersion" "${MyAppVersion}"

!define MUI_ABORTWARNING
!define MUI_ICON "..\public\favicon.ico"
!define MUI_UNICON "..\public\favicon.ico"
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 ${MyAppName}"
!define MUI_WELCOMEPAGE_TEXT "这个本地服务会配合 WordTap.cn 朗读较长的英文文本。建议保持默认选项；安装完成后回到网页，点击“全文朗读”即可使用。"
!define MUI_COMPONENTSPAGE_TEXT_TOP "请选择安装 ${MyAppName} 时要执行的附加任务。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${MyAppExeName}"
!define MUI_FINISHPAGE_RUN_PARAMETERS "--serve"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动全文朗读服务"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "!WordTap Gateway" SEC_MAIN
  SectionIn RO

  IfFileExists "$INSTDIR\${MyAppExeName}" 0 +3
    DetailPrint "正在停止旧版 WordTap Gateway..."
    ExecWait '"$INSTDIR\${MyAppExeName}" --shutdown'

  SetOutPath "$INSTDIR"
  File /oname=${MyAppExeName} "${SourceDir}\${MyAppExeName}"
  File /oname=msedge-tts-LICENSE.txt "..\local-service\wordtap-service\licenses\msedge-tts-MIT.txt"

  Delete "$SMPROGRAMS\WordTap\${MyAppName}.lnk"
  RMDir "$SMPROGRAMS\WordTap"
  CreateShortcut "$SMPROGRAMS\${MyAppName}.lnk" "$INSTDIR\${MyAppExeName}" "--serve" "$INSTDIR\${MyAppExeName}"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKCU "${MyUninstallKey}" "DisplayName" "${MyAppName}"
  WriteRegStr HKCU "${MyUninstallKey}" "DisplayVersion" "${MyAppVersion}"
  WriteRegStr HKCU "${MyUninstallKey}" "Publisher" "${MyAppPublisher}"
  WriteRegStr HKCU "${MyUninstallKey}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${MyUninstallKey}" "DisplayIcon" "$INSTDIR\${MyAppExeName}"
  WriteRegStr HKCU "${MyUninstallKey}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${MyUninstallKey}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegStr HKCU "${MyUninstallKey}" "URLInfoAbout" "https://wordtap.cn"
  WriteRegDWORD HKCU "${MyUninstallKey}" "NoModify" 1
  WriteRegDWORD HKCU "${MyUninstallKey}" "NoRepair" 1
SectionEnd

Section "开机自动启动全文朗读服务" SEC_STARTUP
  WriteRegStr HKCU "${MyStartupKey}" "${MyStartupValue}" '"$INSTDIR\${MyAppExeName}" --serve'
SectionEnd

Function .onInit
  ${GetParameters} $R0
  ${GetOptions} $R0 "/STARTUP=" $R1
  ${IfNot} ${Errors}
    ${If} $R1 == "0"
      SectionSetFlags ${SEC_STARTUP} 0
    ${Else}
      SectionSetFlags ${SEC_STARTUP} ${SF_SELECTED}
    ${EndIf}
  ${EndIf}
FunctionEnd

Function .onInstSuccess
  SectionGetFlags ${SEC_STARTUP} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 == 0
    DeleteRegValue HKCU "${MyStartupKey}" "${MyStartupValue}"
  ${EndIf}
FunctionEnd

Section "Uninstall"
  IfFileExists "$INSTDIR\${MyAppExeName}" 0 +2
    ExecWait '"$INSTDIR\${MyAppExeName}" --shutdown'

  DeleteRegValue HKCU "${MyStartupKey}" "${MyStartupValue}"
  DeleteRegKey HKCU "${MyUninstallKey}"

  Delete "$SMPROGRAMS\${MyAppName}.lnk"
  Delete "$SMPROGRAMS\WordTap\${MyAppName}.lnk"
  RMDir "$SMPROGRAMS\WordTap"

  Delete "$APPDATA\WordTap\installer-token"
  RMDir "$APPDATA\WordTap"

  Delete "$INSTDIR\${MyAppExeName}"
  Delete "$INSTDIR\msedge-tts-LICENSE.txt"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
