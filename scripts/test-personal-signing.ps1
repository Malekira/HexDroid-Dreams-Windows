#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'sign-personal.ps1'
$directory = Join-Path ([IO.Path]::GetTempPath()) ('dreams-signing-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $directory | Out-Null
$originalLocal = $env:LOCALAPPDATA
$env:LOCALAPPDATA = $directory
$thumbprint = $null
try {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) { throw ($errors | Out-String) }
    & $script -Action Create -Confirm:$false
    $state = Get-Content (Join-Path $directory 'HexDroidDreams-Signing\certificate.json') -Raw | ConvertFrom-Json
    $thumbprint = $state.thumbprint
    & $script -Action Create -Confirm:$false
    $again = Get-Content (Join-Path $directory 'HexDroidDreams-Signing\certificate.json') -Raw | ConvertFrom-Json
    if ($again.thumbprint -ne $thumbprint) { throw 'Create replaced the existing identity.' }
    $certificate = Get-Item "Cert:\CurrentUser\My\$thumbprint"
    if ($certificate.PrivateKey -and $certificate.PrivateKey.CspKeyContainerInfo.Exportable) { throw 'Private key is exportable.' }
    $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($certificate)
    try {
        if ($rsa -is [System.Security.Cryptography.RSACng] -and $rsa.Key.ExportPolicy -ne [System.Security.Cryptography.CngExportPolicies]::None) { throw 'CNG private key is exportable.' }
    } finally { $rsa.Dispose() }
    & $script -Action Trust -Confirm:$false
    foreach ($store in @('Root','TrustedPublisher')) {
        if ((Get-Item "Cert:\CurrentUser\$store\$thumbprint").HasPrivateKey) { throw 'A trust store contains a private key.' }
    }
    $exe = Join-Path $directory 'HexDroidDreams.exe'
    Copy-Item "$env:WINDIR\System32\where.exe" $exe
    & $script -Action Sign -FilePath $exe -Confirm:$false
    & $script -Action Verify -FilePath $exe
    $signature = Get-AuthenticodeSignature -LiteralPath $exe
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $thumbprint) { throw 'Authenticode verification failed.' }
    $bytes = [IO.File]::ReadAllBytes($exe)
    $nt = [BitConverter]::ToInt32($bytes, 60)
    $optionalSize = [BitConverter]::ToUInt16($bytes, $nt + 20)
    $section = $nt + 24 + $optionalSize
    $raw = [BitConverter]::ToInt32($bytes, $section + 20)
    $bytes[$raw + 16] = $bytes[$raw + 16] -bxor 1
    [IO.File]::WriteAllBytes($exe, $bytes)
    $rejected = $false
    try { & $script -Action Verify -FilePath $exe } catch { $rejected = $true }
    if (-not $rejected) { throw 'A modified executable was accepted.' }
    Write-Host 'PASS: non-exportable identity, explicit user trust, Authenticode SHA256, reuse and tamper rejection.'
} finally {
    if ($thumbprint) {
        foreach ($store in @('Root','TrustedPublisher')) { Remove-Item "Cert:\CurrentUser\$store\$thumbprint" -ErrorAction SilentlyContinue }
        Remove-Item "Cert:\CurrentUser\My\$thumbprint" -DeleteKey -ErrorAction SilentlyContinue
    }
    $env:LOCALAPPDATA = $originalLocal
    Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue
}
