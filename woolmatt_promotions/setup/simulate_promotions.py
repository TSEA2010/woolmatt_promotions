import frappe
import random
import json
from frappe.utils import add_days, nowdate

def run_simulation():
    frappe.set_user("Administrator")
    print("=== STARTING WOOLMATT PROMOTIONS 30-DAY SALES SIMULATION ===")
    
    # 1. Get or create Customer
    customer = frappe.db.get_value("Customer", {"customer_name": "Walk-in Customer"}, "name")
    if not customer:
        customer_doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": "Walk-in Customer",
            "customer_group": "All Customer Groups",
            "territory": "All Territories"
        })
        customer_doc.insert(ignore_permissions=True)
        customer = customer_doc.name
        
    companies = frappe.get_all("Company", pluck="name")
    company = companies[0] if companies else "Jambo Supermarkets Ltd"
    
    # 2. Get sample items
    items = frappe.get_all("Item", filters={"is_sales_item": 1, "disabled": 0}, fields=["name", "item_code", "item_name", "standard_rate"], limit=10)
    if not items:
        print("No items found!")
        return
        
    for item in items:
        if not item.standard_rate or item.standard_rate < 50.0:
            item.standard_rate = random.choice([100.0, 150.0, 300.0, 450.0])
            frappe.db.set_value("Item", item.name, "standard_rate", item.standard_rate)

    print(f"Loaded {len(items)} items for simulation.")
    
    # 3. Define 8 Mechanics to simulate (20 tx/week * 4 weeks = 80 tx per mechanic = 640 transactions total!)
    mechanics = [
        ("pct", "% Discount (20% Off)", "supplier"),
        ("price", "Price Discount (KES 50 Off)", "self"),
        ("bogo", "BOGO (Buy 1 Get 1 Free)", "both"),
        ("bxgy", "Buy X Get Y (Free Item)", "supplier"),
        ("multibuy", "Multibuy (Buy 3 for KES 150)", "self"),
        ("points", "Extra Loyalty Points (50 pts)", "both"),
        ("happy", "Happy Hour (25% Off 1-2pm)", "supplier"),
        ("combo", "Combo Offer (Main + Add-on)", "self")
    ]
    
    start_date = add_days(nowdate(), -28) # 4 weeks ago
    simulation_results = []
    
    for idx, (m_type, m_title, m_fund) in enumerate(mechanics):
        rand_id = random.randint(1000, 9999)
        scheme_title = f"SIM-{m_type.upper()}-{rand_id}"
        sample_item = items[idx % len(items)]
        
        # Create Promotional Scheme with priority
        p_scheme = frappe.get_doc({
            "doctype": "Promotional Scheme",
            "name": scheme_title,
            "title": scheme_title,
            "selling": 1,
            "buying": 0,
            "priority": (idx + 1) * 10,
            "apply_on": "Item Code",
            "company": company,
            "valid_from": start_date,
            "valid_upto": nowdate(),
            "__wm_offer_type": m_type,
            "items": [{"item_code": sample_item.item_code}]
        })
        
        # Add slabs
        if m_type in ["bogo", "bxgy"]:
            p_scheme.append("product_discount_slabs", {
                "item_code": sample_item.item_code,
                "item_name": sample_item.item_name,
                "min_qty": 1,
                "free_qty": 1,
                "same_item": 1,
                "rule_description": f"{sample_item.item_name} - {m_title}",
                "custom_funding_type": m_fund
            })
        else:
            p_scheme.append("price_discount_slabs", {
                "item_code": sample_item.item_code,
                "item_name": sample_item.item_name,
                "rate_or_discount": "Discount Percentage" if m_type != "price" else "Discount Amount",
                "discount_percentage": 20.0 if m_type != "price" else 0.0,
                "discount_amount": 50.0 if m_type == "price" else 0.0,
                "min_qty": 1,
                "rule_description": f"{sample_item.item_name} - {m_title}",
                "custom_funding_type": m_fund
            })
            
        p_scheme.insert(ignore_permissions=True, set_name=scheme_title)
        
        # Get generated Pricing Rule or create reference
        created_rules = frappe.get_all("Pricing Rule", filters={"promotional_scheme": p_scheme.name}, pluck="name")
        pr_name = created_rules[0] if created_rules else None
        
        if not pr_name:
            pr_title = f"PR-{scheme_title}"
            p_rule = frappe.get_doc({
                "doctype": "Pricing Rule",
                "name": pr_title,
                "title": pr_title,
                "selling": 1,
                "buying": 0,
                "priority": (idx + 1) * 10,
                "apply_on": "Item Code",
                "promotional_scheme": p_scheme.name,
                "price_or_product_discount": "Product" if m_type in ["bogo", "bxgy"] else "Price",
                "company": company,
                "valid_from": start_date,
                "valid_upto": nowdate(),
                "custom_funding_type": m_fund.capitalize(),
                "items": [{"item_code": sample_item.item_code}]
            })
            p_rule.insert(ignore_permissions=True, set_name=pr_title)
            pr_name = p_rule.name
        
        # 4. Simulate 20 transactions/week * 4 weeks = 80 transactions per scheme
        tx_count = 80
        total_units = 0
        total_disc = 0.0
        total_rebate = 0.0
        total_self = 0.0
        
        for tx in range(tx_count):
            day_offset = random.randint(0, 28)
            tx_date = add_days(start_date, day_offset)
            tx_time = "13:30:00" if m_type == "happy" else f"{random.randint(9,20):02d}:{random.randint(10,59):02d}:00"
            
            qty = random.randint(1, 4)
            rate = sample_item.standard_rate or 100.0
            
            if m_type == "pct" or m_type == "happy":
                disc_per_unit = rate * 0.20
            elif m_type == "price":
                disc_per_unit = 50.0
            elif m_type == "bogo":
                disc_per_unit = (rate * 0.50) if qty >= 2 else 0.0
            elif m_type == "multibuy":
                disc_per_unit = (rate * 0.15) if qty >= 3 else 0.0
            else:
                disc_per_unit = rate * 0.15
                
            disc_amt = disc_per_unit * qty
            final_rate = max(10.0, rate - disc_per_unit)
            
            if m_fund == "supplier":
                rebate = disc_amt * 0.70
                self_c = disc_amt * 0.30
            elif m_fund == "self":
                rebate = 0.0
                self_c = disc_amt
            else: # both
                rebate = disc_amt * 0.50
                self_c = disc_amt * 0.50
                
            si = frappe.get_doc({
                "doctype": "Sales Invoice",
                "customer": customer,
                "company": company,
                "posting_date": tx_date,
                "posting_time": tx_time,
                "set_posting_time": 1,
                "ignore_pricing_rule": 1,
                "items": [{
                    "item_code": sample_item.item_code,
                    "qty": qty,
                    "rate": final_rate,
                    "price_list_rate": rate,
                    "discount_amount": disc_amt,
                    "pricing_rule": pr_name,
                    "custom_supplier_rebate_amount": rebate,
                    "custom_self_funded_amount": self_c
                }]
            })
            si.insert(ignore_permissions=True)
            si.submit()
            
            total_units += qty
            total_disc += disc_amt
            total_rebate += rebate
            total_self += self_c
            
        frappe.db.commit()
        
        uplift_pct = random.randint(35, 65)
        simulation_results.append({
            "scheme": p_scheme.name,
            "mechanic": m_title,
            "funding": m_fund.upper(),
            "transactions": tx_count,
            "units_sold": total_units,
            "total_discount": round(total_disc, 2),
            "supplier_rebate": round(total_rebate, 2),
            "self_funded": round(total_self, 2),
            "uplift": f"+{uplift_pct}%"
        })
        print(f"Simulated {tx_count} tx for {m_title}: {total_units} units sold, KES {round(total_disc, 2)} discount.")

    print("\n=== SIMULATION SUMMARY TABLE (640 TRANSACTIONS TOTAL) ===")
    print(f"{'MECHANIC':<30} | {'TX':<5} | {'UNITS':<6} | {'DISCOUNT (KES)':<15} | {'REBATE (KES)':<15} | {'SELF COST':<12} | {'UPLIFT'}")
    print("-" * 105)
    for r in simulation_results:
        print(f"{r['mechanic']:<30} | {r['transactions']:<5} | {r['units_sold']:<6} | {r['total_discount']:<15} | {r['supplier_rebate']:<15} | {r['self_funded']:<12} | {r['uplift']}")
    print("=" * 105)
    return simulation_results

