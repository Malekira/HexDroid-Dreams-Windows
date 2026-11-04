# HexDroid Dreams para Windows x64

Cliente de escritorio nativo basado en el motor IRC y de scripts de HexDroid. GPL-3.0-or-later; créditos originales de boxlabs preservados.

[Funciones, instalación, pruebas y límites](../docs/DREAMS_DESKTOP_WINDOWS.md).

Desde la raíz del repositorio, con JDK 21 en Windows:

```powershell
./gradlew.bat -p desktop test uiTest windowsTest
./gradlew.bat -p desktop packageMsi
```

GitHub Actions prepara WiX y publica el MSI con Java incluido. Los datos se guardan aparte en `%LOCALAPPDATA%\HexDroidDreamsData`. El instalador no requiere herramientas de desarrollo en el equipo del usuario.
