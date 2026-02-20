# === 1) Prüfen: Wer nutzt Port 3000? ===
Write-Host "`n=== CHECK Port 3000 ===" -ForegroundColor Cyan
$tcp = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($tcp) {
  $pids = $tcp | Select-Object -Expand OwningProcess -Unique
  Write-Host "Port 3000 ist belegt von PID(s): $($pids -join ', ')" -ForegroundColor Yellow
  foreach ($pid in $pids) {
    try {
      $p = Get-Process -Id $pid -ErrorAction Stop
      Write-Host (" - PID {0}: {1}" -f $pid, $p.Path) -ForegroundColor Yellow
    } catch {}
  }

  Write-Host "`n=== KILL Prozesse auf Port 3000 ===" -ForegroundColor Cyan
  foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
} else {
  Write-Host "Port 3000 ist frei." -ForegroundColor Green
}

# === 2) Server starten (mit Logs) ===
Write-Host "`n=== START Server (logs) ===" -ForegroundColor Cyan
Remove-Item ".\server.out.log",".\server.err.log" -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath "node" -ArgumentList ".\src\server.js" -PassThru -NoNewWindow `
  -RedirectStandardOutput ".\server.out.log" -RedirectStandardError ".\server.err.log"
Write-Host "Node gestartet (PID $($proc.Id))." -ForegroundColor Green

Start-Sleep -Seconds 2

# === 3) Logs anzeigen (falls Server sofort crasht) ===
Write-Host "`n--- server.err.log (tail 80) ---" -ForegroundColor Yellow
if (Test-Path ".\server.err.log") { Get-Content ".\server.err.log" -Tail 80 }

Write-Host "`n--- server.out.log (tail 80) ---" -ForegroundColor Yellow
if (Test-Path ".\server.out.log") { Get-Content ".\server.out.log" -Tail 80 }

# === 4) Quick Check /health ===
Write-Host "`n=== TEST /health ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "OK /health => $($r.StatusCode)  $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "FAIL /health: $($_.Exception.Message)" -ForegroundColor Red
}

# === 5) Test POST /v1/usage/increment ===
Write-Host "`n=== TEST POST /v1/usage/increment ===" -ForegroundColor Cyan
try {
  $body = @{ subscription_id = "demo123"; amount = 1 } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "http://localhost:3000/v1/usage/increment" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 5
  Write-Host "OK increment => $($r.StatusCode)  $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "FAIL increment: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "`n--- server.err.log (tail 120) ---" -ForegroundColor Yellow
  if (Test-Path ".\server.err.log") { Get-Content ".\server.err.log" -Tail 120 }
}
