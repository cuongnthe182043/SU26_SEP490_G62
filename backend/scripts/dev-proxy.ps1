# Start Cloud SQL Auth Proxy pointed at the DEV database (sep490_dev), listening on
# 127.0.0.1:5434. Run this in its own terminal and leave it running while you code
# (Ctrl+C to stop). The local backend (ENV_FILE=.env.clouddev.local) connects through
# this port.
#
# Why a proxy instead of a direct IP: the Cloud SQL instance has no public IP open to
# the internet, and a dev machine's IP usually changes (home/cafe wifi), so IP allow-
# listing would not be durable. The proxy authenticates via gcloud Application Default
# Credentials instead, no firewall changes needed.

$ErrorActionPreference = "Stop"
$ToolsDir  = Join-Path $PSScriptRoot "..\.tools"
$ProxyExe  = Join-Path $ToolsDir "cloud-sql-proxy.exe"
$Instance  = "sep490g62:asia-southeast1:sep490"
$LocalPort = 5434

if (-not (Test-Path $ProxyExe)) {
    Write-Host "cloud-sql-proxy.exe not found, downloading..."
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    $url = "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.x64.exe"
    Invoke-WebRequest -Uri $url -OutFile $ProxyExe
}

Write-Host "Starting Cloud SQL Proxy -> 127.0.0.1:$LocalPort (Ctrl+C to stop)"
& $ProxyExe --port $LocalPort $Instance
