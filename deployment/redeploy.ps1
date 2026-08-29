# Re-deploys the Render backend + proctoring services (latest commit on their branch) via API.
# Usage:
#   $env:RENDER_API_KEY="rnd_..." ; .\deployment\redeploy.ps1
#   .\deployment\redeploy.ps1 -Key rnd_...
param(
  [string]$Key = $env:RENDER_API_KEY,
  [string[]]$Services = @(
    "srv-da94gvajnfac73cldbn0", # oes-backend
    "srv-da94h2lg1s2s7396p38g"  # oes-proctoring
  )
)

if (-not $Key) { throw "No Render API key. Set RENDER_API_KEY or pass -Key." }

$headers = @{ Authorization = "Bearer $Key"; Accept = "application/json"; "Content-Type" = "application/json" }

foreach ($sid in $Services) {
  $dep = Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$sid/deploys" -Headers $headers -Body '{}'
  Write-Output ("triggered $sid -> deploy " + $dep.id)
}

Write-Output "Wait for statuses then verify:"
Write-Output "  https://oes-backend-nrpu.onrender.com/api/v1/monitoring/health/ready"
Write-Output "  https://oes-proctoring.onrender.com/health"