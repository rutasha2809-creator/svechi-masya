@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   PROVERKA PRILOZHENIYA - Svechi Masya
echo ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo OSHIBKA: Node.js ne ustanovlen.
    echo.
    echo Skachayte s https://nodejs.org - knopka LTS,
    echo ustanovite s nastroykami po umolchaniyu,
    echo zakroyte eto okno i zapustite fayl snova.
    echo.
    pause
    exit /b 1
)

if not exist "tests\run-all.js" (
    echo OSHIBKA: ne naydena papka tests ryadom s etim faylom.
    echo Fayl dolzhen lezhat v papke proekta, tam zhe gde index.html
    echo.
    pause
    exit /b 1
)

if not exist "index.html" (
    echo OSHIBKA: ne nayden index.html v etoy papke.
    echo.
    pause
    exit /b 1
)

node "tests\run-all.js"
set RESULT=%errorlevel%

echo.
if %RESULT% neq 0 (
    echo ============================================
    echo   EST OSHIBKI - na sayt vykladyvat ne nado
    echo ============================================
) else (
    echo ============================================
    echo   VSE V PORYADKE - mozhno vykladyvat
    echo ============================================
)
echo.
pause
exit /b %RESULT%
