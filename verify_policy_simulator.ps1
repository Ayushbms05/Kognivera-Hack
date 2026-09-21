$ErrorActionPreference = "Stop"

Write-Host "=== 1. Testing Scenario: Late Arrival (2:30 AM) on htl_06d140bd ==="
$bodyA = @{
    arrival_time = "02:30"
    has_pets = $false
    children_ages = @()
    adults_count = 2
} | ConvertTo-Json

$resA = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_06d140bd/check-feasibility" -Method POST -Body $bodyA -ContentType "application/json"
Write-Host "Overall Feasible: $($resA.overall_feasible)"
Write-Host "Verdict: $($resA.verdict_summary)"
$lateRule = $resA.rules | Where-Object { $_.parameter -eq "Arrival Time" }
Write-Host "Arrival Time Status: $($lateRule.status) | Source: $($lateRule.source_column)"
if ($lateRule.status -ne "DISQUALIFIED") {
    throw "Expected DISQUALIFIED for 2:30 AM arrival when early checkin is not allowed"
}
if ($lateRule.source_column -ne "early_checkin_possible") {
    throw "Expected source_column to be early_checkin_possible"
}

Write-Host "`n=== 2. Testing Scenario: Traveling with Cat on htl_06d140bd ==="
$bodyB = @{
    arrival_time = $null
    has_pets = $true
    children_ages = @()
    adults_count = 2
} | ConvertTo-Json

$resB = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_06d140bd/check-feasibility" -Method POST -Body $bodyB -ContentType "application/json"
Write-Host "Overall Feasible: $($resB.overall_feasible)"
Write-Host "Verdict: $($resB.verdict_summary)"
$petRule = $resB.rules | Where-Object { $_.parameter -eq "Pet Accommodation" }
Write-Host "Pet Status: $($petRule.status) | Source: $($petRule.source_column)"
Write-Host "Rule text: $($petRule.hotel_rule)"
if ($petRule.status -ne "APPROVED") {
    throw "Expected APPROVED for pet on pet-friendly hotel"
}
if ($petRule.source_column -ne "pet_policy") {
    throw "Expected source_column to be pet_policy"
}

Write-Host "`n=== 3. Testing Scenario: Family with Toddler & 10yo on htl_06d140bd ==="
$bodyC = @{
    arrival_time = "14:00"
    has_pets = $false
    children_ages = @(2, 10)
    adults_count = 2
} | ConvertTo-Json

$resC = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_06d140bd/check-feasibility" -Method POST -Body $bodyC -ContentType "application/json"
Write-Host "Overall Feasible: $($resC.overall_feasible)"
Write-Host "Verdict: $($resC.verdict_summary)"
$childRule = $resC.rules | Where-Object { $_.parameter -eq "Child Age & Bedding" }
Write-Host "Child Status: $($childRule.status) | Source: $($childRule.source_column)"
Write-Host "Rule text: $($childRule.hotel_rule)"
if ($childRule.status -ne "DISQUALIFIED") {
    throw "Expected DISQUALIFIED for toddler on adult/over-8-only property"
}
if ($childRule.source_column -ne "child_policy") {
    throw "Expected source_column to be child_policy"
}

Write-Host "`n=== 4. Verifying Frontend Detail Page HTTP 200 ==="
$frontRes = Invoke-WebRequest -Uri "http://localhost:3001/hotel/htl_06d140bd" -Method GET -UseBasicParsing
Write-Host "Frontend HTTP Status: $($frontRes.StatusCode)"

Write-Host "`n=== 5. Running Database Conformance Validator ==="
python tools/validate_conformance.py backend/data/PS-02.db

Write-Host "`n>>> ALL EDGE-CASE POLICY SIMULATOR TESTS PASSED SUCCESSFULLY! <<<"
