import frappe

def check_tet22():
    frappe.set_user("Administrator")
    import erpnext.accounts.doctype.pricing_rule.pricing_rule as pr_module
    import erpnext.accounts.doctype.pricing_rule.utils as pr_utils
    import woolmatt_promotions
    
    print("=== CHECKING PROMOTIONAL SCHEME: TET 22 ===")
    if not frappe.db.exists("Promotional Scheme", "TET 22"):
        print("TET 22 does not exist in DB!")
        return

    doc = frappe.get_doc("Promotional Scheme", "TET 22")
    print(f"Docstatus: {doc.docstatus}, Disable: {getattr(doc, 'disable', 0)}, Selling: {getattr(doc, 'selling', 1)}, Company: '{doc.company}'")
    print(f"Apply On: '{doc.apply_on}'")
    print(f"Valid From: '{doc.valid_from}', Valid Upto: '{doc.valid_upto}'")
    
    print("\n--- Linked Pricing Rules ---")
    rules = frappe.get_all("Pricing Rule", filters={"promotional_scheme": "TET 22"}, fields=["name", "title", "disable", "selling", "company", "discount_percentage", "discount_amount", "valid_from", "valid_upto"])
    print(f"Total Linked Pricing Rules: {len(rules)}")
    for r in rules:
        pr_doc = frappe.get_doc("Pricing Rule", r.name)
        items = [i.item_code for i in pr_doc.items]
        print(f"  Rule: {r.name} | Disable: {r.disable} | Selling: {r.selling} | Disc Pct: {r.discount_percentage} | Items: {items}")
        print(f"    Company: '{pr_doc.company}', Price List: '{pr_doc.for_price_list}', Customer: '{pr_doc.customer}', Supplier: '{pr_doc.supplier}'")

    print("\n--- Testing get_pricing_rule_for_item for items in TET 22 ---")
    test_items = ["10000007", "10000006", "10000005"]
    for item_code in test_items:
        item_doc = frappe.get_doc("Item", item_code)
        args_pos = frappe._dict({
            "item_code": item_code,
            "item_group": item_doc.item_group,
            "brand": item_doc.brand,
            "qty": 1,
            "stock_qty": 1,
            "price_list": "Standard Selling",
            "currency": "KES",
            "company": doc.company or "Supermarket POS",
            "customer": "",
            "customer_group": "All Customer Groups",
            "territory": "All Territories",
            "doctype": "POS Invoice",
            "conversion_rate": 1,
            "price_list_currency": "KES",
            "plc_conversion_rate": 1,
            "company_currency": "KES",
            "transaction_date": frappe.utils.nowdate()
        })
        
        pr_module.set_transaction_type(args_pos)
        res = pr_module.get_pricing_rule_for_item(args_pos)
        print(f"\nItem {item_code} ({item_doc.item_name}):")
        print(f"  Has Pricing Rule?: {res.get('has_pricing_rule')}")
        print(f"  Applied Rules: {res.get('pricing_rules')}")
        print(f"  Discount Pct: {res.get('discount_percentage')}")
        print(f"  Discount Amt: {res.get('discount_amount')}")

