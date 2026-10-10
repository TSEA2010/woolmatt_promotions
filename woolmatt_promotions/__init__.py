__version__ = '0.0.1'

import frappe

def patch_pricing_rules():
    """
    Patches ERPNext pricing rule engine to fix two major core issues:
    1. Ensures POS Invoice and POS Invoice Item are recognized as 'selling' transactions (preventing default to 'buying' which filters out all selling pricing rules).
    2. Appends time to 10-character transaction_date strings ('YYYY-MM-DD' -> 'YYYY-MM-DD 12:00:00') to prevent MariaDB string-vs-datetime comparison bug where 'YYYY-MM-DD' < 'YYYY-MM-DD 00:00:00' evaluates to FALSE on valid_from start dates.
    """
    try:
        from erpnext.accounts.doctype.pricing_rule import pricing_rule as _pr_module
        
        def _woolmatt_set_transaction_type(pricing_ctx: frappe._dict) -> None:
            if pricing_ctx.transaction_type in ["buying", "selling"]:
                return
            if pricing_ctx.doctype in (
                "Opportunity", "Quotation", "Sales Order", "Delivery Note", 
                "Sales Invoice", "Sales Invoice Item", "POS Invoice", "POS Invoice Item", "POS Opening Entry"
            ):
                pricing_ctx.transaction_type = "selling"
            elif pricing_ctx.doctype in (
                "Material Request", "Supplier Quotation", "Purchase Order", 
                "Purchase Receipt", "Purchase Invoice", "Purchase Invoice Item"
            ):
                pricing_ctx.transaction_type = "buying"
            elif pricing_ctx.customer:
                pricing_ctx.transaction_type = "selling"
            else:
                pricing_ctx.transaction_type = "buying"

        _pr_module.set_transaction_type = _woolmatt_set_transaction_type
    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="WoolMatt set_transaction_type Patch Error")

    try:
        from erpnext.accounts.doctype.pricing_rule import utils as _pr_utils
        _orig_get_other_conditions = _pr_utils.get_other_conditions

        def _woolmatt_get_other_conditions(conditions, values, args):
            dt = args.get("transaction_date") or args.get("posting_date")
            if isinstance(dt, str) and len(dt) == 10:
                if isinstance(args, dict):
                    args["transaction_date"] = dt + " 12:00:00"
                else:
                    try:
                        args.set("transaction_date", dt + " 12:00:00")
                    except Exception:
                        setattr(args, "transaction_date", dt + " 12:00:00")

            return _orig_get_other_conditions(conditions, values, args)

        _pr_utils.get_other_conditions = _woolmatt_get_other_conditions
    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="WoolMatt get_other_conditions Patch Error")

# Execute patches on module load
patch_pricing_rules()