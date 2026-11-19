# Cria (ou recria) o atalho "Ficha de RPG" na Área de Trabalho.
# Rode de novo sempre que mover a pasta do projeto:
#   clique direito neste arquivo > "Executar com o PowerShell"

$ErrorActionPreference = 'Stop'

# Procura um navegador com "modo aplicativo" (janela própria, sem barra de endereço)
$appPaths = @(
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
)
$browser = foreach ($exe in 'msedge.exe', 'chrome.exe', 'brave.exe') {
  foreach ($key in $appPaths) {
    $item = Get-ItemProperty "$key\$exe" -ErrorAction SilentlyContinue
    if ($item -and (Test-Path $item.'(default)')) { $item.'(default)'.Trim('"') }
  }
}
$browser = $browser | Select-Object -First 1
if (-not $browser) { throw 'Instale o Edge, Chrome ou Brave para usar o atalho.' }

$page = Join-Path $PSScriptRoot 'index.html'
$url = ([System.Uri]$page).AbsoluteUri
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ficha de RPG.lnk'

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = $browser
$shortcut.Arguments = "--app=`"$url`" --window-size=1280,860"
$shortcut.IconLocation = Join-Path $PSScriptRoot 'icons\ficha.ico'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'Abrir a Ficha de RPG'
$shortcut.Save()

Write-Host "Atalho criado: $shortcutPath"
Write-Host "Navegador: $browser"
