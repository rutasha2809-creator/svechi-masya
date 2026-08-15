@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   ОБНОВЛЕНИЕ САЙТА "Свечи Мася"
echo   https://rutasha2809-creator.github.io/svechi-masya/
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo   [!] Git не установлен.
  echo.
  echo   Скачайте его здесь: https://git-scm.com/download/win
  echo   Установите со всеми настройками по умолчанию,
  echo   затем запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo   Первый запуск. Подключаю папку к GitHub...
  git init >nul 2>&1
  git branch -M main >nul 2>&1
  git remote add origin https://github.com/rutasha2809-creator/svechi-masya.git >nul 2>&1
  git config user.name "rutasha2809-creator"
  git config user.email "rutasha2809-creator@users.noreply.github.com"
  git config core.quotepath false
  git config i18n.commitEncoding utf-8
  echo   Забираю то, что уже лежит на GitHub...
  git fetch origin
  if errorlevel 1 goto :nonet
  git reset --mixed origin/main >nul
  git branch --set-upstream-to=origin/main main >nul 2>&1
  echo   Папка подключена.
  echo.
)

echo   Смотрю, что изменилось...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo   Изменений нет. На сайте уже свежая версия.
  goto :done
)

echo.
git diff --cached --name-status
echo.
git commit -m "Обновление сайта %date% %time%" >nul
if errorlevel 1 goto :err

echo   Забираю правки с GitHub, если они были...
git pull --rebase origin main
if errorlevel 1 goto :conflict

echo   Отправляю на GitHub...
git push origin main
if errorlevel 1 goto :err

echo.
echo   ГОТОВО. Сайт обновится в течение минуты:
echo   https://rutasha2809-creator.github.io/svechi-masya/
goto :done

:nonet
echo.
echo   [!] Не получилось связаться с GitHub.
echo   Проверьте интернет. Если открылось окно входа - войдите
echo   в свою учётную запись GitHub и запустите файл снова.
goto :done

:conflict
echo.
echo   [!] На GitHub есть правки, которые конфликтуют с локальными.
echo   Ничего не сломалось, но разобрать нужно вручную.
echo   Отменить объединение: git rebase --abort
goto :done

:err
echo.
echo   [!] Что-то пошло не так - смотрите сообщение выше.
echo   Если это первый запуск, могло открыться окно входа в GitHub:
echo   войдите и запустите файл снова.

:done
echo.
pause
