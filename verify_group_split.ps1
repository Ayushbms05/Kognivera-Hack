# Automated Verification Script for Group Split & UPI Payment Settlement
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Verifying Backend Group Split Endpoint (/api/bookings/{id}/split) ===" -ForegroundColor Cyan
$bookingId = "bkg_9fbe30f1"

# Test Party Size 2, 3, 4, 5, 6
$testSizes = @(2, 3, 4, 5, 6)
foreach ($size in $testSizes) {
    $body = @{ party_size = $size } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/bookings/$bookingId/split" -Method Post -ContentType "application/json" -Body $body
    
    $total = [double]$response.total_amount
    $shareSum = 0.0
    foreach ($s in $response.shares) {
        $shareSum += [double]$s
    }
    $shareSumRound = [Math]::Round($shareSum, 2)
    $drift = [Math]::Abs($total - $shareSumRound)
    
    Write-Host "Party Size: $size travelers | Total: $total $($response.currency) | Per-Person Share: $($response.per_person_share)" -ForegroundColor Yellow
    Write-Host "  Shares: $($response.shares -join ', ') (Sum: $shareSumRound, Drift: $drift)"
    
    if ($drift -gt 0.001) {
        Write-Host "FAILED: Rounding drift detected in largest remainder apportionment!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n=== 2. Verifying NPCI UPI URI Specification Compliance ===" -ForegroundColor Cyan
$sampleResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/bookings/$bookingId/split" -Method Post -ContentType "application/json" -Body (@{ party_size = 4 } | ConvertTo-Json)
Write-Host "UPI URI: $($sampleResponse.upi_uri)" -ForegroundColor Green

if ($sampleResponse.upi_uri -notmatch "^upi://pay\?pa=stayfinder\.escrow@icici&pn=StayFinder%20Hotels&am=\d+\.\d{2}&cu=INR&tn=Booking_$bookingId$") {
    Write-Host "FAILED: UPI URI does not match strict NPCI deep link standard!" -ForegroundColor Red
    exit 1
}
Write-Host "  -> NPCI UPI Deep Link pattern validated." -ForegroundColor Green

Write-Host "`n=== 3. Verifying WhatsApp Share Deep Link ===" -ForegroundColor Cyan
Write-Host "WhatsApp URL: $($sampleResponse.whatsapp_share_url)" -ForegroundColor Green
if ($sampleResponse.whatsapp_share_url -notmatch "^https://wa\.me/\?text=") {
    Write-Host "FAILED: WhatsApp share URL format invalid!" -ForegroundColor Red
    exit 1
}
Write-Host "  -> Pre-filled WhatsApp deep link validated." -ForegroundColor Green

Write-Host "`n=== 4. Verifying Frontend Confirmation Page HTTP 200 ===" -ForegroundColor Cyan
$frontendRes = Invoke-WebRequest -Uri "http://localhost:3001/confirmation/$bookingId" -UseBasicParsing
Write-Host "Frontend Confirmation Page HTTP Status: $($frontendRes.StatusCode)" -ForegroundColor Green

Write-Host "`n=== 5. Running Database Conformance Validator ===" -ForegroundColor Cyan
python tools/validate_conformance.py --db backend/data/PS-02.db

Write-Host "`n>>> ALL GROUP SPLIT & UPI SETTLEMENT TESTS PASSED SUCCESSFULLY! <<<" -ForegroundColor Green
