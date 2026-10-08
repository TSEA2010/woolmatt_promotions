import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def after_install():
    create_doctype_supplier_rebate_claim()
    update_client_script_in_db()
    
    create_custom_fields({
        "Pricing Rule": [
            {"fieldname": "custom_is_woolmatt_promo", "label": "Is Woolmatt Promo", "fieldtype": "Check", "insert_after": "selling"},
            {"fieldname": "custom_funding_type", "label": "Funding Type", "fieldtype": "Select", "options": "Supplier\nSelf\nBoth", "default": "Supplier", "insert_after": "custom_is_woolmatt_promo"},
            {"fieldname": "custom_supplier_funding_percentage", "label": "Supplier Funding %", "fieldtype": "Float", "insert_after": "custom_funding_type"},
            {"fieldname": "custom_supplier", "label": "Supplier", "fieldtype": "Link", "options": "Supplier", "insert_after": "custom_supplier_funding_percentage"},
            {"fieldname": "custom_woolmatt_promo_id", "label": "Woolmatt Promo ID", "fieldtype": "Data", "insert_after": "custom_supplier", "read_only": 1},
            {"fieldname": "custom_happy_hour_slots", "label": "Happy Hour Slots", "fieldtype": "JSON", "insert_after": "custom_woolmatt_promo_id", "read_only": 1},
        ],
        "Sales Invoice Item": [
            {"fieldname": "custom_supplier_rebate_amount", "label": "Supplier Rebate Amount", "fieldtype": "Currency", "insert_after": "discount_amount"},
            {"fieldname": "custom_self_funded_amount", "label": "Self Funded Amount", "fieldtype": "Currency", "insert_after": "custom_supplier_rebate_amount"},
        ]
    })
    frappe.db.commit()

def update_client_script_in_db():
    import os
    js_path = os.path.join(os.path.dirname(__file__), "..", "public", "js", "promotional_scheme_custom.js")
    if not os.path.exists(js_path):
        return
    with open(js_path, "r", encoding="utf-8") as f:
        script_code = f.read()

    existing = frappe.db.get_value("Client Script", {"dt": "Promotional Scheme"}, "name")
    if existing:
        doc = frappe.get_doc("Client Script", existing)
        doc.script = script_code
        doc.enabled = 1
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc({
            "doctype": "Client Script",
            "name": "Promotional Scheme Woolmatt Custom",
            "dt": "Promotional Scheme",
            "script": script_code,
            "enabled": 1
        })
        doc.insert(ignore_permissions=True)

def create_doctype_supplier_rebate_claim():
    if not frappe.db.exists("DocType", "Supplier Rebate Claim"):
        doc = frappe.get_doc({
            "doctype": "DocType",
            "name": "Supplier Rebate Claim",
            "module": "Woolmatt Promotions",
            "custom": 1,
            "naming_rule": "Expression",
            "autoname": "format:SRC-{YYYY}-{MM}-{####}",
            "fields": [
                {"fieldname": "supplier", "label": "Supplier", "fieldtype": "Link", "options": "Supplier", "reqd": 1, "in_list_view": 1},
                {"fieldname": "pricing_rule", "label": "Pricing Rule", "fieldtype": "Link", "options": "Pricing Rule", "reqd": 1, "in_list_view": 1},
                {"fieldname": "sales_invoice", "label": "Sales Invoice", "fieldtype": "Link", "options": "Sales Invoice", "reqd": 1},
                {"fieldname": "item_code", "label": "Item Code", "fieldtype": "Link", "options": "Item", "reqd": 1, "in_list_view": 1},
                {"fieldname": "qty", "label": "Quantity", "fieldtype": "Float", "reqd": 1},
                {"fieldname": "rebate_amount", "label": "Rebate Amount", "fieldtype": "Currency", "reqd": 1, "in_list_view": 1},
                {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Pending\nClaimed\nSettled", "default": "Pending", "in_list_view": 1},
                {"fieldname": "date", "label": "Date", "fieldtype": "Date", "reqd": 1}
            ],
            "permissions": [{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}]
        })
        doc.insert(ignore_permissions=True)