import frappe

def apply_pos_next_patch():
    file_path = "/home/Admin/frappe-bench-v16/apps/pos_next/pos_next/api/invoices.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    target = "rule_map = {name: details for name, details in rule_map.items() if name in selected_offer_names}"
    replacement = """rule_map = {
				name: details for name, details in rule_map.items()
				if name in selected_offer_names
				or (details.get("promotional_scheme") and details.get("promotional_scheme") in selected_offer_names)
				or (details.get("promotional_scheme_id") and details.get("promotional_scheme_id") in selected_offer_names)
			}"""
            
    if target in content:
        content = content.replace(target, replacement, 1)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("POSNext apply_offers patch applied successfully!")
    else:
        print("Target string already patched or not found.")
