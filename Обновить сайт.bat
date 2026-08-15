@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   OBNOVLENIE SAYTA - Svechi Masya
echo   https://rutasha2809-creator.github.io/svechi-masya/
echo ============================================

echo.
echo === Step 0: Check git ===
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git ne ustanovlen.
    echo Skachayte: https://git-scm.com/download/win
    echo Ustanovite s nastroykami po umolchaniyu i zapustite etot fayl snova.
    pause
    exit /b 1
)
echo OK

echo.
echo === Step 1: Setup (bezopasno zapuskat kazhdyy raz) ===
if not exist ".git" (
    git init
    git branch -M main
    echo Repozitoriy sozdan
)
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    git remote add origin https://github.com/rutasha2809-creator/svechi-masya.git
    echo Remote origin dobavlen
)
git config user.name "rutasha2809-creator"
git config user.email "rutasha2809-creator@users.noreply.github.com"
git config core.quotepath false
git config i18n.commitEncoding utf-8
git rev-parse --verify HEAD >nul 2>&1
if %errorlevel% neq 0 (
    echo Pervyy zapusk - zabiraem to, chto uzhe na GitHub...
    git fetch origin
    if %errorlevel% neq 0 (
        echo ERROR: net svyazi s GitHub. Proverte internet.
        pause
        exit /b 1
    )
    git reset --mixed origin/main
)
echo OK

echo.
echo === Step 2: Remove git lock files ===
if exist ".git\index.lock" (
    del /f ".git\index.lock"
    echo Done: index.lock removed
) else (
    echo OK: no index.lock found
)
if exist ".git\HEAD.lock" (
    del /f ".git\HEAD.lock"
    echo Done: HEAD.lock removed
) else (
    echo OK: no HEAD.lock found
)

echo.
echo === Step 3: Stage all changes ===
git add -A
if %errorlevel% neq 0 (
    echo ERROR: git add ne otrabotal - smotrite soobshchenie vyshe
    pause
    exit /b 1
)
git status --short
echo Done

echo.
echo === Step 4: Commit ===
git commit -m "Update site"
if %errorlevel% neq 0 ( echo Nothing new to commit, pushing existing commits... )

echo.
echo === Step 5: Pull remote changes ===
git pull --rebase origin main
if %errorlevel% neq 0 (
    echo ERROR: konflikt s versiey na GitHub.
    echo Otmenit obedinenie: git rebase --abort
    pause
    exit /b 1
)

echo.
echo === Step 6: Push to GitHub ===
git push origin HEAD:main
if %errorlevel% neq 0 (
    echo ERROR at push - check internet/GitHub credentials
    echo Esli otkrylos okno vhoda v GitHub - voydite i zapustite fayl snova.
    pause
    exit /b 1
)

echo.
echo === DONE! Podozhdite ~1 minutu, potom otkroyte sayt ===
echo https://rutasha2809-creator.github.io/svechi-masya/
echo Esli vidite staruyu versiyu - nazhmite Ctrl+Shift+R
pause
