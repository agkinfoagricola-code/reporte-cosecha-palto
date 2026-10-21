$startupFolder = [Environment]::GetFolderPath('Startup')
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut((Join-Path $startupFolder 'Sincronizador Produccion.lnk'))
$shortcut.TargetPath = Join-Path $PSScriptRoot 'INICIAR.cmd'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Save()
Write-Host 'Se abrirá el sincronizador al iniciar sesión en Windows. Ingrese su usuario y contraseña en esa ventana.'
Write-Host 'Para desactivar: Win+R, shell:startup, elimine Sincronizador Produccion.'
