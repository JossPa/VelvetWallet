<#
.SYNOPSIS
  Deja entrar al celular: abre en el firewall de Windows los puertos de la demo.

.DESCRIPTION
  Se corre UNA vez, en PowerShell como administrador (clic derecho en
  PowerShell > Ejecutar como administrador), desde la carpeta del proyecto:

      .\abrir_firewall.ps1             crea la regla
      .\abrir_firewall.ps1 -Quitar     la borra (después de la presentación)

  Solo abre los puertos de Velvet (8000 backend, 8001 y 8002 bancos, 8081 app)
  y solo en redes PRIVADAS: en un Wi-Fi público (marcado como Público en
  Windows) siguen cerrados.
#>
param([switch]$Quitar)

$Nombre = "Velvet Wallet (demo)"
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    Write-Host "Hay que correrlo como administrador (clic derecho en PowerShell > Ejecutar como administrador)." -ForegroundColor Red
    exit 1
}

Remove-NetFirewallRule -DisplayName $Nombre -ErrorAction SilentlyContinue
if ($Quitar) {
    Write-Host "Regla '$Nombre' eliminada: los puertos de la demo quedan cerrados." -ForegroundColor Green
    exit 0
}

New-NetFirewallRule -DisplayName $Nombre -Direction Inbound -Action Allow -Protocol TCP `
    -LocalPort 8000, 8001, 8002, 8081 -Profile Private | Out-Null
Write-Host "Listo: puertos 8000, 8001, 8002 y 8081 abiertos en redes privadas." -ForegroundColor Green
Write-Host "Ahora: .\iniciar.cmd -Red"