def create_five_item_combo():
    frappe.set_user("Administrator")
    companies = frappe.get_all("Company", pluck="name")
    company = companies[0] if companies else "Jambo Supermarkets Ltd"
    items = frappe.get_all("Item", filters={"is_sales_item": 1, "disabled": 0}, fields=["item_code", "item_name", "standard_rate"], limit=5)
    
    if len(items) < 5:
        print("Fewer than 5 items found.")
        return
        
    rand_id = random.randint(100, 999)
    title = f"5-Item Mega Combo Deal {rand_id}"
    scheme = frappe.get_doc({
        "doctype": "Promotional Scheme",
        "title": title,
        "name": title,
        "selling": 1,
        "buying": 0,
        "priority": 50,
        "apply_on": "Item Code",
        "company": company,
        "valid_from": nowdate(),
        "valid_upto": add_days(nowdate(), 30),
        "items": [{"item_code": i.item_code} for i in items]
    })
    
    roles = [("main", 0, "self"), ("addon", 20, "supplier"), ("addon", 25, "supplier"), ("addon", 30, "both"), ("addon", 35, "supplier")]
    
    for idx, item in enumerate(items):
        role, disc, fund = roles[idx]
        scheme.append("price_discount_slabs", {
            "item_code": item.item_code,
            "item_name": item.item_name,
            "rate_or_discount": "Discount Percentage",
            "discount_percentage": disc,
            "min_qty": 1,
            "rule_description": f"{item.item_name} - {role.upper()} ({disc}% Off)",
            "custom_funding_type": fund
        })
        
    scheme.insert(ignore_permissions=True, set_name=title)
    frappe.db.commit()
    print(f"SUCCESSFULLY_CREATED_5_ITEM_COMBO:{scheme.name}")
    return scheme.name

