[CmdletBinding()]
param(
    [ValidateRange(1, 30)]
    [int]$TimeoutSeconds = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:PassCount = 0
$script:WarnCount = 0
$script:FailCount = 0

function Write-CheckResult {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Status,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $color = switch ($Status) {
        "PASS" { $script:PassCount++; "Green" }
        "WARN" { $script:WarnCount++; "Yellow" }
        "FAIL" { $script:FailCount++; "Red" }
    }

    Write-Host ("[{0}] {1}" -f $Status, $Message) -ForegroundColor $color
}

function Write-StartCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Service,

        [Parameter(Mandatory = $true)]
        [string[]]$CommandLines
    )

    Write-Host ("       Start {0}:" -f $Service) -ForegroundColor Cyan
    foreach ($line in $CommandLines) {
        Write-Host ("         {0}" -f $line) -ForegroundColor Cyan
    }
}

function Invoke-LocalGet {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Urls
    )

    foreach ($url in $Urls) {
        try {
            $response = Invoke-WebRequest `
                -Uri $url `
                -Method Get `
                -TimeoutSec $TimeoutSeconds `
                -UseBasicParsing

            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                $json = $null

                if (-not [string]::IsNullOrWhiteSpace($response.Content)) {
                    try {
                        $json = $response.Content | ConvertFrom-Json
                    }
                    catch {
                        # A non-JSON page is expected for the React frontend.
                        $json = $null
                    }
                }

                return [pscustomobject]@{
                    Success    = $true
                    Url        = $url
                    StatusCode = [int]$response.StatusCode
                    Json       = $json
                }
            }
        }
        catch {
            # Continue to the next explicitly local fallback URL.
        }
    }

    return [pscustomobject]@{
        Success    = $false
        Url        = $Urls[0]
        StatusCode = $null
        Json       = $null
    }
}

function Get-ObjectProperty {
    param(
        [AllowNull()]
        [object]$InputObject,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if ($null -eq $InputObject) {
        return $null
    }

    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

Write-Host ""
Write-Host "HirePilot AI Demo Health Check" -ForegroundColor White
Write-Host "Local read-only checks only; no data or files are modified." -ForegroundColor DarkGray
Write-Host "Automatic discovery requires AUTO_DISCOVERY_ENABLED=true plus authenticated source controls; verify it in Admin > Discovery Runs." -ForegroundColor DarkGray
Write-Host ""

$backendResult = Invoke-LocalGet -Urls @(
    "http://127.0.0.1:5000/",
    "http://localhost:5000/"
)

if ($backendResult.Success) {
    Write-CheckResult -Status "PASS" -Message (
        "Backend API responded at {0} (HTTP {1})." -f `
            $backendResult.Url,
            $backendResult.StatusCode
    )
}
else {
    Write-CheckResult -Status "FAIL" -Message "Backend API is not ready on port 5000."
    Write-StartCommand -Service "backend" -CommandLines @(
        "cd backend",
        "node server.js"
    )
}

$workerResult = Invoke-LocalGet -Urls @(
    "http://127.0.0.1:8000/health"
)

if (-not $workerResult.Success) {
    Write-CheckResult -Status "FAIL" -Message "AI worker is not running at http://127.0.0.1:8000."
    Write-StartCommand -Service "AI worker" -CommandLines @(
        "cd ai-agent",
        ".\venv\Scripts\Activate.ps1",
        "uvicorn main:app --reload --port 8000"
    )
}
elseif ($null -eq $workerResult.Json) {
    Write-CheckResult -Status "FAIL" -Message "AI worker health endpoint returned an unreadable response."
}
else {
    $workerStatus = [string](Get-ObjectProperty -InputObject $workerResult.Json -Name "status")
    $databaseConnected = (Get-ObjectProperty -InputObject $workerResult.Json -Name "database_connected") -eq $true

    if ($workerStatus -eq "online" -and $databaseConnected) {
        Write-CheckResult -Status "PASS" -Message "AI worker is online and connected to PostgreSQL."
    }
    else {
        Write-CheckResult -Status "FAIL" -Message (
            "AI worker responded but is degraded (status: {0}; database connected: {1})." -f `
                $workerStatus,
                $databaseConnected
        )
    }

    $crawl4AiStatus = Get-ObjectProperty -InputObject $workerResult.Json -Name "crawl4ai"
    if ($null -ne $crawl4AiStatus) {
        if ((Get-ObjectProperty -InputObject $crawl4AiStatus -Name "available") -eq $true) {
            Write-CheckResult -Status "PASS" -Message "Crawl4AI safe raw-HTML demo mode is available."
        }
        else {
            Write-CheckResult -Status "WARN" -Message "Crawl4AI is unavailable; demo discovery will not run."
        }
    }

    $browserStatus = Get-ObjectProperty -InputObject $workerResult.Json -Name "browser_automation"
    if ($null -ne $browserStatus) {
        if ((Get-ObjectProperty -InputObject $browserStatus -Name "available") -eq $true) {
            Write-CheckResult -Status "PASS" -Message "Playwright safe dummy browser mode is available."
        }
        else {
            Write-CheckResult -Status "WARN" -Message "Playwright is unavailable; the safe dummy browser test will not run."
        }
    }
}

if ($workerResult.Success) {
    $queueResult = Invoke-LocalGet -Urls @(
        "http://127.0.0.1:8000/queue/stats"
    )

    $queue = Get-ObjectProperty -InputObject $queueResult.Json -Name "queue"

    if ($queueResult.Success -and $null -ne $queue) {
        Write-CheckResult -Status "PASS" -Message (
            "AI queue stats available (queued: {0}; running: {1}; manual: {2}; failed: {3})." -f `
                (Get-ObjectProperty -InputObject $queue -Name "queued"),
                (Get-ObjectProperty -InputObject $queue -Name "running"),
                (Get-ObjectProperty -InputObject $queue -Name "needs_manual_action"),
                (Get-ObjectProperty -InputObject $queue -Name "failed")
        )
    }
    else {
        Write-CheckResult -Status "WARN" -Message "AI queue stats are unavailable; core health checks can continue."
    }
}
else {
    Write-CheckResult -Status "WARN" -Message "AI queue stats were skipped because the worker is offline."
}

$frontendResult = Invoke-LocalGet -Urls @(
    "http://localhost:3000/"
)

if ($frontendResult.Success) {
    Write-CheckResult -Status "PASS" -Message (
        "Frontend responded at {0} (HTTP {1})." -f `
            $frontendResult.Url,
            $frontendResult.StatusCode
    )
}
else {
    Write-CheckResult -Status "FAIL" -Message "Frontend is not running at http://localhost:3000."
    Write-StartCommand -Service "frontend" -CommandLines @(
        "cd frontend",
        "npm start"
    )
}

Write-Host ""
Write-Host (
    "Summary: {0} PASS, {1} WARN, {2} FAIL" -f `
        $script:PassCount,
        $script:WarnCount,
        $script:FailCount
) -ForegroundColor White

if ($script:FailCount -gt 0) {
    Write-Host "Demo stack is not ready. Resolve FAIL items and run this check again." -ForegroundColor Red
    exit 1
}

if ($script:WarnCount -gt 0) {
    Write-Host "Core services are ready with warnings. Review WARN items before presenting." -ForegroundColor Yellow
    exit 0
}

Write-Host "Demo stack is ready for the E2E presentation checklist." -ForegroundColor Green
exit 0
