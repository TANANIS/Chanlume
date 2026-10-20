$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $projectRoot 'extension'
$mirror = Join-Path $projectRoot 'outputs\extension'
$version = (Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json).version
$archivePath = Join-Path $projectRoot ("outputs\Chanlume-$version.zip")
if (Test-Path -LiteralPath $archivePath) { throw "Version package already exists: $archivePath" }

$files = @(Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName)
$sourcePaths = @{}
foreach ($file in $files) { $sourcePaths[$file.FullName.Substring($source.Length + 1)] = $true }
foreach ($old in (Get-ChildItem -LiteralPath $mirror -File -Recurse)) {
  $relative = $old.FullName.Substring($mirror.Length + 1)
  if (-not $sourcePaths.ContainsKey($relative)) { throw "Unexpected mirror file: $relative" }
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($source.Length + 1)
  $destination = Join-Path $mirror $relative
  $directory = Split-Path -Parent $destination
  if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $entryName = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
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
    $sourceHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
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
  source_mirror_zip_equal = $true
} | ConvertTo-Json
