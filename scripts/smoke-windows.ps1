$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$installer=Get-ChildItem apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe | Select-Object -First 1
if(!$installer){throw 'NSIS installer not found.'}
$installPath=Join-Path $env:RUNNER_TEMP 'SurveyStudioSmoke'
$previousBrowserArguments=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
$app=$null;$fixture=$null;$ca=$null;$serverCertificate=$null
function Stop-TestApp($process){if($null -ne $process -and !$process.HasExited){$process.CloseMainWindow() | Out-Null;if(!$process.WaitForExit(10000)){$process.Kill()}}}
function Start-TestApp {
 $exe=Get-ChildItem $installPath -Recurse -Filter 'surveystudio-desktop.exe' | Select-Object -First 1
 if(!$exe){throw 'Installed app not found.'}
 $process=Start-Process -FilePath $exe.FullName -PassThru
 for($n=0;$n -lt 45;$n++){Start-Sleep -Seconds 1;$process.Refresh();if($process.HasExited){throw "App exited: $($process.ExitCode)"};if($process.MainWindowHandle -ne 0 -and $process.Responding){$env:NATIVE_APP_PID=[string]$process.Id;return $process}}
 throw 'App did not open a responsive window.'
}
try {
 # Verify upgrade instead of testing only a fresh empty database.
 $oldInstaller=Join-Path $env:RUNNER_TEMP 'SurveyStudio-0.4-setup.exe'
 Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Sarkissian198927/SurveyStudio-Pro/releases/download/v0.4.0-preview.1/SurveyStudio-Pro-0.4.0-Windows-x64-setup.exe' -OutFile $oldInstaller
 if((Get-FileHash $oldInstaller -Algorithm SHA256).Hash.ToLowerInvariant() -ne '957c1eda815af67ad2d9c2e715fe34fdc3636d79aad47a55b70641d8c7f4faeb'){throw 'Previous installer checksum mismatch.'}
 $setup=Start-Process -FilePath $oldInstaller -ArgumentList "/S /D=$installPath" -Wait -PassThru
 if($setup.ExitCode -ne 0){throw 'Previous installation failed.'}
 $app=Start-TestApp
 node scripts/smoke-windows-ui.cjs --seed-old
 if($LASTEXITCODE -ne 0){throw 'Previous-version data preparation failed.'}
 Stop-TestApp $app;$app=$null
 $setup=Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installPath" -Wait -PassThru
 if($setup.ExitCode -ne 0){throw 'Upgrade installation failed.'}
 # Ephemeral local TLS fixture. No production CA/key is bundled or uploaded.
 $testDir=Join-Path $env:RUNNER_TEMP 'surveystudio-tls-fixture';New-Item -ItemType Directory -Force $testDir | Out-Null
 $ca=New-SelfSignedCertificate -Type Custom -Subject "CN=SurveyStudio CI Root $([guid]::NewGuid())" -CertStoreLocation Cert:\CurrentUser\My -KeyUsage CertSign,CRLSign,DigitalSignature -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0') -NotAfter (Get-Date).AddDays(2)
 $serverCertificate=New-SelfSignedCertificate -DnsName localhost -CertStoreLocation Cert:\CurrentUser\My -Signer $ca -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddDays(1)
 $publicRoot=Join-Path $testDir 'root.cer';Export-Certificate -Cert $ca -FilePath $publicRoot | Out-Null;Import-Certificate -FilePath $publicRoot -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
 $env:ONLINE_TEST_PASSWORD=[guid]::NewGuid().ToString('N');$env:ONLINE_TEST_PFX=Join-Path $testDir 'server.pfx';$env:ONLINE_TEST_URL='https://localhost:7443';$env:ONLINE_PORTAL_MARKER=Join-Path $testDir 'portal-opened.txt'
 Export-PfxCertificate -Cert $serverCertificate -FilePath $env:ONLINE_TEST_PFX -Password (ConvertTo-SecureString $env:ONLINE_TEST_PASSWORD -AsPlainText -Force) -CryptoAlgorithmOption AES256_SHA256 -ChainOption BuildChain | Out-Null
 $fixture=Start-Process -FilePath node -ArgumentList 'scripts/windows-online-fixture.cjs' -PassThru -RedirectStandardOutput (Join-Path $testDir 'server.log') -RedirectStandardError (Join-Path $testDir 'server-error.log')
 Start-Sleep -Seconds 2
 if($fixture.HasExited){throw 'Local HTTPS fixture failed to start.'}
 $edgePolicy='HKCU:\Software\Policies\Microsoft\Edge';New-Item -Path $edgePolicy -Force | Out-Null;New-ItemProperty -Path $edgePolicy -Name HideFirstRunExperience -Value 1 -PropertyType DWord -Force | Out-Null
 $app=Start-TestApp
 node scripts/smoke-windows-ui.cjs
 if($LASTEXITCODE -ne 0){throw 'Native Windows functional checks failed.'}
 Write-Output 'Upgrade, persistence, sidebar navigation, survey creation, real Save dialog and verified HTTPS/browser connection passed.'
} finally {
 Stop-TestApp $app
 if($null -ne $fixture -and !$fixture.HasExited){$fixture.Kill()}
 if($null -ne $ca){Remove-Item "Cert:\CurrentUser\Root\$($ca.Thumbprint)" -ErrorAction SilentlyContinue;Remove-Item "Cert:\CurrentUser\My\$($ca.Thumbprint)" -ErrorAction SilentlyContinue}
 if($null -ne $serverCertificate){Remove-Item "Cert:\CurrentUser\My\$($serverCertificate.Thumbprint)" -ErrorAction SilentlyContinue}
 $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$previousBrowserArguments
}
