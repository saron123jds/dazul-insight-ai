@echo off
title Dazul Insight AI

cd /d "%~dp0"

echo ==========================================
echo DAZUL INSIGHT AI
echo ==========================================

call npm install

call npm start

pause
