@echo off
rem Presentacion: muestra la pantalla del celular en el PC (scrcpy) y conecta
rem la app al servidor del PC POR EL CABLE USB (adb reverse), sin depender del
rem Wi-Fi ni del firewall. En la app: Servidor = localhost:8000.
rem Antes: .\iniciar.cmd   (sin -Red). Celular por USB con depuracion USB.
where scrcpy >nul 2>nul || (echo Falta scrcpy:  winget install Genymobile.scrcpy & pause & exit /b 1)
adb reverse tcp:8000 tcp:8000 >nul && adb reverse tcp:8001 tcp:8001 >nul && adb reverse tcp:8002 tcp:8002 >nul
if errorlevel 1 (echo No veo el celular. Revisa el cable y la depuracion USB, y acepta el aviso en el celular. & pause & exit /b 1)
echo Conexion por USB lista (8000, 8001, 8002).
scrcpy --always-on-top --window-title "Velvet Wallet" %*
