app_name = "woolmatt_promotions"
app_title = "Woolmatt Promotions"
app_publisher = "Woolmatt"
app_description = "Advanced promotional scheme manager for Woolmatt ERP."
app_email = "admin@example.com"
app_license = "MIT"

# Setup hook to create custom fields
after_install = "woolmatt_promotions.setup.install.after_install"

# Form JS hooks
doctype_js = {
    "Promotional Scheme": "public/js/promotional_scheme_custom.js"
}

doc_events = {
    "Promotional Scheme": {
        "on_update": [
            "woolmatt_promotions.woolmatt_promotions.api.deactivate_conflicting_pricing_rules",
            "woolmatt_promotions.woolmatt_promotions.api.sync_scheme_pricing_rules"
        ]
    }
}