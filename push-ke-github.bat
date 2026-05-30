@echo off
echo ========================================
echo   Push ke GitHub (untuk Fly.io)
echo ========================================
echo.

cd /d "%~dp0"

echo Menambahkan file yang berubah...
git add .

echo.
echo Membuat commit...
git commit -m "Add Dockerfile, fly.toml, and .dockerignore for Fly.io"

echo.
echo Mengirim ke GitHub...
git push

echo.
echo ========================================
echo   Selesai! 
echo   Sekarang kembali ke Fly.io dashboard.
echo ========================================
echo.
pause