$ErrorActionPreference = 'Stop'
$labProjectPath = Split-Path -Parent $PSScriptRoot
$labNodePath = (Get-Command node).Source
try {
  Invoke-RestMethod 'http://127.0.0.1:11435/status' -Headers @{ Origin = 'https://your-site.example' } -TimeoutSec 3 | Out-Null
  Write-Output 'The ESPLAB Ollama bridge is already running.'
  exit 0
} catch {}
$labProcess = Start-Process -FilePath $labNodePath -ArgumentList '--import','tsx','scripts/ollama-bridge.ts' -WorkingDirectory $labProjectPath -WindowStyle Hidden -PassThru
Write-Output "Started the ESPLAB local bridge (process $($labProcess.Id)). Open the site and choose Connect local Ollama."
