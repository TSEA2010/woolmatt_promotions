import frappe

def cleanup_simulation_data():
    frappe.set_user("Administrator")
    print("=== STARTING CLEANUP OF SIMULATION DATA ===")
    
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
    
    sim_schemes = frappe.get_all("Promotional Scheme", filters=[["name", "like", "SIM-%"]], pluck="name")
    combo_schemes = frappe.get_all("Promotional Scheme", filters=[["name", "like", "5-Item Mega Combo Deal%"]], pluck="name")
    distinct_schemes = frappe.get_all("Promotional Scheme", filters=[["name", "in", titles_to_remove]], pluck="name")
    
    target_schemes = list(set(sim_schemes + combo_schemes + distinct_schemes))
    print(f"Found {len(target_schemes)} simulation promotional schemes to delete.")
    
    # Delete Invoices for Audit Customer or Walk-in Customer
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
            
    # Delete Pricing Rules
    for ps in target_schemes:
        prs = frappe.get_all("Pricing Rule", filters=[["promotional_scheme", "=", ps]], pluck="name")
        for pr in prs:
            frappe.db.sql("DELETE FROM `tabPricing Rule Item Code` WHERE parent = %s", pr)
            frappe.db.sql("DELETE FROM `tabPricing Rule Item Group` WHERE parent = %s", pr)
            frappe.db.sql("DELETE FROM `tabPricing Rule Brand` WHERE parent = %s", pr)
            frappe.db.sql("DELETE FROM `tabPricing Rule` WHERE name = %s", pr)
            
        frappe.db.sql("DELETE FROM `tabPromotional Scheme Price Discount` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPromotional Scheme Product Discount` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPricing Rule Item Code` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPricing Rule Item Group` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPricing Rule Brand` WHERE parent = %s", ps)
        frappe.db.sql("DELETE FROM `tabPromotional Scheme` WHERE name = %s", ps)
        
    frappe.db.commit()
    print("=== SIMULATION DATA CLEANUP COMPLETE ===")
    return f"Successfully cleaned {len(target_schemes)} schemes and {len(sim_invoices)} invoices."
