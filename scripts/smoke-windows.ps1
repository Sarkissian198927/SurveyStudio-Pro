$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe | Select-Object -First 1
if (!$installer) { throw 'NSIS installer not found.' }
$installPath = Join-Path $env:RUNNER_TEMP 'SurveyStudioSmoke'
$setup = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installPath" -PassThru -Wait
if ($setup.ExitCode -ne 0) { throw "Installation failed: $($setup.ExitCode)" }
$exe = Get-ChildItem $installPath -Recurse -Filter 'surveystudio-desktop.exe' | Select-Object -First 1
if (!$exe) { throw 'Installed application executable not found.' }
$previousBrowserArguments=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
$app = Start-Process -FilePath $exe.FullName -PassThru
try {
  $opened = $false
  for ($i=0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    $app.Refresh()
    if ($app.HasExited) { throw "Application exited unexpectedly: $($app.ExitCode)" }
    if ($app.MainWindowHandle -ne 0 -and $app.Responding) { $opened=$true; break }
  }
  if (!$opened) { throw 'No responsive application window appeared.' }
  Start-Sleep -Seconds 5
  $app.Refresh()
  if ($app.HasExited -or !$app.Responding) { throw 'Application did not remain responsive.' }
  node scripts/smoke-windows-ui.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Native Windows questionnaire workflow failed.' }
  Write-Output 'NSIS installation, responsive window and native questionnaire workflow passed.'
} finally {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$previousBrowserArguments
  if (!$app.HasExited) { $app.CloseMainWindow() | Out-Null; if (!$app.WaitForExit(10000)) { $app.Kill() } }
}
