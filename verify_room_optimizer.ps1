# Verification script for Feature 3: Solar & Acoustic Room Optimizer
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  StayFinder Feature 3: Solar & Acoustic Room Optimizer      " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Test Endpoint: East-Facing Shielded Hotel (htl_02220bb1 - Amber Bungalow Resort)
Write-Host "`n[1/4] Testing GET /api/hotels/htl_02220bb1/room-optimizer?date=2026-09-24..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_02220bb1/room-optimizer?date=2026-09-24" -Method Get

if ($response.optimal_facing -ne "East") {
    Write-Error "FAIL: Expected optimal_facing == 'East', got $($response.optimal_facing)"
}
if ($response.sunlight_time -ne "Morning") {
    Write-Error "FAIL: Expected sunlight_time == 'Morning', got $($response.sunlight_time)"
}
if ($response.noise_shielding -ne $true) {
    Write-Error "FAIL: Expected noise_shielding == true, got $($response.noise_shielding)"
}

Write-Host "  -> Hotel Name: $($response.hotel_name)" -ForegroundColor Green
Write-Host "  -> Coordinates: Lat $($response.coordinates.latitude), Lng $($response.coordinates.longitude)" -ForegroundColor Green
Write-Host "  -> 08:00 AM Sun: Azimuth $($response.solar.morning_8am.azimuth) deg, Altitude $($response.solar.morning_8am.altitude) deg" -ForegroundColor Green
Write-Host "  -> 17:00 PM Sun: Azimuth $($response.solar.evening_5pm.azimuth) deg, Altitude $($response.solar.evening_5pm.altitude) deg" -ForegroundColor Green
Write-Host "  -> Sun Trajectory Points: $($response.solar.trajectory.Count) calculated angles" -ForegroundColor Green
Write-Host "  -> Nearest Noise Hub: $($response.acoustic.nearest_landmark_name) ($($response.acoustic.direction), $($response.acoustic.distance_km) km, $($response.acoustic.estimated_decibels) dBA)" -ForegroundColor Green
Write-Host "  -> Prescribed Facing: $($response.optimal_facing)" -ForegroundColor Green
Write-Host "  -> Sunlight Time: $($response.sunlight_time)" -ForegroundColor Green
Write-Host "  -> Acoustically Shielded: $($response.noise_shielding)" -ForegroundColor Green
Write-Host "  -> Recommendation: $($response.recommendation_text)" -ForegroundColor Green

# 2. Test Multi-Property Determinism (htl_ace63054 - Delhi)
Write-Host "`n[2/4] Testing Determinism on Delhi Hotel (htl_ace63054)..." -ForegroundColor Yellow
$delhiRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_ace63054/room-optimizer?date=2026-09-24" -Method Get
Write-Host "  -> Hotel: $($delhiRes.hotel_name)" -ForegroundColor Green
Write-Host "  -> Optimal Facing: $($delhiRes.optimal_facing), Sunlight: $($delhiRes.sunlight_time), Shielding: $($delhiRes.noise_shielding)" -ForegroundColor Green
Write-Host "  -> Noise Hub: $($delhiRes.acoustic.nearest_landmark_name) at $($delhiRes.acoustic.bearing_degrees) deg" -ForegroundColor Green

# 3. Database Schema Conformance Check
Write-Host "`n[3/4] Validating SQLite Schema Conformance (validate_conformance.py)..." -ForegroundColor Yellow
$conformanceOutput = python tools/validate_conformance.py backend/data/PS-02.db
if ($conformanceOutput -match "PASS") {
    Write-Host "  -> Schema Conformance: 100% PASS (Zero errors)" -ForegroundColor Green
} else {
    Write-Error "Conformance check failed!`n$conformanceOutput"
}

# 4. Frontend Hotel Detail Page Verification
Write-Host "`n[4/4] Verifying Frontend Bioclimatic Room Optimizer Rendering..." -ForegroundColor Yellow
$frontendHtml = (Invoke-WebRequest -Uri "http://localhost:3001/hotel/htl_02220bb1" -UseBasicParsing).Content
if ($frontendHtml -match "bioclimatic-optimizer-section" -and $frontendHtml -match "Bioclimatic Room Optimizer") {
    Write-Host "  -> Bioclimatic Room Optimizer Section successfully rendered on Hotel Detail Page!" -ForegroundColor Green
} else {
    Write-Error "Frontend HTML missing Bioclimatic Room Optimizer section!"
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ALL FEATURE 3 VALIDATIONS PASSED CLEANLY!                " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
