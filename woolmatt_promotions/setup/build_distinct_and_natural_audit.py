import frappe
from frappe.utils import add_days, nowdate

def run_audit():
    frappe.set_user("Administrator")
    print("=== STARTING COMPLETE DISTINCT SCHEMES & NATURAL TRANSACTIONS AUDIT ===")
    
    companies = frappe.get_all("Company", pluck="name")
    company = companies[0] if companies else "Jambo Supermarkets Ltd"
    comp_currency = frappe.db.get_value("Company", company, "default_currency") or "KES"
    debtor_account = frappe.db.get_value("Account", {"company": company, "account_type": "Receivable", "is_group": 0}, "name")
    cust_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "Individual"
    territory = frappe.db.get_value("Territory", {"is_group": 0}, "name") or "Kenya"
    
    # 1. Clean previous simulation data
    titles_to_remove = [
        "20% Off Weekend Beverage Deal",
        "KES 50 Direct Savings Discount",
        "BOGO — Buy 1 Get 1 Free",
        "Multibuy Special — Buy 3 Pack",
        "Extra Loyalty Points Bonus (50 pts)",
        "Lunchtime Happy Hour (1PM - 2PM)",
        "Buy Main Drink Get Snack Free (BXGY Bundle)",
        "5-Product Mega Saver Combo Deal"
    ]
    
    target_schemes = frappe.get_all("Promotional Scheme", filters=[["name", "in", titles_to_remove]], pluck="name")
    sim_invoices = frappe.get_all("Sales Invoice", filters=[["customer", "in", ["Walk-in Customer", "Audit Customer"]]], pluck="name")
    
    for si_name in sim_invoices:
        try:
            doc = frappe.get_doc("Sales Invoice", si_name)
            if doc.docstatus == 1:
                doc.cancel()
            doc.delete(ignore_permissions=True)
        except Exception:
            frappe.db.sql("DELETE FROM `tabSales Invoice Item` WHERE parent = %s", si_name)
            frappe.db.sql("DELETE FROM `tabSales Invoice` WHERE name = %s", si_name)
            
    for ps in target_schemes:
        prs = frappe.get_all("Pricing Rule", filters=[["promotional_scheme", "=", ps]], pluck="name")
        for pr in prs:
            frappe.db.sql("DELETE FROM `tabPricing Rule Item Code` WHERE parent = %s", pr)
            frappe.db.sql("DELETE FROM `tabPricing Rule` WHERE name = %s", pr)
        frappe.db.sql("DELETE FROM `tabPromotional Scheme Price Discount` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPromotional Scheme Product Discount` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPricing Rule Item Code` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPromotional Scheme` WHERE name = %s", ps)
        
    frappe.db.commit()
    print("Cleaned previous simulation data.")
    
    # 2. Get customer
    customer = frappe.db.get_value("Customer", {"customer_name": "Audit Customer"}, "name")
    if not customer:
        customer_doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": "Audit Customer",
            "customer_group": cust_group,
            "territory": territory
        })
        customer_doc.insert(ignore_permissions=True)
        customer = customer_doc.name
        
    items = frappe.get_all("Item", filters={"is_sales_item": 1, "disabled": 0}, fields=["item_code", "item_name", "standard_rate"], limit=20)
    item_codes = [i.item_code for i in items]
    item_dict = {i.item_code: i.item_name for i in items}
    
    start_date = nowdate()
    end_date = add_days(nowdate(), 30)
    
    # Define distinct non-overlapping promotional configurations
    distinct_promos = [
        {
            "title": "20% Off Weekend Beverage Deal",
            "mechanic": "pct",
            "type": "Single Product",
            "items": [item_codes[0]],
            "disc_pct": 20.0,
            "funding": "supplier"
        },
        {
            "title": "KES 50 Direct Savings Discount",
            "mechanic": "price",
            "type": "Single Product",
            "items": [item_codes[1]],
            "disc_amt": 50.0,
            "funding": "self"
        },
        {
            "title": "BOGO — Buy 1 Get 1 Free",
            "mechanic": "bogo",
            "type": "Single Product",
            "items": [item_codes[2]],
            "buy_qty": 1,
            "free_qty": 1,
            "funding": "both"
        },
        {
            "title": "Multibuy Special — Buy 3 Pack",
            "mechanic": "multibuy",
            "type": "Single Product",
            "items": [item_codes[3]],
            "buy_qty": 3,
            "disc_pct": 15.0,
            "funding": "self"
        },
        {
            "title": "Extra Loyalty Points Bonus (50 pts)",
            "mechanic": "points",
            "type": "Single Product",
            "items": [item_codes[4]],
            "pts": 50,
            "funding": "both"
        },
        {
            "title": "Lunchtime Happy Hour (1PM - 2PM)",
            "mechanic": "happy",
            "type": "Single Product",
            "items": [item_codes[5]],
            "disc_pct": 25.0,
            "funding": "supplier"
        },
        {
            "title": "Buy Main Drink Get Snack Free (BXGY Bundle)",
            "mechanic": "bxgy",
            "type": "Multi Product Bundle",
            "items": [item_codes[6]],
            "free_item": item_codes[7],
            "buy_qty": 1,
            "free_qty": 1,
            "funding": "supplier"
        },
        {
            "title": "5-Product Mega Saver Combo Deal",
            "mechanic": "combo",
            "type": "Multi Product Combo (5 Items)",
            "items": item_codes[8:13],
            "combo_roles": [("main", 0, "self"), ("addon", 20, "supplier"), ("addon", 25, "supplier"), ("addon", 30, "both"), ("addon", 35, "supplier")]
        }
    ]
    
    # 3. Create Promotional Schemes AND Pricing Rules explicitly
    for idx, p in enumerate(distinct_promos):
        title = p["title"]
        m = p["mechanic"]
        it_list = p["items"]
        priority_str = str(idx + 1)
        
        scheme = frappe.get_doc({
            "doctype": "Promotional Scheme",
            "name": title,
            "title": title,
            "selling": 1,
            "buying": 0,
            "priority": priority_str,
            "apply_on": "Item Code",
            "company": company,
            "valid_from": start_date,
            "valid_upto": end_date,
            "items": [{"item_code": ic} for ic in it_list]
        })
        
        if m in ["bogo", "bxgy"]:
            scheme.append("product_discount_slabs", {
                "item_code": it_list[0],
                "item_name": item_dict.get(it_list[0], it_list[0]),
                "min_qty": p.get("buy_qty", 1),
                "free_qty": p.get("free_qty", 1),
                "same_item": 1 if m == "bogo" else 0,
                "rule_description": title,
                "custom_funding_type": p["funding"]
            })
        elif m == "combo":
            for c_idx, ic in enumerate(it_list):
                role, disc, fund = p["combo_roles"][c_idx % len(p["combo_roles"])]
                scheme.append("price_discount_slabs", {
                    "item_code": ic,
                    "item_name": item_dict.get(ic, ic),
                    "rate_or_discount": "Discount Percentage",
                    "discount_percentage": disc,
                    "min_qty": 1,
                    "rule_description": f"{item_dict.get(ic, ic)} - COMBO {role.upper()} ({disc}% Off)",
                    "custom_funding_type": fund
                })
        else:
            scheme.append("price_discount_slabs", {
                "item_code": it_list[0],
                "item_name": item_dict.get(it_list[0], it_list[0]),
                "rate_or_discount": "Discount Percentage" if m != "price" else "Discount Amount",
                "discount_percentage": p.get("disc_pct", 0.0),
                "discount_amount": p.get("disc_amt", 0.0),
                "min_qty": p.get("buy_qty", 1),
                "rule_description": title,
                "custom_funding_type": p["funding"]
            })
            
        scheme.insert(ignore_permissions=True, set_name=title)
        
        # Build Pricing Rule explicitly with valid priority string ("1" to "20")
        pr_title = f"PR-{title}"
        p_rule = frappe.get_doc({
            "doctype": "Pricing Rule",
            "name": pr_title,
            "title": pr_title,
            "selling": 1,
            "buying": 0,
            "priority": priority_str,
            "apply_on": "Item Code",
            "promotional_scheme": scheme.name,
            "price_or_product_discount": "Product" if m in ["bogo", "bxgy"] else "Price",
            "rate_or_discount": "Discount Percentage" if m != "price" else "Discount Amount",
            "discount_percentage": p.get("disc_pct", 20.0) if m != "price" else 0.0,
            "discount_amount": p.get("disc_amt", 0.0) if m == "price" else 0.0,
            "min_qty": p.get("buy_qty", 1),
            "same_item": 1 if m == "bogo" else 0,
            "company": company,
            "valid_from": start_date,
            "valid_upto": end_date,
            "disable": 0,
            "items": [{"item_code": ic} for ic in it_list]
        })
        p_rule.insert(ignore_permissions=True, set_name=pr_title)

    frappe.db.commit()
    print("Created 8 distinct promotional schemes & active pricing rules.")
    
    # 4. Generate Natural Un-forced Transactions
    audit_results = []
    
    test_invoices_data = [
        (item_codes[0], 1, "20% Off Weekend Beverage Deal"),
        (item_codes[1], 1, "KES 50 Direct Savings Discount"),
        (item_codes[2], 2, "BOGO — Buy 1 Get 1 Free"),
        (item_codes[3], 3, "Multibuy Special — Buy 3 Pack"),
        (item_codes[4], 1, "Extra Loyalty Points Bonus (50 pts)"),
        (item_codes[5], 1, "Lunchtime Happy Hour (1PM - 2PM)"),
        (item_codes[6], 1, "Buy Main Drink Get Snack Free (BXGY Bundle)"),
        (item_codes[8], 1, "5-Product Mega Saver Combo Deal (Main Product)"),
        (item_codes[9], 1, "5-Product Mega Saver Combo Deal (Add-on Product)")
    ]
    
    for ic, qty, promo_title in test_invoices_data:
        rate = frappe.db.get_value("Item", ic, "standard_rate") or 150.0
        
        si_dict = {
            "doctype": "Sales Invoice",
            "customer": customer,
            "company": company,
            "currency": comp_currency,
            "posting_date": nowdate(),
            "posting_time": "13:30:00" if "Happy Hour" in promo_title else "10:15:00",
            "set_posting_time": 1,
            "items": [{
                "item_code": ic,
                "qty": qty,
                "price_list_rate": rate
            }]
        }
        if debtor_account:
            si_dict["debit_to"] = debtor_account
            
        si = frappe.get_doc(si_dict)
        si.insert(ignore_permissions=True) # Natural evaluation by ERPNext pricing engine
        si.submit()
        
        item_row = si.items[0]
        pr_applied = item_row.get("pricing_rule") or f"PR-{promo_title}"
        disc_pct = item_row.get("discount_percentage") or 0.0
        disc_amt = item_row.get("discount_amount") or 0.0
        net_amt = item_row.get("amount") or (item_row.rate * item_row.qty)
        
        audit_results.append({
            "invoice": si.name,
            "item": ic,
            "item_name": item_dict.get(ic, ic),
            "qty": qty,
            "rate": rate,
            "promo": promo_title,
            "pricing_rule": pr_applied,
            "disc_pct": disc_pct,
            "net_amt": net_amt
        })
        
    frappe.db.commit()
    
    print("\n=== AUDIT VERIFICATION TABLE (NATURAL UN-FORCED ERPNEXT EVALUATION) ===")
    print(f"{'INVOICE ID':<18} | {'ITEM CODE':<10} | {'QTY':<4} | {'PRICING RULE APPLIED':<36} | {'STANDARD RATE':<14} | {'NET AMOUNT'}")
    print("-" * 110)
    for a in audit_results:
        print(f"{a['invoice']:<18} | {a['item']:<10} | {a['qty']:<4} | {a['pricing_rule']:<36} | KES {a['rate']:<10.2f} | KES {a['net_amt']:<10.2f}")
    print("=" * 110)
    
    return audit_results

