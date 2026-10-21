# Setup Windows Scheduled Task for database backup
# Run this as Administrator once

$TaskName = "NaySystem-DB-Backup"
$ScriptPath = Join-Path $PSScriptRoot "backup-db.mjs"
$NodePath = "C:\Program Files\nodejs\node.exe"
$WorkingDir = Split-Path -Parent $PSScriptRoot

# Test if node exists
if (-not (Test-Path $NodePath)) {
    $NodePath = (Get-Command node).Source
}

Write-Host "Node: $NodePath"
Write-Host "Script: $ScriptPath"
Write-Host "Working Dir: $WorkingDir"

# Remove existing task if any
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Task lama dihapus"
}

# Create backup script runner (batch file for simpler scheduling)
$BatContent = @"
@echo off
cd /d "$WorkingDir"
"$NodePath" "$ScriptPath"
"@

$BatPath = Join-Path $PSScriptRoot "run-backup.bat"
Set-Content -Path $BatPath -Value $BatContent -Encoding ASCII

# Create scheduled task - runs every 2 hours
$Action = New-ScheduledTaskAction -Execute $BatPath
$Trigger = New-ScheduledTaskTrigger -Daily -At "06:00" -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 365)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Backup database Nay System setiap 2 jam"

Write-Host "`nTask '$TaskName' berhasil dibuat!"
Write-Host "Jadwal: Setiap 2 jam (06:00 - 23:59)"
Write-Host "Untuk mengubah jadwal, jalankan:"
Write-Host "  Set-ScheduledTask -TaskName '$TaskName' -Trigger (New-ScheduledTaskTrigger -Daily -At '08:00' -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 365))"
Write-Host "`nUntuk test langsung:"
Write-Host "  node `"$ScriptPath`""
