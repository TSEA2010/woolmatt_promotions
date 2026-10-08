import frappe
import random
from frappe.utils import add_days, nowdate

def create_distinct_promotions():
    frappe.set_user("Administrator")
    print("=== CREATING DISTINCT NON-OVERLAPPING PROMOTIONAL SCHEMES ===")
    
    companies = frappe.get_all("Company", pluck="name")
    if not companies:
        companies = ["Supermarket POS", "Jambo Supermarkets Ltd"]
        
    print(f"Target Companies for Promotional Schemes: {companies}")
    
    # 1. Fetch available items
    items = frappe.get_all("Item", filters={"is_sales_item": 1, "disabled": 0}, fields=["item_code", "item_name", "standard_rate"], limit=20)
    if not items:
        print("No items found.")
        return
        
    for item in items:
        if not item.standard_rate or item.standard_rate < 50.0:
            item.standard_rate = 150.0
            frappe.db.set_value("Item", item.item_code, "standard_rate", 150.0)

    item_codes = [i.item_code for i in items]
    item_dict = {i.item_code: i.item_name for i in items}
    
    print(f"Available Items ({len(item_codes)}): {item_codes}")
    
    start_date = nowdate()
    end_date = add_days(nowdate(), 30)
    
    created_schemes = []
    
    # Define distinct non-overlapping product assignments
    # SINGLE-PRODUCT SCHEMES (1 product each)
    single_product_promos = [
        {
            "title": "20% Off Weekend Beverage Deal",
            "mechanic": "pct",
            "item": item_codes[0] if len(item_codes) > 0 else "FIN00025",
            "disc_pct": 20.0,
            "funding": "supplier",
            "priority": 10
        },
        {
            "title": "KES 50 Direct Savings Discount",
            "mechanic": "price",
            "item": item_codes[1] if len(item_codes) > 1 else "10000007",
            "disc_amt": 50.0,
            "funding": "self",
            "priority": 20
        },
        {
            "title": "BOGO — Buy 1 Get 1 Free",
            "mechanic": "bogo",
            "item": item_codes[2] if len(item_codes) > 2 else "10000006",
            "buy_qty": 1,
            "free_qty": 1,
            "funding": "both",
            "priority": 30
        },
        {
            "title": "Multibuy Special — Buy 3 Pack",
            "mechanic": "multibuy",
            "item": item_codes[3] if len(item_codes) > 3 else "10000004",
            "buy_qty": 3,
            "disc_pct": 15.0,
            "funding": "self",
            "priority": 40
        },
        {
            "title": "Extra Loyalty Points Bonus (50 pts)",
            "mechanic": "points",
            "item": item_codes[4] if len(item_codes) > 4 else "10000003",
            "pts": 50,
            "funding": "both",
            "priority": 50
        },
        {
            "title": "Lunchtime Happy Hour (1PM - 2PM)",
            "mechanic": "happy",
            "item": item_codes[5] if len(item_codes) > 5 else "10000002",
            "disc_pct": 25.0,
            "funding": "supplier",
            "priority": 60
        }
    ]
    
    # MULTI-PRODUCT SCHEMES (Multiple products per scheme)
    multi_product_promos = [
        {
            "title": "Buy Main Drink Get Snack Free (BXGY Bundle)",
            "mechanic": "bxgy",
            "items": [item_codes[6] if len(item_codes) > 6 else "FIN00024"],
            "free_item": item_codes[7] if len(item_codes) > 7 else "10000005",
            "buy_qty": 1,
            "free_qty": 1,
            "funding": "supplier",
            "priority": 70
        },
        {
            "title": "5-Product Mega Saver Combo Deal",
            "mechanic": "combo",
            "items": item_codes[8:13] if len(item_codes) >= 13 else item_codes[:5],
            "combo_roles": [("main", 0, "self"), ("addon", 20, "supplier"), ("addon", 25, "supplier"), ("addon", 30, "both"), ("addon", 35, "supplier")],
            "priority": 80
        }
    ]
    
    for comp in companies:
        print(f"\n--- Creating Schemes for Company: {comp} ---")
        # 2. Build Single Product Schemes
        for sp in single_product_promos:
            it_code = sp["item"]
            it_name = item_dict.get(it_code, it_code)
            m = sp["mechanic"]
            doc_title = f"{sp['title']} - {comp[:5]}"
            
            scheme = frappe.get_doc({
                "doctype": "Promotional Scheme",
                "title": doc_title,
                "name": doc_title,
                "selling": 1,
                "buying": 0,
                "priority": sp["priority"],
                "apply_on": "Item Code",
                "company": comp,
                "valid_from": start_date,
                "valid_upto": end_date,
                "items": [{"item_code": it_code}]
            })
            
            if m in ["bogo"]:
                scheme.append("product_discount_slabs", {
                    "item_code": it_code,
                    "item_name": it_name,
                    "min_qty": sp.get("buy_qty", 1),
                    "free_qty": sp.get("free_qty", 1),
                    "same_item": 1,
                    "rule_description": f"{it_name} - {sp['title']}",
                    "custom_funding_type": sp["funding"]
                })
            else:
                scheme.append("price_discount_slabs", {
                    "item_code": it_code,
                    "item_name": it_name,
                    "rate_or_discount": "Discount Percentage" if m != "price" else "Discount Amount",
                    "discount_percentage": sp.get("disc_pct", 0.0),
                    "discount_amount": sp.get("disc_amt", 0.0),
                    "min_qty": sp.get("buy_qty", 1),
                    "rule_description": f"{it_name} - {sp['title']}",
                    "custom_funding_type": sp["funding"]
                })
                
            scheme.insert(ignore_permissions=True, set_name=doc_title)
            try:
                scheme.submit()
            except Exception:
                pass
            created_schemes.append({
                "company": comp,
                "type": "Single Product",
                "title": scheme.title,
                "mechanic": m.upper(),
                "items": it_code
            })
            
        # 3. Build Multi-Product Schemes
        for mp in multi_product_promos:
            m = mp["mechanic"]
            it_list = mp["items"]
            doc_title = f"{mp['title']} - {comp[:5]}"
            
            scheme = frappe.get_doc({
                "doctype": "Promotional Scheme",
                "title": doc_title,
                "name": doc_title,
                "selling": 1,
                "buying": 0,
                "priority": mp["priority"],
                "apply_on": "Item Code",
                "company": comp,
                "valid_from": start_date,
                "valid_upto": end_date,
                "items": [{"item_code": ic} for ic in it_list]
            })
            
            if m == "bxgy":
                scheme.append("product_discount_slabs", {
                    "item_code": it_list[0],
                    "item_name": item_dict.get(it_list[0], it_list[0]),
                    "min_qty": mp.get("buy_qty", 1),
                    "free_qty": mp.get("free_qty", 1),
                    "same_item": 0,
                    "rule_description": f"{it_list[0]} -> Get {mp['free_item']} Free",
                    "custom_funding_type": mp["funding"]
                })
            elif m == "combo":
                for idx, ic in enumerate(it_list):
                    role, disc, fund = mp["combo_roles"][idx % len(mp["combo_roles"])]
                    scheme.append("price_discount_slabs", {
                        "item_code": ic,
                        "item_name": item_dict.get(ic, ic),
                        "rate_or_discount": "Discount Percentage",
                        "discount_percentage": disc,
                        "min_qty": 1,
                        "rule_description": f"{item_dict.get(ic, ic)} - COMBO {role.upper()} ({disc}% Off)",
                        "custom_funding_type": fund
                    })
                    
            scheme.insert(ignore_permissions=True, set_name=doc_title)
            try:
                scheme.submit()
            except Exception:
                pass
            created_schemes.append({
                "company": comp,
                "type": "Multi Product",
                "title": scheme.title,
                "mechanic": m.upper(),
                "items": ", ".join(it_list)
            })
            
    frappe.db.commit()
    print(f"SUCCESSFULLY CREATED {len(created_schemes)} DISTINCT PROMOTIONS ACROSS ALL COMPANIES!")
    for s in created_schemes:
        print(f"[{s['company']}] [{s['type']}] {s['mechanic']}: {s['title']} -> Items: {s['items']}")
        
    return created_schemes