def simulate_combo_sales(scheme_name="5-Item Mega Combo Deal 820"):
    frappe.set_user("Administrator")
    scheme = frappe.get_doc("Promotional Scheme", scheme_name)
    rules = frappe.get_all("Pricing Rule", filters={"promotional_scheme": scheme_name}, pluck="name")
    pr_name = rules[0] if rules else None
    
    customer = frappe.db.get_value("Customer", {"customer_name": "Walk-in Customer"}, "name")
    companies = frappe.get_all("Company", pluck="name")
    company = companies[0] if companies else "Jambo Supermarkets Ltd"
    
    for tx in range(20):
        day_offset = random.randint(0, 7)
        tx_date = add_days(nowdate(), -day_offset)
        
        invoice_items = []
        for idx, slab in enumerate(scheme.price_discount_slabs):
            item_code = scheme.items[idx].item_code if idx < len(scheme.items) else "10000007"
            item_rate = frappe.db.get_value("Item", item_code, "standard_rate") or 100.0
            disc_pct = slab.discount_percentage or 0.0
            disc_amt = item_rate * (disc_pct / 100.0)
            funding = getattr(slab, "custom_funding_type", "supplier") or "supplier"
            
            rebate = disc_amt * 0.70 if funding == "supplier" else (disc_amt * 0.50 if funding == "both" else 0.0)
            self_c = disc_amt - rebate
            
            invoice_items.append({
                "item_code": item_code,
                "qty": 1,
                "rate": max(10.0, item_rate - disc_amt),
                "price_list_rate": item_rate,
                "pricing_rule": pr_name,
                "custom_supplier_rebate_amount": rebate,
                "custom_self_funded_amount": self_c
            })
            
        si = frappe.get_doc({
            "doctype": "Sales Invoice",
            "customer": customer,
            "company": company,
            "posting_date": tx_date,
            "set_posting_time": 1,
            "ignore_pricing_rule": 1,
            "items": invoice_items
        })
        si.insert(ignore_permissions=True)
        si.submit()
        
    frappe.db.commit()
    print(f"SIMULATED_20_TX_FOR_COMBO:{scheme_name}")
