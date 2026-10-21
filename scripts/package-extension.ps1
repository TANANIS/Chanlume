$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $projectRoot 'extension'
$mirror = Join-Path $projectRoot 'outputs\extension'
$devMarker = Get-Content -LiteralPath (Join-Path $source 'dev-reload.json') -Raw | ConvertFrom-Json
if ($devMarker.chanlumeDevWatch -eq $true) {
  throw 'Stop scripts/dev-watch.ps1 before packaging; an enabled developer reload marker must never ship.'
}
$version = (Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json).version
$archivePath = Join-Path $projectRoot ("outputs\Chanlume-$version.zip")
if (Test-Path -LiteralPath $archivePath) { throw "Version package already exists: $archivePath" }

$excluded = @('dev-reload.json', 'content\dev-reload.js')
$files = @(Get-ChildItem -LiteralPath $source -File -Recurse | Where-Object {
  $relative = $_.FullName.Substring($source.Length + 1)
  $excluded -notcontains $relative
} | Sort-Object FullName)
$sourcePaths = @{}
foreach ($file in $files) { $sourcePaths[$file.FullName.Substring($source.Length + 1)] = $true }
foreach ($old in (Get-ChildItem -LiteralPath $mirror -File -Recurse)) {
  $relative = $old.FullName.Substring($mirror.Length + 1)
  if (-not $sourcePaths.ContainsKey($relative)) { throw "Unexpected mirror file: $relative" }
}

# The installed unpacked source intentionally retains development hot reload.
# Build a production-only mirror/ZIP without its marker, injected script,
# background message handlers or tab refresh behavior.
function Remove-DevBlock([string]$text, [string]$start, [string]$end) {
  $first = $text.IndexOf($start, [StringComparison]::Ordinal)
  if ($first -lt 0) { throw "Missing release sanitizer block start: $start" }
  $last = $text.IndexOf($end, $first + $start.Length, [StringComparison]::Ordinal)
  if ($last -lt 0) { throw "Missing release sanitizer block end: $end" }
  if ($text.IndexOf($start, $first + 1, [StringComparison]::Ordinal) -ge 0) {
    throw "Ambiguous developer code block: $start"
  }
  return $text.Substring(0, $first) + $text.Substring($last)
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$releasePayloads = @{}
foreach ($file in $files) {
  $relative = $file.FullName.Substring($source.Length + 1)
  if ($relative -eq 'manifest.json') {
    $manifest = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    foreach ($script in $manifest.content_scripts) {
      if ($script.js) { $script.js = @($script.js | Where-Object { $_ -ne 'content/dev-reload.js' }) }
    }
    $releasePayloads[$relative] = $utf8.GetBytes(($manifest | ConvertTo-Json -Depth 32) + "`n")
  } elseif ($relative -eq 'background.js') {
    $script = [System.IO.File]::ReadAllText($file.FullName)
    $script = Remove-DevBlock $script 'const DEV_RELOAD_FILE = "dev-reload.json";' 'async function readRecentFeed(identity, force = false) {'
    $script = Remove-DevBlock $script '  if (message?.type === "CHANLUME_DEV_MARKER") {' '  if (message?.type === "CHANLUME_CHANNEL_FEED") {'
    $updateLine = '  if (details.reason === "update") await refreshDevTabsAfterReload();'
    if (-not $script.Contains($updateLine)) { throw 'Developer update callback not found' }
    $script = $script.Replace($updateLine, '')
    if ($script -match '(?i)dev.reload|CHANLUME_DEV_|refreshDevTabsAfterReload') { throw 'Developer reload hooks still present in release background' }
    $releasePayloads[$relative] = $utf8.GetBytes($script)
  } else {
    $releasePayloads[$relative] = [System.IO.File]::ReadAllBytes($file.FullName)
  }
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($source.Length + 1)
  $destination = Join-Path $mirror $relative
  $directory = Split-Path -Parent $destination
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
  [System.IO.File]::WriteAllBytes($destination, [byte[]]$releasePayloads[$relative])
}

$zip = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $entryName = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $mirror $file.FullName.Substring($source.Length + 1)), $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }

$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  if ($zip.Entries.Count -ne $files.Count) { throw 'ZIP entry count mismatch' }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($source.Length + 1)
    $entry = $zip.GetEntry($relative.Replace('\', '/'))
    if (-not $entry) { throw "Missing ZIP entry: $relative" }
    $sourceHash = [BitConverter]::ToString($sha.ComputeHash([byte[]]$releasePayloads[$relative])).Replace('-', '')
    $mirrorHash = (Get-FileHash -LiteralPath (Join-Path $mirror $relative) -Algorithm SHA256).Hash
    $stream = $entry.Open()
    try { $entryHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose() }
    if ($sourceHash -ne $mirrorHash -or $sourceHash -ne $entryHash) { throw "Byte mismatch: $relative" }
  }
} finally { $sha.Dispose(); $zip.Dispose() }

@{
  kind = 'versioned-package'
  version = $version
  files = $files.Count
  archive = $archivePath
  sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  production_mirror_zip_equal = $true
  developer_reload_removed = $true
} | ConvertTo-Json
