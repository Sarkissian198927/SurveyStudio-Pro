param([switch]$Cleanup)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$ConfirmPreference='None'
if($Cleanup){
 foreach($name in @('ONLINE_TEST_CA_THUMBPRINT','ONLINE_TEST_LEAF_THUMBPRINT')){
  $thumbprint=[Environment]::GetEnvironmentVariable($name)
  if($thumbprint -match '^[A-Fa-f0-9]{40}$'){
   foreach($store in @('My','Root')){Remove-Item "Cert:\CurrentUser\$store\$thumbprint" -Force -Confirm:$false -ErrorAction SilentlyContinue}
   Remove-Item "Cert:\LocalMachine\Root\$thumbprint" -Force -Confirm:$false -ErrorAction SilentlyContinue
  }
 }
 return
}
function Export-TestEnvironment($name,$value){
 [Environment]::SetEnvironmentVariable($name,$value,'Process')
 [System.IO.File]::AppendAllText($env:GITHUB_ENV,"$name=$value`n",[System.Text.UTF8Encoding]::new($false))
}
$testDir=Join-Path $env:RUNNER_TEMP 'surveystudio-tls-fixture';New-Item -ItemType Directory -Force $testDir | Out-Null
Write-Output 'Creating short-lived local TLS test authority.'
$ca=New-SelfSignedCertificate -Type Custom -Subject "CN=SurveyStudio CI Root $([guid]::NewGuid())" -CertStoreLocation Cert:\CurrentUser\My -KeyUsage CertSign,CRLSign,DigitalSignature -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0') -NotAfter (Get-Date).AddDays(2)
Export-TestEnvironment 'ONLINE_TEST_CA_THUMBPRINT' $ca.Thumbprint
$publicRoot=Join-Path $testDir 'root.cer';Export-Certificate -Cert $ca -FilePath $publicRoot | Out-Null
# Hosted Windows runners are disposable administrators. The CurrentUser protected
# root store requires a desktop confirmation even with -f; machine Root is unattended.
Write-Output 'Trusting the short-lived CA in the disposable runner machine store.'
$importOutput=certutil.exe -f -addstore Root $publicRoot 2>&1
if($LASTEXITCODE -ne 0){throw ('Test root certificate import failed: '+($importOutput -join "`n"))}
if(!(Test-Path "Cert:\LocalMachine\Root\$($ca.Thumbprint)")){throw 'Test root certificate missing from machine store.'}
Write-Output 'Creating localhost server certificate.'
$leaf=New-SelfSignedCertificate -DnsName localhost -CertStoreLocation Cert:\CurrentUser\My -Signer $ca -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddDays(1)
Export-TestEnvironment 'ONLINE_TEST_LEAF_THUMBPRINT' $leaf.Thumbprint
$password=[guid]::NewGuid().ToString('N');$pfx=Join-Path $testDir 'server.pfx'
Export-PfxCertificate -Cert $leaf -FilePath $pfx -Password (ConvertTo-SecureString $password -AsPlainText -Force) -CryptoAlgorithmOption AES256_SHA256 -ChainOption EndEntityCertOnly | Out-Null
# This password/private fixture stays in RUNNER_TEMP, never in GitHub environment logs or release artifacts.
[System.IO.File]::WriteAllText((Join-Path $testDir 'password.txt'),$password,[System.Text.UTF8Encoding]::new($false))
Export-TestEnvironment 'ONLINE_TEST_DIRECTORY' $testDir
Export-TestEnvironment 'ONLINE_TEST_PFX' $pfx
Export-TestEnvironment 'ONLINE_TEST_URL' 'https://localhost:7443'
Export-TestEnvironment 'ONLINE_PORTAL_MARKER' (Join-Path $testDir 'portal-opened.txt')
Write-Output 'Local TLS fixture prepared; certificate verification remains enabled.'
