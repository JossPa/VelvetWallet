@echo off
rem Construye la APK de Velvet Wallet. Ver construir_apk.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0construir_apk.ps1" %*
