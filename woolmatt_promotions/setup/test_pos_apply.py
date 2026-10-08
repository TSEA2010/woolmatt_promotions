import frappe

def test_pos_apply():
    frappe.set_user("Administrator")
    import erpnext.accounts.doctype.pricing_rule.pricing_rule as pr_module
    import woolmatt_promotions
    
    # Check POS profile defaults
    pos_profiles = frappe.get_all("POS Profile", fields=["name", "company", "customer", "selling_price_list"])
    print("POS Profiles in system:", pos_profiles)
    
    pos_customer = pos_profiles[0].customer if pos_profiles else "Walk-in Customer"
    cust_doc = frappe.get_doc("Customer", pos_customer) if frappe.db.exists("Customer", pos_customer) else None
    
    cust_group = cust_doc.customer_group if cust_doc else "All Customer Groups"
    territory = cust_doc.territory if cust_doc else "All Territories"
    
    print(f"\nTesting item 10000007 with Customer: '{pos_customer}', Group: '{cust_group}', Territory: '{territory}'")
    
    item_code = "10000007"
    item_doc = frappe.get_doc("Item", item_code)
    
    args_pos = frappe._dict({
        "item_code": item_code,
        "item_group": item_doc.item_group,
        "brand": item_doc.brand,
        "qty": 1,
        "stock_qty": 1,
        "price_list": "Standard Selling",
        "currency": "KES",
        "company": "Supermarket POS",
        "customer": pos_customer,
        "customer_group": cust_group,
        "territory": territory,
        "doctype": "POS Invoice",
        "conversion_rate": 1,
        "price_list_currency": "KES",
        "plc_conversion_rate": 1,
        "company_currency": "KES",
        "transaction_date": frappe.utils.nowdate()
    })
    
    pr_module.set_transaction_type(args_pos)
    res = pr_module.get_pricing_rule_for_item(args_pos)
    print("\nResult for POS Invoice item line:")
    print("  Has Pricing Rule?:", res.get("has_pricing_rule"))
    print("  Applied Rules:", res.get("pricing_rules"))
    print("  Discount Pct:", res.get("discount_percentage"))
    print("  Discount Amt:", res.get("discount_amount"))
    print("  Price List Rate:", res.get("price_list_rate"))