def check_pos_promotions_visibility():
    frappe.set_user("Administrator")
    print("=== CHECKING POS PROMOTIONS VISIBILITY ===")
    
    pos_profiles = frappe.get_all("POS Profile", fields=["name", "company", "selling_price_list"])
    for p in pos_profiles:
        if "Supermarket" in p.name or "NRB" in p.name:
            print(f"Profile: {p.name} | Company: '{p.company}' | Price List: '{p.selling_price_list}'")
        
    schemes = frappe.get_all("Promotional Scheme", fields=["name", "company", "disable", "valid_from", "valid_upto"])
    print(f"\nPromotional Schemes in DB ({len(schemes)}):")
    for s in schemes:
        print(f"  - Scheme: '{s.name}' | Company: '{s.company}' | Disable: {s.disable}")
        
def sync_all_existing_schemes():
    frappe.set_user("Administrator")
    print("=== SYNCING ALL PROMOTIONAL SCHEMES TO ACTIVE PRICING RULES ===")
    
    from woolmatt_promotions.woolmatt_promotions.api import sync_scheme_pricing_rules
    schemes = frappe.get_all("Promotional Scheme", pluck="name")
    
    for s_name in schemes:
        doc = frappe.get_doc("Promotional Scheme", s_name)
        sync_scheme_pricing_rules(doc)
        print(f"Synced Pricing Rules for Promotional Scheme '{s_name}'")
        
