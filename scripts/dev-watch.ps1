# Starts Chanlume's local automatic extension reload watcher in the foreground.
# Stop with Ctrl+C, or -Stop for a watcher launched in a hidden window.
# Does not change Helium profiles, extension IDs, or groups.
param([switch]$Stop)
$ErrorActionPreference = "Stop"
$devRepo = Split-Path -Parent $PSScriptRoot
$devScript = Join-Path $devRepo "scripts\dev-watch.cjs"
$devMarker = Join-Path $devRepo "extension\dev-reload.json"
if ($Stop) {
  $marker = Get-Content -LiteralPath $devMarker -Raw | ConvertFrom-Json
  if ($marker.chanlumeDevWatch -ne $true) { Write-Output "Chanlume watcher is already disabled."; exit 0 }
  $watcherPid = [int]$marker.pid
  if ($watcherPid -le 0) { throw "Missing watcher PID; refusing to stop an unknown process." }
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $watcherPid"
  if ($running) {
    if (-not $running.CommandLine -or $running.CommandLine.IndexOf($devScript, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "PID $watcherPid is not this repository's Chanlume watcher; refusing to stop it."
    }
    Stop-Process -Id $watcherPid -ErrorAction Stop
    Start-Sleep -Milliseconds 300
  } elseif ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $marker.updatedAt -lt 20000) {
    throw "Watcher PID $watcherPid is missing, but its marker is still fresh; refusing to clear it."
  }
  $latest = Get-Content -LiteralPath $devMarker -Raw | ConvertFrom-Json
  if ($latest.chanlumeDevWatch -eq $true -and $latest.pid -eq $watcherPid) {
    [System.IO.File]::WriteAllText($devMarker, '{"chanlumeDevWatch":false,"revision":"","updatedAt":0}' + "`n", (New-Object System.Text.UTF8Encoding($false)))
  }
  Write-Output "Chanlume watcher PID $watcherPid stopped; its development marker is disabled."
  exit 0
}
$devNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($devNode) {
  $devNodePath = $devNode.Source
} elseif ($env:CODEX_PRIMARY_RUNTIME_NODE -and (Test-Path -LiteralPath $env:CODEX_PRIMARY_RUNTIME_NODE)) {
  $devNodePath = $env:CODEX_PRIMARY_RUNTIME_NODE
} else {
  $devNodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}
if (-not (Test-Path -LiteralPath $devNodePath)) {
  throw "Node.js not found. Install Node.js or configure CODEX_PRIMARY_RUNTIME_NODE."
}
& $devNodePath $devScript
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
