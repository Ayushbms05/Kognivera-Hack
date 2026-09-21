from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR
import math

def calculate_pricing(subtotal_inr: Decimal, delta_inr: Decimal, exchange_rate: Decimal, exponent: int):
    # Effective nightly (assuming 1 night for slab detection)
    effective_rate = subtotal_inr + delta_inr
    gst_pct = Decimal('12') if effective_rate <= Decimal('7500.00') else Decimal('18')
    gst_rate = gst_pct / Decimal('100')
    
    taxable_inr = subtotal_inr + delta_inr
    gst_inr = taxable_inr * gst_rate
    total_inr = taxable_inr + gst_inr
    
    quantum = Decimal('1') if exponent == 0 else Decimal('10') ** -exponent
    
    # Unrounded target amounts
    u_subtotal = subtotal_inr / exchange_rate
    u_delta = delta_inr / exchange_rate
    u_gst = gst_inr / exchange_rate
    u_total = total_inr / exchange_rate
    
    # Target total rounded
    target_total = u_total.quantize(quantum, rounding=ROUND_HALF_UP)
    target_units = int(target_total / quantum)
    
    components = [
        {"name": "subtotal", "val": u_subtotal},
        {"name": "rate_plan_delta", "val": u_delta},
        {"name": "gst", "val": u_gst},
    ]
    
    for c in components:
        units_float = c["val"] / quantum
        floor_units = int(math.floor(units_float))
        c["floor_units"] = floor_units
        c["remainder"] = units_float - Decimal(floor_units)
    
    sum_floors = sum(c["floor_units"] for c in components)
    discrepancy = target_units - sum_floors
    
    # Sort by remainder descending
    components_sorted = sorted(components, key=lambda x: x["remainder"], reverse=True)
    
    for i in range(len(components_sorted)):
        if i < discrepancy:
            components_sorted[i]["assigned_units"] = components_sorted[i]["floor_units"] + 1
        else:
            components_sorted[i]["assigned_units"] = components_sorted[i]["floor_units"]
            
    res = {}
    for c in components_sorted:
        res[c["name"]] = (Decimal(c["assigned_units"]) * quantum).quantize(quantum)
        
    res["total"] = target_total
    
    assert res["subtotal"] + res["rate_plan_delta"] + res["gst"] == res["total"], "Sum mismatch!"
    return res

# Test with USD (2 decimals)
t1 = calculate_pricing(Decimal('8000.00'), Decimal('-800.00'), Decimal('83.333333'), 2)
print("USD test:", t1)

# Test with JPY (0 decimals)
t2 = calculate_pricing(Decimal('7000.00'), Decimal('1200.00'), Decimal('0.549451'), 0)
print("JPY test:", t2)

# Test with KWD (3 decimals)
t3 = calculate_pricing(Decimal('15000.00'), Decimal('-1500.00'), Decimal('271.5'), 3)
print("KWD test:", t3)
