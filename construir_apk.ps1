<#
.SYNOPSIS
  Construye la APK de Velvet Wallet para instalar en un celular Android.

.DESCRIPTION
  La APK habla con el backend que corre en ESTE PC (iniciar.cmd -Red). Para
  eso trae fijada la IP que el PC tiene ahora en el Wi-Fi. Si después cambia,
  no hace falta recompilar: en la app, pantalla de inicio de sesión,
  "Servidor · cambiar".

  Necesita Java 17 y el Android SDK (ya instalados en este PC). La primera
  compilación tarda 10-20 minutos (Gradle baja sus dependencias); las
  siguientes, un par de minutos.

  Uso (desde la carpeta del proyecto):
      .\construir_apk.cmd                         IP detectada sola
      .\construir_apk.cmd -Servidor 192.168.1.5   otra IP o dirección

  Resultado: VelvetWallet.apk en la carpeta del proyecto.
#>
[CmdletBinding()]
param([string]$Servidor = "")

$ErrorActionPreference = "Stop"
$Raiz = $PSScriptRoot
$Movil = Join-Path $Raiz "movil"

function Paso($texto)  { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok($texto)    { Write-Host "    $texto" -ForegroundColor Green }
function Falla($texto) { Write-Host ""; Write-Host "ERROR: $texto" -ForegroundColor Red; exit 1 }

# ── Herramientas ────────────────────────────────────────────────────────────
Paso "Herramientas"
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    $jdk = Get-ChildItem "C:\Program Files\Microsoft" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $jdk) { Falla "Falta Java 17:  winget install Microsoft.OpenJDK.17" }
    $env:JAVA_HOME = $jdk.FullName
}
Ok "Java: $env:JAVA_HOME"
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path (Join-Path $env:ANDROID_HOME "platforms"))) { Falla "Falta el Android SDK en $env:ANDROID_HOME" }
Ok "Android SDK: $env:ANDROID_HOME"

# ── Dirección del backend que queda dentro de la APK ────────────────────────
Paso "Servidor"
if (-not $Servidor) {
    $Servidor = Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
        ForEach-Object { $_.IPv4Address.IPAddress } |
        Select-Object -First 1
    if (-not $Servidor) { Falla "No encontré una red con salida. Conéctate al Wi-Fi o usa -Servidor <IP>." }
}
if ($Servidor -notmatch "^https?://") { $Servidor = "http://$Servidor" }
if ($Servidor -notmatch ":\d+$" -and $Servidor -notmatch "^https://") { $Servidor = "${Servidor}:8000" }
$env:EXPO_PUBLIC_API_URL = $Servidor
Ok "La APK se conectará a $Servidor"

# ── Proyecto Android nativo y compilación ───────────────────────────────────
Push-Location $Movil
try {
    Paso "Generando el proyecto Android (expo prebuild)"
    & npx expo prebuild --platform android --clean --no-install
    if ($LASTEXITCODE -ne 0) { Falla "expo prebuild falló." }

    Paso "Compilando (Gradle). La primera vez tarda bastante..."
    Push-Location android
    # Solo procesadores de celulares reales (ARM): la APK queda mucho más liviana.
    & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a" --no-daemon
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { Falla "Gradle no pudo compilar (mira el mensaje de arriba)." }
} finally {
    Pop-Location
}

$Apk = Join-Path $Movil "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $Apk)) { Falla "No encontré la APK en $Apk" }
$Destino = Join-Path $Raiz "VelvetWallet.apk"
Copy-Item $Apk $Destino -Force
$mb = [math]::Round((Get-Item $Destino).Length / 1MB, 1)

Paso "Listo"
Ok "APK: $Destino ($mb MB)"
Write-Host "    Pásala al celular (cable, Drive, WhatsApp...) e instálala."
Write-Host "    Android pedirá permitir 'instalar apps de origen desconocido'."
Write-Host "    Antes de abrirla, en este PC:  .\iniciar.cmd -Red"
