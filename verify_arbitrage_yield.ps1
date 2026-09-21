# Automated Verification Script for Feature 2: Limit-Order Yield Arbitrage Booking
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Verifying Yield Arbitrage Quote Endpoint (/api/hotels/{id}/arbitrage-quote) ===" -ForegroundColor Cyan
$quote = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_d8608c0c/arbitrage-quote?room_type_id=rmt_6499086b&for_date=2026-09-24" -Method Get
Write-Host "Room: $($quote.room_name) | Base Rate: $($quote.base_rate) $($quote.currency)" -ForegroundColor Green
Write-Host "Inventory: Total $($quote.total_units) | Booked $($quote.booked_units) | Unsold $($quote.unsold_units) (Fill Rate: $($quote.fill_rate * 100)%)" -ForegroundColor Yellow
Write-Host "Cancellation Policy: $($quote.cancellation_policy) | Days to Check-in: $($quote.days_until_checkin)d" -ForegroundColor Yellow
Write-Host "Base Price Drop Probability: $($quote.base_drop_probability_pct)%" -ForegroundColor Green

if ($quote.probability_curve.Count -lt 5) {
    throw "Expected at least 5 probability curve data points"
}
Write-Host "Probability Curve (5% - 30% discounts):"
foreach ($pt in $quote.probability_curve) {
    Write-Host " - Discount: $($pt.discount_pct)% -> Target: $($pt.target_price) -> Fill Prob: $($pt.fill_probability_pct)% (Eligible: $($pt.is_eligible))"
}

Write-Host "`n=== 2. Verifying Qualifying Limit Order Submission (> 50% Fill Probability) ===" -ForegroundColor Cyan
$targetRate = $quote.recommended_target_price
$body = @{
    room_type_id = "rmt_6499086b"
    user_id = "usr_f855344d"
    for_date = "2026-09-24"
    target_price = [double]$targetRate
} | ConvertTo-Json

$orderRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_d8608c0c/arbitrage-order" -Method Post -ContentType "application/json" -Body $body
Write-Host "Order Created: $($orderRes.order_id) | Status: $($orderRes.status)" -ForegroundColor Green
Write-Host "Fill Probability: $($orderRes.fill_probability_pct)% | Discount: $($orderRes.discount_pct)%" -ForegroundColor Green
Write-Host "UPI Mandate ID: $($orderRes.upi_mandate_id)" -ForegroundColor Yellow
Write-Host "UPI Mandate URI: $($orderRes.upi_mandate_uri)" -ForegroundColor Yellow
Write-Host "Confirmation Message: $($orderRes.message)" -ForegroundColor Green

if (-not $orderRes.success -or $orderRes.fill_probability_pct -le 50) {
    throw "Order was expected to be eligible with > 50% probability"
}

# Verify NPCI UPI Mandate URI standard
if ($orderRes.upi_mandate_uri -notmatch "^upi://mandate\?pa=stayfinder\.escrow@icici&pn=StayFinder%20Hotels%20Escrow&am=\d+\.\d{2}&max_am=\d+\.\d{2}&cu=INR&validity=\d{4}-\d{2}-\d{2}&tn=ArbitrageLimitOrder_ord_[a-z0-9]+$") {
    throw "UPI Mandate URI does not match strict NPCI AutoPay standard!"
}
Write-Host "  -> NPCI UPI AutoPay Mandate specification validated." -ForegroundColor Green

Write-Host "`n=== 3. Verifying Order Rejection for Low Probability (<= 50%) ===" -ForegroundColor Cyan
$lowBody = @{
    room_type_id = "rmt_6499086b"
    user_id = "usr_f855344d"
    for_date = "2026-09-24"
    target_price = 800.00
} | ConvertTo-Json

$rejected = $false
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/hotels/htl_d8608c0c/arbitrage-order" -Method Post -ContentType "application/json" -Body $lowBody
} catch {
    $rejected = $true
    Write-Host "Expected HTTP 400 Rejection caught successfully: $($_.ErrorDetails.Message)" -ForegroundColor Green
}

if (-not $rejected) {
    throw "Expected order with <=50% probability to be rejected!"
}

Write-Host "`n=== 4. Verifying SQLite sf_limit_orders Persistence ===" -ForegroundColor Cyan
python -c "import sqlite3; conn = sqlite3.connect('backend/data/PS-02.db'); c = conn.cursor(); c.execute('SELECT order_id, target_price, fill_probability, upi_mandate_id FROM sf_limit_orders ORDER BY created_at DESC LIMIT 1'); row = c.fetchone(); print('Latest Persisted Order:', row); assert row is not None, 'No orders found'"
Write-Host "  -> sf_limit_orders persistence validated." -ForegroundColor Green

Write-Host "`n=== 5. Verifying Frontend Hotel Detail Page HTTP 200 ===" -ForegroundColor Cyan
$frontendRes = Invoke-WebRequest -Uri "http://localhost:3001/hotel/htl_d8608c0c" -UseBasicParsing
Write-Host "Frontend Hotel Detail HTTP Status: $($frontendRes.StatusCode)" -ForegroundColor Green

Write-Host "`n=== 6. Running Database Conformance Validator ===" -ForegroundColor Cyan
python tools/validate_conformance.py backend/data/PS-02.db

Write-Host "`n>>> ALL LIMIT-ORDER YIELD ARBITRAGE TESTS PASSED SUCCESSFULLY! <<<" -ForegroundColor Green
