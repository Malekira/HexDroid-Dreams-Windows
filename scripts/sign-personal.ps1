#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [ValidateSet('Create', 'Trust', 'Sign', 'Verify')]
    [string]$Action = 'Sign',
    [string]$FilePath,
    [string]$TimestampServer
)
$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'HexDroidDreams-Signing'
$stateFile = Join-Path $stateDirectory 'certificate.json'

function Get-PersonalCertificate {
    if (-not (Test-Path -LiteralPath $stateFile)) { throw 'Primero ejecuta la accion Create.' }
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($state.thumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Identificador de certificado no valido.' }
    $certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$($state.thumbprint)" -ErrorAction Stop
    if (-not $certificate.HasPrivateKey) { throw 'El certificado no tiene su clave privada en este equipo.' }
    if ($Action -ne 'Verify' -and $certificate.NotAfter -le (Get-Date)) { throw 'El certificado ha caducado.' }
    if (-not ($certificate.EnhancedKeyUsageList | Where-Object { ([string]$_.ObjectId -eq '1.3.6.1.5.5.7.3.3' -or $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3') })) {
        throw 'El certificado no es de firma de codigo.'
    }
    return $certificate
}

if ($Action -eq 'Create') {
    if (Test-Path -LiteralPath $stateFile) {
        $certificate = Get-PersonalCertificate
        Write-Host "Se conserva el certificado existente: $($certificate.Thumbprint)"
        return
    }
    if (-not $PSCmdlet.ShouldProcess('Cert:\CurrentUser\My', 'Crear certificado personal con clave no exportable')) { return }
    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    $certificate = New-SelfSignedCertificate -Type CodeSigningCert `
        -Subject 'CN=HexDroid Dreams - uso personal' -FriendlyName 'HexDroid Dreams - firma personal' `
        -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 3072 `
        -HashAlgorithm SHA256 -KeyExportPolicy NonExportable `
        -Provider 'Microsoft Software Key Storage Provider' -NotAfter (Get-Date).AddYears(3)
    @{ thumbprint = $certificate.Thumbprint } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    Write-Host "Certificado creado: $($certificate.Thumbprint)"
    Write-Host 'La clave privada permanece en el almacen de tu usuario de Windows. No se genera ningun PFX.'
    return
}

$certificate = Get-PersonalCertificate
if ($Action -eq 'Trust') {
    Write-Host "Huella: $($certificate.Thumbprint)"
    Write-Host 'Esto confiara en tu certificado para tu usuario de Windows, tambien para otros archivos que firmes con el.'
    if (-not $PSCmdlet.ShouldProcess($certificate.Thumbprint, 'Confiar en este certificado en Root y TrustedPublisher del usuario')) { return }
    foreach ($name in @('Root', 'TrustedPublisher')) {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($name, 'CurrentUser')
        try {
            $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
            # Import only public bytes. The private key stays exclusively in CurrentUser\My.
            $public = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(,$certificate.RawData)
            $store.Add($public)
        } finally { $store.Close() }
    }
    Write-Host 'Confianza instalada solo para tu usuario. No se han cambiado las protecciones de Defender.'
    return
}

# Resolve defaults in the script body, never during parameter binding (-File).
if ([string]::IsNullOrWhiteSpace($FilePath)) {
    $besideScript = Join-Path $PSScriptRoot 'HexDroidDreams.exe'
    if (Test-Path -LiteralPath $besideScript) { $FilePath = $besideScript }
    else { $FilePath = Join-Path $PSScriptRoot '..\dist\HexDroidDreams-win32-x64\HexDroidDreams.exe' }
}
$resolved = (Resolve-Path -LiteralPath $FilePath).Path
if ([IO.Path]::GetFileName($resolved) -ine 'HexDroidDreams.exe') { throw 'Selecciona el archivo HexDroidDreams.exe de la carpeta extraida.' }
if ($Action -eq 'Sign') {
    if (-not $PSCmdlet.ShouldProcess($resolved, 'Firmar el ejecutable con tu certificado personal')) { return }
    $parameters = @{ LiteralPath = $resolved; Certificate = $certificate; HashAlgorithm = 'SHA256' }
    if ($TimestampServer) {
        if ($TimestampServer -notmatch '^https?://[^\s]+$') { throw 'Direccion de sello de tiempo no valida.' }
        $parameters.TimestampServer = $TimestampServer
    }
    $signature = Set-AuthenticodeSignature @parameters
} else { $signature = Get-AuthenticodeSignature -LiteralPath $resolved }

if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) {
    throw "La firma no corresponde a tu certificado personal. Estado: $($signature.Status) - $($signature.StatusMessage)"
}
if ($signature.Status -ne 'Valid') {
    throw "La firma no es valida para este usuario: $($signature.Status) - $($signature.StatusMessage). Si falta confianza, ejecuta Trust y vuelve a verificar."
}
Write-Host "Firma valida: $resolved"
Write-Host "Huella del firmante: $($certificate.Thumbprint)"
if (-not $signature.TimeStamperCertificate) {
    Write-Host 'Sin sello de tiempo: vuelve a firmar antes de que caduque el certificado.'
}
Write-Host 'Esta firma cubre el EXE; no autentica por separado app.asar, DLL ni otros archivos de la carpeta.'
Write-Host 'La firma personal no garantiza evitar bloqueos ASR o SmartScreen por reputacion.'
