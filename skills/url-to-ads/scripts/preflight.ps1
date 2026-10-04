# preflight.ps1 — URL to Ads by Paneet: check and install what the skill needs (Windows).
# PowerShell on purpose: it must run on a machine that has no Node yet.
#
#   powershell -ExecutionPolicy Bypass -File preflight.ps1 check            "ok <item> <detail>" / "missing <item> <how>"; exit 0 when all present
#   powershell -ExecutionPolicy Bypass -File preflight.ps1 install <item>   item: node | ffmpeg | browser
#
# Package manager: winget (ships with Windows 10 1809+ / 11 as "App Installer").

param([string]$Command = "", [string]$Item = "")
$NodeMin = 22

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
function Have($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Node-Ok {
  if (-not (Have node)) { return $false }
  $major = [int](node -p "process.versions.node.split('.')[0]" 2>$null)
  return $major -ge $NodeMin
}
function How($item) {
  switch ($item) {
    "node"    { "winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements" }
    "ffmpeg"  { "winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements" }
    "browser" { "npx -y hyperframes browser ensure" }
  }
}

function Check {
  $missing = 0
  if (-not (Have winget)) { "missing winget install 'App Installer' from the Microsoft Store"; $missing = 1 }
  if (Node-Ok) { "ok node $(node -v)" } else { "missing node $(How node)"; $missing = 1 }
  if ((Have ffmpeg) -and (Have ffprobe)) { "ok ffmpeg" } else { "missing ffmpeg $(How ffmpeg)"; $missing = 1 }
  if ((Node-Ok) -and ((npx -y hyperframes browser path 2>$null) -and $LASTEXITCODE -eq 0)) { "ok browser" } else { "missing browser $(How browser)"; $missing = 1 }
  exit $missing
}

function Install($item) {
  if ($item -notin @("node", "ffmpeg", "browser")) { Write-Error "unknown item '$item' (node | ffmpeg | browser)"; exit 2 }
  if ($item -ne "browser" -and -not (Have winget)) { Write-Error "cannot install ${item}: winget is missing"; exit 2 }
  if ($item -eq "browser" -and -not (Node-Ok)) { Write-Error "cannot install browser: Node $NodeMin+ is required first"; exit 2 }
  $cmd = How $item
  "-> $cmd"
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) { Write-Error "install failed: $item - command: $cmd"; exit 1 }
  Refresh-Path
  $ok = switch ($item) { "node" { Node-Ok } "ffmpeg" { (Have ffmpeg) -and (Have ffprobe) } "browser" { $true } }
  if (-not $ok) { Write-Error "$item installed but not found on PATH - open a new terminal and run check again"; exit 1 }
  "installed $item"
}

switch ($Command) {
  "check"   { Check }
  "install" { if (-not $Item) { Write-Error "usage: preflight.ps1 install node|ffmpeg|browser"; exit 2 }; Install $Item }
  default   { Write-Error "usage: preflight.ps1 check | install node|ffmpeg|browser"; exit 2 }
}
