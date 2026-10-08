import frappe
import random
from frappe.utils import add_days, nowdate

def create_natural_transactions():
    frappe.set_user("Administrator")
    print("=== STARTING NATURAL UN-FORCED TRANSACTIONS GENERATION FOR AUDITING ===")
    
    companies = frappe.get_all("Company", pluck="name")
    company = companies[0] if companies else "Jambo Supermarkets Ltd"
    comp_currency = frappe.db.get_value("Company", company, "default_currency") or "KES"
    debtor_account = frappe.db.get_value("Account", {"company": company, "account_type": "Receivable", "is_group": 0}, "name")
    cust_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "Individual"
    territory = frappe.db.get_value("Territory", {"is_group": 0}, "name") or "Kenya"
    
    # 1. Get or create Customer with matching currency & non-group customer group
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
        
    # Target item list from distinct non-overlapping promotions created above
    target_items_map = [
        ("FIN00028", 1, "20% Off Weekend Beverage Deal"),
        ("FIN00027", 1, "KES 50 Direct Savings Discount"),
        ("FIN00026", 2, "BOGO — Buy 1 Get 1 Free"),
        ("FIN00025", 3, "Multibuy Special — Buy 3 Pack"),
        ("FIN00024", 1, "Extra Loyalty Points Bonus (50 pts)"),
        ("FIN00023", 1, "Lunchtime Happy Hour (1PM - 2PM)"),
        ("FIN00022", 1, "Buy Main Drink Get Snack Free (BXGY Bundle)"),
        ("FIN00020", 1, "5-Product Mega Saver Combo Deal (Main Item)"),
        ("FIN00019", 1, "5-Product Mega Saver Combo Deal (Add-on 20%)"),
        ("FIN00018", 1, "5-Product Mega Saver Combo Deal (Add-on 25%)")
    ]
    
    created_invoices = []
    
    for item_code, default_qty, promo_title in target_items_map:
        if not frappe.db.exists("Item", item_code):
            print(f"Skipping {item_code} - item does not exist.")
            continue
            
        rate = frappe.db.get_value("Item", item_code, "standard_rate") or 150.0
        
        # Create Sales Invoice WITHOUT setting ignore_pricing_rule (Natural ERPNext Pricing Engine)
        si_dict = {
            "doctype": "Sales Invoice",
            "customer": customer,
            "company": company,
            "currency": comp_currency,
            "posting_date": nowdate(),
            "posting_time": "13:30:00" if "Happy Hour" in promo_title else "10:15:00",
            "set_posting_time": 1,
            "items": [{
                "item_code": item_code,
                "qty": default_qty,
                "price_list_rate": rate
            }]
        }
        if debtor_account:
            si_dict["debit_to"] = debtor_account
            
        si = frappe.get_doc(si_dict)
        
        # ERPNext evaluates pricing rules naturally on insert/validate
        si.insert(ignore_permissions=True)
        si.submit()
        
        # Inspect what ERPNext pricing engine evaluated on the item row
        item_row = si.items[0]
        applied_rule = item_row.get("pricing_rule") or "None"
        disc_pct = item_row.get("discount_percentage") or 0.0
        disc_amt = item_row.get("discount_amount") or 0.0
        net_amount = item_row.get("amount") or (item_row.rate * item_row.qty)
        
        created_invoices.append({
            "invoice": si.name,
            "item": item_code,
            "qty": default_qty,
            "standard_rate": rate,
            "promo_title": promo_title,
            "applied_pricing_rule": applied_rule,
            "disc_pct": f"{disc_pct}%",
            "disc_amt": f"{comp_currency} {disc_amt}",
            "net_amount": f"{comp_currency} {net_amount}"
        })
        print(f"Submitted Natural Invoice {si.name} for {item_code} ({promo_title}): Rule={applied_rule}, Net={net_amount}")
        
    frappe.db.commit()
    
    print("\n=== AUDIT VERIFICATION REPORT (NATURAL UN-FORCED TRANSACTIONS) ===")
    print(f"{'INVOICE ID':<18} | {'ITEM':<10} | {'QTY':<4} | {'PRICING RULE APPLIED':<28} | {'DISCOUNT':<12} | {'NET AMOUNT'}")
    print("-" * 105)
    for r in created_invoices:
        print(f"{r['invoice']:<18} | {r['item']:<10} | {r['qty']:<4} | {r['applied_pricing_rule']:<28} | {r['disc_pct']:<12} | {r['net_amount']}")
    print("=" * 105)
    
    return created_invoices