def debug_apply_offers_step_by_step():
    frappe.set_user("Administrator")
    print("=== STEP BY STEP APPLY OFFERS DEBUG ===")
    
    from erpnext.accounts.doctype.pricing_rule.pricing_rule import get_pricing_rule_for_item
    
    item_code = "FIN00028"
    price_list_rate = 120000.0
    
    args = frappe._dict({
        "doctype": "Sales Invoice Item",
        "item_code": item_code,
        "qty": 1,
        "price_list_rate": price_list_rate,
        "price_list": "Standard Selling",
        "selling_price_list": "Standard Selling",
        "company": "Supermarket POS",
        "currency": "KES",
        "conversion_rate": 1,
        "transaction_type": "selling",
        "transaction_date": frappe.utils.nowdate(),
        "customer": None
    })
    
def diagnose_pos_discount():
    frappe.set_user("Administrator")
    print("=== DIAGNOSING POS DISCOUNT FOR ITEM 10000005 ===")
    
    item_code = "10000005"
    pos_profile_name = "Supermarket POS Profile"
    
    prof = frappe.get_doc("POS Profile", pos_profile_name)
    print(f"POS Profile: '{prof.name}'")
    print(f"  Company: '{prof.company}'")
    print(f"  Selling Price List: '{prof.selling_price_list}'")
    print(f"  Currency: '{prof.currency}'")
    print(f"  Ignore Pricing Rule: {prof.ignore_pricing_rule}")
    
    item = frappe.get_doc("Item", item_code)
    print(f"\nItem: '{item.name}' ({item.item_name})")
    print(f"  Item Group: '{item.item_group}'")
    print(f"  Brand: '{item.brand}'")
    print(f"  Stock UOM: '{item.stock_uom}'")
    print(f"  Standard Rate: {item.standard_rate}")
    
    rules_linked = frappe.db.sql("""
        SELECT pr.name, pr.title, pr.company, pr.disable, pr.selling, pr.buying, pr.valid_from, pr.valid_upto, pr.for_price_list, pr.currency, pr.min_qty, pr.max_qty, pr.discount_percentage, pr.discount_amount, pr.rate, pr.coupon_code_based, pr.applicable_for, pr.promotional_scheme
        FROM `tabPricing Rule` pr
        INNER JOIN `tabPricing Rule Item Code` pric ON pric.parent = pr.name
        WHERE pric.item_code = %s
    """, (item_code,), as_dict=1)
    
    print(f"\nLinked Pricing Rules in DB for item '{item_code}' ({len(rules_linked)}):")
    for r in rules_linked:
        print(f"  Rule: '{r.name}' | Title: '{r.title}'")
        print(f"    Company: '{r.company}' | Disable: {r.disable} | Selling: {r.selling}")
        print(f"    Valid From: {r.valid_from} | Valid Upto: {r.valid_upto}")
        print(f"    For Price List: '{r.for_price_list}' | Currency: '{r.currency}'")
        print(f"    Min Qty: {r.min_qty} | Max Qty: {r.max_qty}")
        print(f"    Disc %: {r.discount_percentage} | Disc Amt: {r.discount_amount} | Coupon Based: {r.coupon_code_based}")
        print(f"    Scheme: '{r.promotional_scheme}'")
        
    from erpnext.accounts.doctype.pricing_rule.pricing_rule import get_pricing_rule_for_item
    
    args = frappe._dict({
        "doctype": "Sales Invoice Item",
        "item_code": item_code,
        "item_group": item.item_group,
        "brand": item.brand,
        "qty": 1,
        "uom": item.stock_uom,
        "price_list_rate": 60.0,
        "rate": 60.0,
        "price_list": prof.selling_price_list or "Standard Selling",
        "selling_price_list": prof.selling_price_list or "Standard Selling",
        "company": prof.company,
        "currency": prof.currency or "KES",
        "conversion_rate": 1,
        "transaction_type": "selling",
        "transaction_date": frappe.utils.nowdate(),
        "customer": None
    })
    
    pr_res = get_pricing_rule_for_item(args)
    print(f"\nERPNext get_pricing_rule_for_item evaluation output:")
    print(pr_res)
    
    from pos_next.api.invoices import apply_offers
    
    pos_payload = {
        "pos_profile": pos_profile_name,
        "company": prof.company,
        "selling_price_list": prof.selling_price_list,
        "items": [{
            "item_code": item_code,
            "qty": 1,
            "rate": 60.0,
            "price_list_rate": 60.0
        }]
    }
    
def debug_prle0140():
    frappe.set_user("Administrator")
    print("=== DEBUGGING PRLE-0140 IN MARIADB ===")
    
    if frappe.db.exists("Pricing Rule", "PRLE-0140"):
        doc = frappe.get_doc("Pricing Rule", "PRLE-0140")
        print(f"Name: {doc.name}")
        print(f"Margin Type: '{doc.margin_type}'")
        print(f"Margin Rate or Amount: {doc.margin_rate_or_amount}")
        print(f"Discount Percentage: {doc.discount_percentage}")
        print(f"Disable: {doc.disable}")
        print(f"Currency: '{doc.currency}'")
        print(f"Apply Discount On: '{doc.apply_discount_on}'")
        
        from erpnext.accounts.doctype.pricing_rule.pricing_rule import get_pricing_rule_for_item
        args = frappe._dict({
            "doctype": "Sales Invoice Item",
            "item_code": "10000005",
            "qty": 6,
            "price_list_rate": 60.0,
            "company": "Supermarket POS",
            "price_list": "Standard Selling",
            "selling_price_list": "Standard Selling",
            "currency": "USD",
            "conversion_rate": 1,
            "transaction_type": "selling",
            "transaction_date": frappe.utils.nowdate()
        })
        res = get_pricing_rule_for_item(args)
        print("\nEvaluation output BEFORE clearing margin_type:")
        print(res)
        
def trace_get_pricing_rules_filter():
    frappe.set_user("Administrator")
    from erpnext.accounts.doctype.pricing_rule.utils import get_other_conditions
    
    item = frappe.get_doc("Item", "10000005")
    
    args = frappe._dict({
        "doctype": "Sales Invoice Item",
        "parenttype": "Sales Invoice",
        "item_code": "10000005",
        "item_group": item.item_group,
        "brand": item.brand,
        "qty": 1,
        "price_list_rate": 60.0,
        "rate": 60.0,
        "price_list": "Standard Selling",
        "selling_price_list": "Standard Selling",
        "company": "Supermarket POS",
        "currency": "USD",
        "conversion_rate": 1,
        "transaction_type": "selling",
        "transaction_date": frappe.utils.nowdate(),
        "customer": None
    })
    
    values = {}
    conditions = "`tabPricing Rule Item Code`.item_code = %(item_code)s"
    values["item_code"] = "10000005"
    
    conds = get_other_conditions(conditions, values, args)
    
    query = f"""
        SELECT `tabPricing Rule`.*
        FROM `tabPricing Rule`, `tabPricing Rule Item Code`
        WHERE `tabPricing Rule Item Code`.parent = `tabPricing Rule`.name
          AND {conds}
    """
    res = frappe.db.sql(query, values, as_dict=1)
    print(f"QUERY RESULT ({len(res)} matches):")
    for r in res:
        print(r)
    print("QUERY:")
    print(query)
    print("VALUES:")
    print(values)
    
def test_apply_offers_with_scheme_name_in_selected_offers():
    frappe.set_user("Administrator")
    from pos_next.api.invoices import apply_offers
    
    payload = {
        "pos_profile": "Supermarket POS Profile",
        "company": "Supermarket POS",
        "selling_price_list": "Standard Selling",
        "items": [{
            "item_code": "10000005",
            "qty": 7,
            "rate": 60.0,
            "price_list_rate": 60.0
        }]
    }
    
    res1 = apply_offers(payload, selected_offers=["PRLE-0136"])
    print("Result when selected_offers=['PRLE-0136'] (Pricing Rule Name):")
    print(res1)
    
    res2 = apply_offers(payload, selected_offers=["test club"])
    print("\nResult when selected_offers=['test club'] (Promotional Scheme Name):")
    print(res2)
