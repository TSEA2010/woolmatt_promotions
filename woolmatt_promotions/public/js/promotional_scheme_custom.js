/*
 * Custom Client Script for ERPNext 'Promotional Scheme' Form
 * Auto-detects Combo Offer (Main + Add-ons) and all 8 mechanics to render exact table columns (ROLE, QTY, COMBO DISC %, YOU SAVE, OFFER PRICE).
 */

frappe.ui.form.on('Promotional Scheme', {
	refresh(frm) {
		$('.wm-enhanced-builder-btn').remove();
		$('button:contains("Enhanced Promotion Builder")').remove();
		if (frm.page) frm.page.clear_inner_actions();

		frm.doc.__wm_offer_type = detect_offer_type(frm);
		if (!frm.doc.__wm_hh_slots) frm.doc.__wm_hh_slots = [{ from: '13:00', to: '14:00' }];
		if (!frm.doc.__wm_hh_days) frm.doc.__wm_hh_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

		// Ensure Period Settings section & date fields are explicitly visible
		frm.set_df_property('period_settings_section', 'hidden', 0);
		frm.set_df_property('valid_from', 'hidden', 0);
		frm.set_df_property('valid_upto', 'hidden', 0);
		frm.set_df_property('company', 'hidden', 0);

		if (!frm.is_new()) {
			frm.add_custom_button(__('Promotion Performance Report'), function() {
				show_promotion_report_modal(frm);
			});
			frm.add_custom_button(__('Associated Pricing Rules'), function() {
				show_associated_pricing_rules_dialog(frm);
			});
			frm.add_custom_button(__('Extend Campaign'), function() {
				show_extend_campaign_dialog(frm);
			});
		}

		sync_scope_and_render(frm);
	},
	onload(frm) {
		frm.doc.__wm_offer_type = detect_offer_type(frm);
		sync_scope_and_render(frm);
	},
	apply_on(frm) {
		sync_scope_and_render(frm);
	},
	before_save(frm) {
		sync_items_to_form_slabs(frm);
	}
});

// Event listeners for all 4 top selection child tables
frappe.ui.form.on('Pricing Rule Item Code', {
	item_code(frm) { sync_scope_and_render(frm); },
	items_add(frm) { sync_scope_and_render(frm); },
	items_remove(frm) { sync_scope_and_render(frm); }
});

frappe.ui.form.on('Pricing Rule Item Group', {
	item_group(frm) { sync_scope_and_render(frm); },
	item_groups_add(frm) { sync_scope_and_render(frm); },
	item_groups_remove(frm) { sync_scope_and_render(frm); }
});

frappe.ui.form.on('Pricing Rule Brand', {
	brand(frm) { sync_scope_and_render(frm); },
	brands_add(frm) { sync_scope_and_render(frm); },
	brands_remove(frm) { sync_scope_and_render(frm); }
});

frappe.ui.form.on('Pricing Rule Supplier', {
	supplier(frm) { sync_scope_and_render(frm); },
	suppliers_add(frm) { sync_scope_and_render(frm); },
	suppliers_remove(frm) { sync_scope_and_render(frm); }
});

function detect_offer_type(frm) {
	if (frm.doc.__wm_offer_type) return frm.doc.__wm_offer_type;

	// 1. Check if offer_type is stored in custom_item_discounts_json
	if (frm.doc.custom_item_discounts_json) {
		try {
			const parsed = typeof frm.doc.custom_item_discounts_json === 'string'
				? JSON.parse(frm.doc.custom_item_discounts_json)
				: frm.doc.custom_item_discounts_json;
			if (parsed && parsed.offer_type) return parsed.offer_type;
		} catch(e) {}
	}

	const title = (frm.doc.title || frm.doc.name || '').toLowerCase();
	if (title.includes('bogo')) return 'bogo';
	if (title.includes('bxgy')) return 'bxgy';
	if (title.includes('multibuy')) return 'multibuy';
	if (title.includes('point')) return 'points';
	if (title.includes('happy')) return 'happy';
	if (title.includes('combo')) return 'combo';

	const slabs = frm.doc.price_discount_slabs || frm.doc.product_discount_slabs || [];
	for (let s of slabs) {
		const desc = (s.rule_description || '').toLowerCase();
		if (desc.includes('combo')) return 'combo';
		if (desc.includes('bogo')) return 'bogo';
		if (desc.includes('bxgy')) return 'bxgy';
		if (desc.includes('multibuy')) return 'multibuy';
		if (desc.includes('point')) return 'points';
		if (desc.includes('happy')) return 'happy';
		if (desc.includes('pct') || desc.includes('discount percentage')) return 'pct';
		if (desc.includes('price')) return 'price';
	}

	return 'pct';
}

function show_promotion_report_modal(frm) {
	frappe.call({
		method: 'woolmatt_promotions.woolmatt_promotions.api.get_promotion_report',
		args: { promo_id: frm.doc.name },
		callback: function(r) {
			const reportData = r.message || {
				sold: 0, disc: 0, rebate: 0, self: 0, uplift: 0,
				rows: []
			};

			const d = new frappe.ui.Dialog({
				title: `Promotion Performance Report — ${frm.doc.name}`,
				size: 'large',
				fields: [
					{ fieldtype: 'HTML', fieldname: 'report_html' }
				]
			});

			const upliftHtml = (reportData.sold > 0 && reportData.uplift > 0)
				? `<span style="color:#2E7D32;"><b>+${reportData.uplift}%</b> uplift vs baseline</span>`
				: `<span style="color:#6C7C71;"><b>0%</b> uplift (No sales recorded)</span>`;

			let html = `
				<div style="padding:10px;">
					<!-- KPI CARDS -->
					<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px;">
						<div style="background:#fff; border:1px solid #dfe5dc; border-radius:10px; padding:12px 14px;">
							<div style="font-size:11px; font-weight:700; color:#6C7C71; text-transform:uppercase;">Units Sold</div>
							<div style="font-size:22px; font-weight:800; margin-top:4px;">${reportData.sold.toLocaleString()}</div>
							<div style="font-size:11px; margin-top:2px;">${upliftHtml}</div>
						</div>
						<div style="background:#0E1A12; color:#fff; border-radius:10px; padding:12px 14px;">
							<div style="font-size:11px; font-weight:700; color:#5C7A66; text-transform:uppercase;">Total Discount</div>
							<div style="font-size:22px; font-weight:800; color:#37E27A; margin-top:4px;">KES ${Math.round(reportData.disc).toLocaleString()}</div>
							<div style="font-size:11px; color:#8AA394; margin-top:2px;">Given to shoppers</div>
						</div>
						<div style="background:linear-gradient(135deg,#F2A900,#D9930A); color:#3A2E00; border-radius:10px; padding:12px 14px;">
							<div style="font-size:11px; font-weight:700; color:#6B5200; text-transform:uppercase;">Supplier Rebate Due</div>
							<div style="font-size:22px; font-weight:800; margin-top:4px;">KES ${Math.round(reportData.rebate).toLocaleString()}</div>
							<div style="font-size:11px; color:#6B5200; margin-top:2px;">Recoverable from supplier</div>
						</div>
						<div style="background:#fff; border:1px solid #dfe5dc; border-radius:10px; padding:12px 14px;">
							<div style="font-size:11px; font-weight:700; color:#6C7C71; text-transform:uppercase;">Self-Funded Cost</div>
							<div style="font-size:22px; font-weight:800; color:#8A5CD1; margin-top:4px;">KES ${Math.round(reportData.self).toLocaleString()}</div>
							<div style="font-size:11px; color:#6C7C71; margin-top:2px;">Woolmatt margin investment</div>
						</div>
					</div>

					<!-- PERFORMANCE TABLE -->
					<div style="background:#fff; border:1px solid #dfe5dc; border-radius:10px; padding:12px; margin-top:14px;">
						<h5 style="margin-bottom:10px; font-weight:800; color:#1F4D2E;">Performance Breakdown by Product</h5>
						<table class="table table-bordered table-condensed" style="font-size:12px; margin-bottom:0;">
							<thead>
								<tr style="background:#FAFBF9;">
									<th>Product</th>
									<th style="text-align:right;">Units Sold</th>
									<th style="text-align:right;">Disc / Unit</th>
									<th style="text-align:right;">Total Discount</th>
									<th style="text-align:right;">Supplier Rebate</th>
									<th style="text-align:right;">Self-Funded</th>
								</tr>
							</thead>
							<tbody>
								${reportData.rows.map(r => `
									<tr>
										<td><b>${r.name}</b></td>
										<td style="text-align:right;">${r.units.toLocaleString()}</td>
										<td style="text-align:right;">KES ${r.dpu}</td>
										<td style="text-align:right; font-weight:700; color:#e8730c;">KES ${r.totalDisc.toLocaleString()}</td>
										<td style="text-align:right; color:#e8730c;">KES ${r.rebate.toLocaleString()}</td>
										<td style="text-align:right; color:#8a5cd1;">KES ${r.self.toLocaleString()}</td>
									</tr>
								`).join('')}
							</tbody>
						</table>
					</div>
				</div>
			`;

			d.fields_dict.report_html.$wrapper.html(html);
			d.show();
		}
	});
}

function show_associated_pricing_rules_dialog(frm) {
	if (frm.is_new()) {
		frappe.msgprint(__('Please save the Promotional Scheme first to view associated Pricing Rules.'));
		return;
	}

	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Pricing Rule',
			filters: [
				['promotional_scheme', '=', frm.doc.name]
			],
			fields: ['name', 'title', 'price_or_product_discount', 'discount_percentage', 'discount_amount', 'disable']
		},
		callback: function(r) {
			const rules = r.message || [];
			const d = new frappe.ui.Dialog({
				title: `Associated Pricing Rules for ${frm.doc.name}`,
				size: 'large',
				fields: [
					{ fieldtype: 'HTML', fieldname: 'rules_html' }
				]
			});

			let html = `
				<div style="padding:10px;">
					<div style="margin-bottom:12px; font-weight:700; font-size:13px;">
						Total Generated Pricing Rules: <span class="badge label-primary">${rules.length}</span>
					</div>
			`;

			if (!rules.length) {
				html += `
					<div class="alert alert-warning" style="font-size:12.5px;">
						No Pricing Rules currently linked to <b>${frm.doc.name}</b>. In ERPNext standard workflow, Pricing Rules are created when the Promotional Scheme is submitted or processed.
					</div>
				`;
			} else {
				html += `
					<table class="table table-bordered table-condensed" style="font-size:12px;">
						<thead>
							<tr style="background:#fafbf9;">
								<th>Pricing Rule ID</th>
								<th>Title / Description</th>
								<th>Discount Type</th>
								<th>Status</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							${rules.map(rule => `
								<tr>
									<td><b>${rule.name}</b></td>
									<td>${rule.title || rule.name}</td>
									<td>${rule.price_or_product_discount || 'Price'}</td>
									<td>${rule.disable ? '<span class="label label-danger">Disabled</span>' : '<span class="label label-success">Active</span>'}</td>
									<td><a href="/desk/pricing-rule/${rule.name}" target="_blank" class="btn btn-default btn-xs">Open Rule</a></td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				`;
			}

			html += `</div>`;
			d.fields_dict.rules_html.$wrapper.html(html);
			d.show();
		}
	});
}

function show_extend_campaign_dialog(frm) {
	const d = new frappe.ui.Dialog({
		title: 'Extend Promotion Campaign',
		fields: [
			{
				label: 'New Valid Up To Date',
				fieldname: 'valid_upto',
				fieldtype: 'Date',
				default: frappe.datetime.add_days(frm.doc.valid_upto || frappe.datetime.get_today(), 7),
				reqd: 1
			}
		],
		primary_action_label: 'Extend Campaign',
		primary_action(values) {
			frm.set_value('valid_upto', values.valid_upto);
			frm.set_value('disable', 0);
			frm.save().then(() => {
				frappe.show_alert({ message: `Campaign extended to ${values.valid_upto}`, indicator: 'green' });
				d.hide();
			});
		}
	});
	d.show();
}

function sync_scope_and_render(frm) {
	// 1. If __wm_items already has items in memory, do NOT overwrite them!
	if (frm.doc.__wm_items && frm.doc.__wm_items.length > 0) {
		sync_items_to_form_slabs(frm);
		render_woolmatt_promo_grid(frm);
		return;
	}

	// 2. Try loading full state from custom_item_discounts_json if present
	if (frm.doc.custom_item_discounts_json) {
		try {
			const parsed = typeof frm.doc.custom_item_discounts_json === 'string'
				? JSON.parse(frm.doc.custom_item_discounts_json)
				: frm.doc.custom_item_discounts_json;
			if (parsed && parsed.items && parsed.items.length) {
				frm.doc.__wm_items = parsed.items;
				if (parsed.offer_type) frm.doc.__wm_offer_type = parsed.offer_type;
				sync_items_to_form_slabs(frm);
				render_woolmatt_promo_grid(frm);
				return;
			}
		} catch(e) {}
	}

	// 3. Read existing slabs from form document if present
	const slabs = frm.doc.price_discount_slabs || frm.doc.product_discount_slabs || [];
	const linkedItems = (frm.doc.items || []).map(i => i.item_code).filter(Boolean);

	if (slabs.length) {
		frm.doc.__wm_items = slabs.map((s, idx) => {
			const itemCode = linkedItems[idx] || linkedItems[0] || s.item_code || '';
			let prodName = s.item_name || itemCode;
			if ((!prodName || prodName === 'undefined') && s.rule_description) {
				prodName = s.rule_description.split(' - ')[0] || itemCode;
			}
			return {
				id: itemCode,
				code: itemCode,
				name: prodName || itemCode || 'Item',
				price: s.rate || 60.0,
				fund: s.custom_funding_type || 'supplier',
				wVal: s.custom_woolmatt_pct || 0,
				sVal: s.discount_percentage || s.discount_amount || 15,
				buyQty: s.min_qty || 1,
				freeQty: s.free_qty || 1,
				comboDisc: s.discount_percentage || 20,
				role: (s.rule_description && s.rule_description.includes('COMBO MAIN')) ? 'main' : (idx === 0 ? 'main' : 'addon')
			};
		});
		sync_items_to_form_slabs(frm);
		render_woolmatt_promo_grid(frm);
		return;
	}

	const applyOn = (frm.doc.apply_on || 'Item Code').toLowerCase();
	let scopeBy = '', scopeVal = '';

	if (applyOn === 'item code' || applyOn === 'item_code') {
		scopeBy = 'item_code';
		if (frm.doc.items && frm.doc.items.length) {
			const codes = frm.doc.items.map(r => r.item_code).filter(Boolean);
			if (codes.length) {
				scopeVal = JSON.stringify(codes);
			}
		}
	} else if (applyOn === 'item group' || applyOn === 'item_group') {
		scopeBy = 'item_group';
		if (frm.doc.item_groups && frm.doc.item_groups.length) {
			scopeVal = frm.doc.item_groups[0].item_group;
		}
	} else if (applyOn === 'brand') {
		scopeBy = 'brand';
		if (frm.doc.brands && frm.doc.brands.length) {
			scopeVal = frm.doc.brands[0].brand;
		}
	} else if (applyOn === 'supplier') {
		scopeBy = 'supplier';
		if (frm.doc.suppliers && frm.doc.suppliers.length) {
			scopeVal = frm.doc.suppliers[0].supplier;
		}
	}

	if (scopeVal) {
		frappe.call({
			method: 'woolmatt_promotions.woolmatt_promotions.api.search_products',
			args: { scope_by: scopeBy, scope_val: scopeVal },
			callback: function(r) {
				if (r.message && r.message.length) {
					frm.doc.__wm_items = r.message.map((p, idx) => ({
						id: p.id,
						code: p.id,
						name: p.name,
						price: p.price || 0,
						fund: 'supplier',
						wVal: 0,
						sVal: 15,
						buyQty: 1,
						freeQty: 1,
						bonusPts: 50,
						rewardDisc: 100,
						comboDisc: 20,
						role: idx === 0 ? 'main' : 'addon'
					}));
				} else {
					if (!frm.doc.__wm_items) frm.doc.__wm_items = [];
				}
				sync_items_to_form_slabs(frm);
				render_woolmatt_promo_grid(frm);
			}
		});
	} else {
		render_woolmatt_promo_grid(frm);
	}
}

function render_woolmatt_promo_grid(frm) {
	// Clean up duplicate old elements, buttons, and legacy inventory_patch containers
	$('.wm-enhanced-builder-btn').remove();
	$('button:contains("Enhanced Promotion Builder")').remove();
	$('.wm-item-discounts-wrapper').remove();
	$('#wm-items-table').remove();

	if ($('#woolmatt-scheme-table-container').length) {
		$('#woolmatt-scheme-table-container').remove();
	}

	// Completely hide standard slab fields and legacy custom field wrappers from DOM
	if (frm.fields_dict.price_discount_slabs) {
		$(frm.fields_dict.price_discount_slabs.wrapper).hide();
	}
	if (frm.fields_dict.product_discount_slabs) {
		$(frm.fields_dict.product_discount_slabs.wrapper).hide();
	}
	if (frm.fields_dict.custom_promotional_items_list) {
		$(frm.fields_dict.custom_promotional_items_list.wrapper).hide().empty();
	}

	const currentType = detect_offer_type(frm);
	frm.doc.__wm_offer_type = currentType;
	const items = frm.doc.__wm_items || [];

	const container = $(`
		<div id="woolmatt-scheme-table-container" style="margin-top:15px; margin-bottom:25px;">
			
			<!-- SECTION 0: Campaign Dashboard Actions Bar -->
			<div style="background:#1F4D2E; color:#fff; border-radius:10px; padding:10px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
				<div style="font-weight:800; font-size:13.5px; display:flex; align-items:center; gap:8px;">
					<span>Promotion Campaign Tools</span>
					<span class="badge" style="background:rgba(255,255,255,0.2); color:#fff; font-size:11px;">ID: ${frm.doc.name || 'New'}</span>
				</div>
				<div style="display:flex; gap:8px; flex-wrap:wrap;">
					<button class="btn btn-default btn-xs" id="wm-btn-hdr-report" style="font-weight:700; background:#fff; color:#1F4D2E; border:none; padding:5px 12px;">Performance Report</button>
					<button class="btn btn-default btn-xs" id="wm-btn-hdr-rules" style="font-weight:700; background:#F2A900; color:#143823; border:none; padding:5px 12px;">Associated Pricing Rules</button>
					<button class="btn btn-default btn-xs" id="wm-btn-hdr-extend" style="font-weight:700; background:rgba(255,255,255,0.25); color:#fff; border:none; padding:5px 12px;">Extend Campaign</button>
				</div>
			</div>

			<!-- SECTION 1: Offer Mechanic & Headline Config Bar -->
			<div style="background:#fafbf9; border:1px solid #dfe5dc; border-radius:10px; padding:14px 16px; margin-bottom:14px;">
				<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
					<div style="display:flex; align-items:center; gap:10px;">
						<span style="font-size:13px; font-weight:800; color:#1F4D2E;">Offer Type Mechanic:</span>
						<select id="wm-mechanic-select" class="form-control input-sm" style="width:230px; font-weight:800; display:inline-block; height:34px; border-color:#2E6B44;">
							<option value="pct" ${currentType === 'pct' ? 'selected' : ''}>% Discount</option>
							<option value="price" ${currentType === 'price' ? 'selected' : ''}>Price Discount (KES)</option>
							<option value="bogo" ${currentType === 'bogo' ? 'selected' : ''}>BOGO (Buy X Get X Free)</option>
							<option value="bxgy" ${currentType === 'bxgy' ? 'selected' : ''}>Buy X Get Y (Free Item)</option>
							<option value="multibuy" ${currentType === 'multibuy' ? 'selected' : ''}>Buy X for Price (Multibuy)</option>
							<option value="points" ${currentType === 'points' ? 'selected' : ''}>Extra Loyalty Points</option>
							<option value="happy" ${currentType === 'happy' ? 'selected' : ''}>Happy Hour (% Window)</option>
							<option value="combo" ${currentType === 'combo' ? 'selected' : ''}>Combo Offer (Main + Add-ons)</option>
						</select>
					</div>

					<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
						<div class="wm-bogo-presets" style="display:${currentType === 'bogo' ? 'inline-flex' : 'none'}; gap:4px;">
							<button class="btn btn-default btn-xs" id="wm-btn-bogo1">Buy 1 Get 1 Free</button>
							<button class="btn btn-default btn-xs" id="wm-btn-bogo2">Buy 2 Get 1 Free</button>
						</div>

						<div class="bulkapply" style="display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid #dfe5dc; border-radius:7px; padding:3px 8px;">
							<span style="font-size:11.5px; color:#6c7c71; font-weight:700;">Bulk Apply:</span>
							<input id="wm-bulk-val" type="number" placeholder="Value" style="width:65px; height:28px; text-align:center; border:1px solid #dfe5dc; border-radius:5px;">
							<select id="wm-bulk-fund" style="height:28px; border:1px solid #dfe5dc; border-radius:5px; font-size:12px;">
								<option value="supplier">Supplier Funded</option>
								<option value="self">Self Funded</option>
								<option value="both">Co-Funded</option>
							</select>
							<button class="btn btn-default btn-xs" id="wm-btn-apply-bulk" style="height:28px;">Apply to All</button>
						</div>

						<span class="badge label-info" style="padding:6px 10px; font-size:12px;">${items.length} Active Item(s)</span>
					</div>
				</div>

				<!-- Headline Dynamic Config Controls -->
				<div id="wm-headline-config-box" style="border-top:1px dashed #dfe5dc; padding-top:10px; font-size:12.5px;"></div>
			</div>

			<!-- SECTION 2: Search & Add Products Bar -->
			<div style="background:#fff; border:1px solid #dfe5dc; border-radius:10px; padding:12px 14px; margin-bottom:14px;">
				<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
					<div style="position:relative; flex:1; min-width:240px;">
						<input type="text" id="wm-prod-search-input" class="form-control input-sm" placeholder="Search product by name or code to add to combination..." autocomplete="off" style="height:36px; padding-left:12px;">
						<div id="wm-prod-search-results" style="position:absolute; left:0; right:0; top:40px; background:#fff; border:1px solid #dfe5dc; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); z-index:999; display:none; max-height:220px; overflow-y:auto;"></div>
					</div>
					<button class="btn btn-default btn-sm" id="wm-toggle-bulk-paste">+ Paste Bulk Items</button>
					<button class="btn btn-danger btn-xs pull-right" id="wm-btn-clear-all" style="height:32px;">Clear Table</button>
				</div>

				<div id="wm-bulk-paste-box" style="display:none; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
					<textarea id="wm-bulk-textarea" class="form-control" rows="3" placeholder="Paste item names or codes (one per line)..."></textarea>
					<div style="margin-top:6px; text-align:right;">
						<button class="btn btn-primary btn-xs" id="wm-btn-process-bulk">Add Pasted Items</button>
					</div>
				</div>
			</div>

			<!-- SECTION 3: Dynamic Table -->
			<div style="overflow-x:auto; border:1px solid #dfe5dc; border-radius:10px;">
				<table class="table table-bordered table-condensed ptbl" id="wm-scheme-grid" style="width:100%; font-size:12.5px; margin-bottom:0; background:#fff;">
					<thead id="wm-grid-thead"></thead>
					<tbody id="wm-grid-tbody"></tbody>
					<tfoot id="wm-grid-tfoot"></tfoot>
				</table>
			</div>
		</div>
	`);

	// Insert container into form page
	if (frm.fields_dict.price_discount_slabs) {
		$(frm.fields_dict.price_discount_slabs.wrapper).before(container);
	} else if (frm.fields_dict.product_discount_slabs) {
		$(frm.fields_dict.product_discount_slabs.wrapper).before(container);
	} else {
		$(frm.wrapper).find('.form-page').first().append(container);
	}

	render_headline_config(frm);

	// Action Header Buttons
	container.find('#wm-btn-hdr-report').on('click', function(e) {
		e.preventDefault();
		show_promotion_report_modal(frm);
	});
	container.find('#wm-btn-hdr-rules').on('click', function(e) {
		e.preventDefault();
		show_associated_pricing_rules_dialog(frm);
	});
	container.find('#wm-btn-hdr-extend').on('click', function(e) {
		e.preventDefault();
		show_extend_campaign_dialog(frm);
	});

	// Event Listeners
	container.find('#wm-mechanic-select').on('change', function() {
		const newType = $(this).val();
		frm.doc.__wm_offer_type = newType;
		sync_items_to_form_slabs(frm);
		render_woolmatt_promo_grid(frm);
	});

	container.find('#wm-btn-bogo1').on('click', function(e) { e.preventDefault(); apply_bogo_preset_form(frm, 1, 1); });
	container.find('#wm-btn-bogo2').on('click', function(e) { e.preventDefault(); apply_bogo_preset_form(frm, 2, 1); });
	container.find('#wm-btn-apply-bulk').on('click', function(e) { e.preventDefault(); apply_bulk_form(frm); });
	container.find('#wm-btn-clear-all').on('click', function(e) { e.preventDefault(); frm.doc.__wm_items = []; sync_items_to_form_slabs(frm); render_form_table(frm); });

	// Live Product Search
	const searchInput = container.find('#wm-prod-search-input');
	const searchResults = container.find('#wm-prod-search-results');

	searchInput.on('keyup input', function() {
		const term = $(this).val().trim();
		if (term.length < 2) {
			searchResults.hide().empty();
			return;
		}
		frappe.call({
			method: 'woolmatt_promotions.woolmatt_promotions.api.search_products',
			args: { term: term },
			callback: function(r) {
				searchResults.empty();
				if (r.message && r.message.length) {
					r.message.forEach(item => {
						searchResults.append(`
							<div class="wm-search-row" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
								<div>
									<b>${item.name}</b> <small class="text-muted">(${item.id})</small>
								</div>
								<span class="badge label-success">Sh ${item.price}</span>
							</div>
						`);
					});
					searchResults.show();
				} else {
					searchResults.append('<div style="padding:10px;" class="text-muted">No products found</div>').show();
				}
			}
		});
	});

	searchResults.on('click', '.wm-search-row', function() {
		const id = $(this).data('id');
		const name = $(this).data('name');
		const price = parseFloat($(this).data('price')) || 0;

		add_single_item_to_grid(frm, id, name, price);
		searchInput.val('');
		searchResults.hide().empty();
	});

	// Bulk paste toggle
	container.find('#wm-toggle-bulk-paste').on('click', function(e) {
		e.preventDefault();
		container.find('#wm-bulk-paste-box').toggle();
	});

	container.find('#wm-btn-process-bulk').on('click', function(e) {
		e.preventDefault();
		const raw = container.find('#wm-bulk-textarea').val();
		if (raw) {
			const lines = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
			lines.forEach(term => {
				frappe.call({
					method: 'woolmatt_promotions.woolmatt_promotions.api.search_products',
					args: { term: term },
					callback: function(r) {
						if (r.message && r.message.length) {
							const p = r.message[0];
							add_single_item_to_grid(frm, p.id, p.name, p.price);
						}
					}
				});
			});
			container.find('#wm-bulk-textarea').val('');
			container.find('#wm-bulk-paste-box').hide();
		}
	});

	render_form_table(frm);
}

function render_headline_config(frm) {
	const box = $('#wm-headline-config-box');
	if (!box.length) return;
	box.empty();

	const t = frm.doc.__wm_offer_type || 'pct';

	if (t === 'pct') {
		box.html(`
			<div style="display:flex; gap:16px; align-items:center;">
				<div><b>Headline Discount %:</b> <input type="number" id="wm-hl-val" class="form-control input-xs" value="20" style="width:70px; display:inline-block; text-align:center;"> %</div>
				<span class="text-muted">(Applies to all products — fine-tune per row below)</span>
			</div>
		`);
	} else if (t === 'price') {
		box.html(`
			<div style="display:flex; gap:16px; align-items:center;">
				<div><b>Headline Amount Off:</b> <input type="number" id="wm-hl-val" class="form-control input-xs" value="50" style="width:80px; display:inline-block; text-align:center;"> KES</div>
				<span class="text-muted">(Applies to all products — fine-tune per row below)</span>
			</div>
		`);
	} else if (t === 'bogo') {
		box.html(`
			<div style="display:flex; gap:16px; align-items:center;">
				<div><b>Buy Qty:</b> <input type="number" id="wm-hl-bq" class="form-control input-xs" value="1" style="width:60px; display:inline-block; text-align:center;"></div>
				<div><b>Get Free Qty:</b> <input type="number" id="wm-hl-fq" class="form-control input-xs" value="1" style="width:60px; display:inline-block; text-align:center;"></div>
				<span class="text-muted">(Buy 1 Get 1 Free default)</span>
			</div>
		`);
	} else if (t === 'combo') {
		box.html(`
			<div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
				<div><b>Add-on Discount %:</b> <input type="number" id="wm-hl-val" class="form-control input-xs" value="20" style="width:70px; display:inline-block; text-align:center;"> %</div>
				<div><b>Main Qty Required:</b> <input type="number" id="wm-hl-bq" class="form-control input-xs" value="1" style="width:60px; display:inline-block; text-align:center;"></div>
				<div class="alert alert-warning" style="margin:0; padding:4px 10px; font-size:11.5px;">
					<b>Combo Rules:</b> Mark <b>Main</b> item(s) (sold at full price). Every <b>Add-on</b> item gets its discounted combo price!
				</div>
			</div>
		`);
	} else if (t === 'happy') {
		const slots = frm.doc.__wm_hh_slots || [{ from: '13:00', to: '14:00' }];
		let slotsHTML = slots.map((s, i) => `
			<span style="display:inline-flex; align-items:center; gap:4px; background:#fff; border:1px solid #ccc; padding:2px 6px; border-radius:5px;">
				<input type="time" class="wm-hh-from" data-idx="${i}" value="${s.from}"> to 
				<input type="time" class="wm-hh-to" data-idx="${i}" value="${s.to}">
				<button class="btn btn-default btn-xs text-danger wm-del-hh" data-idx="${i}">×</button>
			</span>
		`).join(' ');

		box.html(`
			<div>
				<b>Active Time Windows:</b> ${slotsHTML}
				<button class="btn btn-default btn-xs" id="wm-add-hh-slot" style="margin-left:6px;">+ Add Slot</button>
			</div>
		`);

		box.find('#wm-add-hh-slot').on('click', function(e) {
			e.preventDefault();
			frm.doc.__wm_hh_slots.push({ from: '16:00', to: '19:00' });
			render_headline_config(frm);
		});
		box.find('.wm-del-hh').on('click', function(e) {
			e.preventDefault();
			const idx = $(this).data('idx');
			frm.doc.__wm_hh_slots.splice(idx, 1);
			render_headline_config(frm);
		});
	}

	const periodOpt = `
		<div style="margin-top:8px; border-top:1px dashed #eee; padding-top:6px; display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
			<div><b>Valid From Date:</b> <input type="date" id="wm-valid-from" class="form-control input-xs" value="${frm.doc.valid_from ? frm.doc.valid_from.split(' ')[0] : ''}" style="width:135px; display:inline-block; margin-left:4px;"></div>
			<div><b>Valid Up To Date:</b> <input type="date" id="wm-valid-upto" class="form-control input-xs" value="${frm.doc.valid_upto ? frm.doc.valid_upto.split(' ')[0] : ''}" style="width:135px; display:inline-block; margin-left:4px;"></div>
			<label style="font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; margin:0;">
				<input type="checkbox" id="wm-chk-cumulative" ${frm.doc.is_cumulative ? 'checked' : ''}>
				<span>Cumulative Offer (Combine Quantities)</span>
			</label>
			<label style="font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; margin:0;">
				<input type="checkbox" id="wm-chk-mixed" ${frm.doc.mixed_conditions ? 'checked' : ''}>
				<span>Mixed Conditions</span>
			</label>
		</div>
	`;
	box.append(periodOpt);

	box.find('#wm-valid-from').on('change', function() {
		frm.set_value('valid_from', $(this).val());
	});
	box.find('#wm-valid-upto').on('change', function() {
		frm.set_value('valid_upto', $(this).val());
	});
	box.find('#wm-chk-cumulative').on('change', function() {
		frm.set_value('is_cumulative', $(this).is(':checked') ? 1 : 0);
	});
	box.find('#wm-chk-mixed').on('change', function() {
		frm.set_value('mixed_conditions', $(this).is(':checked') ? 1 : 0);
	});

	box.find('input[type="number"], input[type="text"]').on('change input', function() {
		apply_headline_to_all_rows(frm);
	});
}

function apply_headline_to_all_rows(frm) {
	const t = frm.doc.__wm_offer_type || 'pct';
	const items = frm.doc.__wm_items || [];
	const val = parseFloat($('#wm-hl-val').val()) || 0;
	const bq = parseFloat($('#wm-hl-bq').val()) || 1;
	const fq = parseFloat($('#wm-hl-fq').val()) || 1;

	items.forEach(p => {
		if (t === 'pct' || t === 'happy') {
			if (p.fund === 'self') {
				p.wVal = val;
				p.sVal = 0;
			} else if (p.fund === 'both') {
				p.wVal = Math.round(val / 2);
				p.sVal = val - p.wVal;
			} else {
				p.sVal = val;
				p.wVal = 0;
			}
		} else if (t === 'price') {
			if (p.fund === 'self') {
				p.wVal = val;
				p.sVal = 0;
			} else if (p.fund === 'both') {
				p.wVal = Math.round(val / 2);
				p.sVal = val - p.wVal;
			} else {
				p.sVal = val;
				p.wVal = 0;
			}
		} else if (t === 'bogo') {
			p.buyQty = bq; p.freeQty = fq;
		} else if (t === 'combo') {
			if (p.role !== 'main') p.comboDisc = val;
		}
	});

	sync_items_to_form_slabs(frm);
	render_form_table(frm);
}

function add_single_item_to_grid(frm, id, name, price) {
	if (!frm.doc.__wm_items) frm.doc.__wm_items = [];
	const exists = frm.doc.__wm_items.find(x => x.id === id);
	if (exists) {
		frappe.show_alert({ message: `Item ${name} already in table`, indicator: 'orange' });
		return;
	}

	const isFirst = frm.doc.__wm_items.length === 0;
	frm.doc.__wm_items.push({
		id: id,
		code: id,
		name: name,
		price: price || 0,
		fund: 'supplier',
		wVal: 0,
		sVal: 15,
		buyQty: 1,
		freeQty: 1,
		bonusPts: 50,
		rewardDisc: 100,
		comboDisc: 20,
		role: isFirst ? 'main' : 'addon'
	});

	sync_items_to_form_slabs(frm);
	render_form_table(frm);
	frappe.show_alert({ message: `Added ${name} to table`, indicator: 'green' });
}

function render_form_table(frm) {
	const currentType = frm.doc.__wm_offer_type || 'pct';
	const items = frm.doc.__wm_items || [];
	const thead = $('#wm-grid-thead');
	const tbody = $('#wm-grid-tbody');
	const tfoot = $('#wm-grid-tfoot');
	thead.empty();
	tbody.empty();
	tfoot.empty();

	// Render Table Headers according to mechanic
	let ths = '<tr><th style="min-width:90px;">CODE</th><th style="min-width:160px;">PRODUCT</th><th style="text-align:right;">RATE</th>';
	if (currentType === 'pct' || currentType === 'happy') {
		ths += '<th style="text-align:right;">WOOLMATT %</th><th style="text-align:right;">SUPPLIER %</th><th>FUNDING</th><th style="text-align:right;">TOTAL DISC</th><th style="text-align:right;">NEW PRICE</th>';
	} else if (currentType === 'price') {
		ths += '<th style="text-align:right;">WOOLMATT (KES)</th><th style="text-align:right;">SUPPLIER (KES)</th><th>FUNDING</th><th style="text-align:right;">TOTAL DISC</th><th style="text-align:right;">NEW PRICE</th>';
	} else if (currentType === 'bogo') {
		ths += '<th style="text-align:right;">BUY QTY</th><th style="text-align:right;">FREE QTY</th><th style="text-align:right;">EFFECTIVE DISC</th><th style="text-align:right;">FREE ITEM VALUE</th><th>FUNDING</th><th style="text-align:right;">SUPPLIER AMT</th><th style="text-align:right;">SELF AMT</th>';
	} else if (currentType === 'bxgy') {
		ths += '<th style="text-align:right;">BUY QTY</th><th>FREE ITEM</th><th style="text-align:right;">FREE QTY</th><th style="text-align:right;">REWARD DISC %</th><th>FUNDING</th>';
	} else if (currentType === 'multibuy') {
		ths += '<th style="text-align:right;">BUY QTY</th><th style="text-align:right;">FOR TOTAL PRICE</th><th style="text-align:right;">YOU SAVE</th><th>FUNDING</th>';
	} else if (currentType === 'points') {
		ths += '<th style="text-align:right;">BONUS PTS / UNIT</th><th>FUNDING</th>';
	} else if (currentType === 'combo') {
		ths += '<th>ROLE</th><th style="text-align:right;">QTY</th><th style="text-align:right;">COMBO DISC %</th><th style="text-align:right;">YOU SAVE</th><th style="text-align:right;">OFFER PRICE</th><th>FUNDING</th>';
	}
	ths += '<th></th></tr>';
	thead.append(ths);

	if (!items.length) {
		tbody.append('<tr><td colspan="12" class="text-center text-muted" style="padding:24px;">No items in offer. Select Item Code, Item Group, Brand, or Supplier above to populate automatically.</td></tr>');
		return;
	}

	let totalReg = 0, totalDisc = 0, totalOffer = 0, totalSup = 0, totalSelf = 0, totalWVal = 0, totalSVal = 0;

	items.forEach((p, idx) => {
		const rate = p.price || 0;
		totalReg += rate;
		const wVal = p.wVal || 0;
		const sVal = p.sVal || 0;
		totalWVal += wVal;
		totalSVal += sVal;

		let tr = `<tr><td><b>${p.code || p.id}</b></td><td><b>${p.name}</b></td><td style="text-align:right; font-weight:700;">Sh ${rate.toFixed(2)}</td>`;

		const fund = p.fund || 'supplier';
		const fundSel = `
			<select class="wm-row-fund form-control input-xs" data-idx="${idx}" style="height:30px; font-size:12px; width:110px;">
				<option value="supplier" ${fund === 'supplier' ? 'selected' : ''}>Supplier Funded</option>
				<option value="self" ${fund === 'self' ? 'selected' : ''}>Self Funded</option>
				<option value="both" ${fund === 'both' ? 'selected' : ''}>Co-Funded</option>
			</select>
		`;

		if (currentType === 'pct' || currentType === 'happy') {
			const discVal = Math.min(rate, rate * (wVal + sVal) / 100);
			const offerPrice = Math.max(0, rate - discVal);
			totalDisc += discVal; totalOffer += offerPrice;

			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-wval" data-idx="${idx}" value="${wVal}" style="width:65px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-sval" data-idx="${idx}" value="${sVal}" style="width:65px; display:inline-block;"></td>
				<td>${fundSel}</td>
				<td style="text-align:right; font-weight:800; color:#e8730c;">Sh ${discVal.toFixed(2)}</td>
				<td style="text-align:right; font-weight:800; color:#2e7d32;">Sh ${offerPrice.toFixed(2)}</td>
			`;
		} else if (currentType === 'price') {
			const discVal = Math.min(rate, wVal + sVal);
			const offerPrice = Math.max(0, rate - discVal);
			totalDisc += discVal; totalOffer += offerPrice;

			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-wval" data-idx="${idx}" value="${wVal}" style="width:65px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-sval" data-idx="${idx}" value="${sVal}" style="width:65px; display:inline-block;"></td>
				<td>${fundSel}</td>
				<td style="text-align:right; font-weight:800; color:#e8730c;">Sh ${discVal.toFixed(2)}</td>
				<td style="text-align:right; font-weight:800; color:#2e7d32;">Sh ${offerPrice.toFixed(2)}</td>
			`;
		} else if (currentType === 'bogo') {
			const bq = Math.max(1, p.buyQty || 1);
			const fq = Math.max(1, p.freeQty || 1);
			const eff = Math.round((fq / (bq + fq)) * 100);
			const freeVal = fq * rate;
			const isSup = fund === 'supplier';
			const isSelf = fund === 'self';
			const supAmt = isSup ? freeVal : (fund === 'both' ? freeVal * 0.5 : 0);
			const selfAmt = isSelf ? freeVal : (fund === 'both' ? freeVal * 0.5 : 0);
			totalDisc += freeVal; totalSup += supAmt; totalSelf += selfAmt;

			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-bq" data-idx="${idx}" value="${bq}" style="width:55px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-fq" data-idx="${idx}" value="${fq}" style="width:55px; display:inline-block;"></td>
				<td style="text-align:right; font-weight:800; color:#e8730c;">${eff}%</td>
				<td style="text-align:right; font-weight:800; color:#2e7d32;">Sh ${freeVal.toFixed(2)}</td>
				<td>${fundSel}</td>
				<td style="text-align:right; color:#e8730c;">Sh ${supAmt.toFixed(2)}</td>
				<td style="text-align:right; color:#8a5cd1;">Sh ${selfAmt.toFixed(2)}</td>
			`;
		} else if (currentType === 'bxgy') {
			const bq = p.buyQty || 1;
			const fq = p.freeQty || 1;
			const freeItem = p.freeItemName || p.name + ' (Same Item)';
			const rd = p.rewardDisc || 100;

			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-bq" data-idx="${idx}" value="${bq}" style="width:55px; display:inline-block;"></td>
				<td><input type="text" class="form-control input-xs wm-row-free-item" data-idx="${idx}" value="${freeItem}" style="width:140px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-fq" data-idx="${idx}" value="${fq}" style="width:55px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-rd" data-idx="${idx}" value="${rd}" style="width:60px; display:inline-block;"></td>
				<td>${fundSel}</td>
			`;
		} else if (currentType === 'multibuy') {
			const bq = p.buyQty || 3;
			const fp = p.forPrice || (rate * bq * 0.85);
			const save = Math.max(0, (rate * bq) - fp);
			totalDisc += save;

			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-bq" data-idx="${idx}" value="${bq}" style="width:55px; display:inline-block;"></td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-fp" data-idx="${idx}" value="${fp.toFixed(0)}" style="width:75px; display:inline-block;"></td>
				<td style="text-align:right; font-weight:800; color:#e8730c;">Sh ${save.toFixed(2)}</td>
				<td>${fundSel}</td>
			`;
		} else if (currentType === 'points') {
			const pts = p.bonusPts || 50;
			tr += `
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-pts" data-idx="${idx}" value="${pts}" style="width:70px; display:inline-block;"></td>
				<td>${fundSel}</td>
			`;
		} else if (currentType === 'combo') {
			const isMain = p.role === 'main';
			const qty = p.qty || 1;
			const comboDisc = isMain ? 0 : (p.comboDisc || 20);
			const save = isMain ? 0 : (rate * comboDisc / 100);
			const offer = isMain ? rate : Math.max(0, rate - save);
			totalDisc += save; totalOffer += offer;

			tr += `
				<td>
					<select class="form-control input-xs wm-row-role" data-idx="${idx}" style="width:90px; font-weight:700; display:inline-block;">
						<option value="main" ${isMain ? 'selected' : ''}>Main</option>
						<option value="addon" ${!isMain ? 'selected' : ''}>Add-on</option>
					</select>
				</td>
				<td style="text-align:right;"><input type="number" class="form-control input-xs text-right wm-row-qty" data-idx="${idx}" value="${qty}" style="width:55px; display:inline-block;"></td>
				<td style="text-align:right;">${isMain ? '<span class="text-muted">—</span>' : `<input type="number" class="form-control input-xs text-right wm-row-cdisc" data-idx="${idx}" value="${comboDisc}" style="width:60px; display:inline-block;">`}</td>
				<td style="text-align:right; font-weight:800; color:#e8730c;">${isMain ? '<span class="text-muted">—</span>' : `Sh ${save.toFixed(2)}`}</td>
				<td style="text-align:right; font-weight:800; color:#2e7d32;">Sh ${offer.toFixed(2)}</td>
				<td>${fundSel}</td>
			`;
		}

		tr += `<td><button class="btn btn-default btn-xs text-danger wm-remove-row" data-idx="${idx}">×</button></td></tr>`;
		tbody.append(tr);
	});

	// Totals Footer
	let footTr = `<tr style="font-weight:800; border-top:2px solid #dfe5dc;"><td>Totals (${items.length} items)</td><td></td><td style="text-align:right;">Sh ${totalReg.toFixed(2)}</td>`;
	if (currentType === 'pct' || currentType === 'happy') {
		footTr += `<td style="text-align:right; color:#8a5cd1;">${totalWVal.toFixed(1)}%</td><td style="text-align:right; color:#e8730c;">${totalSVal.toFixed(1)}%</td><td></td><td style="text-align:right; color:#e8730c;">Sh ${totalDisc.toFixed(2)}</td><td style="text-align:right; color:#2e7d32;">Sh ${totalOffer.toFixed(2)}</td><td></td>`;
	} else if (currentType === 'price') {
		footTr += `<td style="text-align:right; color:#8a5cd1;">Sh ${totalWVal.toFixed(2)}</td><td style="text-align:right; color:#e8730c;">Sh ${totalSVal.toFixed(2)}</td><td></td><td style="text-align:right; color:#e8730c;">Sh ${totalDisc.toFixed(2)}</td><td style="text-align:right; color:#2e7d32;">Sh ${totalOffer.toFixed(2)}</td><td></td>`;
	} else if (currentType === 'bogo') {
		footTr += `<td></td><td></td><td></td><td style="text-align:right; color:#2e7d32;">Sh ${totalDisc.toFixed(2)}</td><td></td><td style="text-align:right; color:#e8730c;">Sh ${totalSup.toFixed(2)}</td><td style="text-align:right; color:#8a5cd1;">Sh ${totalSelf.toFixed(2)}</td><td></td>`;
	} else if (currentType === 'combo') {
		footTr += `<td></td><td></td><td></td><td style="text-align:right; color:#e8730c;">Sh ${totalDisc.toFixed(2)}</td><td style="text-align:right; color:#2e7d32;">Sh ${totalOffer.toFixed(2)}</td><td></td><td></td>`;
	} else {
		footTr += `<td colspan="8"></td>`;
	}
	footTr += '</tr>';
	tfoot.append(footTr);

	// Bind input events for live calculations & sync to form
	tbody.find('input, select').on('change', function() {
		const idx = $(this).data('idx');
		let p = items[idx];
		if (!p) return;

		p.fund = tbody.find(`.wm-row-fund[data-idx="${idx}"]`).val() || p.fund;
		if (tbody.find(`.wm-row-role[data-idx="${idx}"]`).length) {
			p.role = tbody.find(`.wm-row-role[data-idx="${idx}"]`).val();
		}

		if (currentType === 'bogo') {
			p.buyQty = parseFloat(tbody.find(`.wm-row-bq[data-idx="${idx}"]`).val()) || 1;
			p.freeQty = parseFloat(tbody.find(`.wm-row-fq[data-idx="${idx}"]`).val()) || 1;
		} else if (currentType === 'pct' || currentType === 'happy') {
			p.sVal = parseFloat(tbody.find(`.wm-row-sval[data-idx="${idx}"]`).val()) || 0;
			p.wVal = parseFloat(tbody.find(`.wm-row-wval[data-idx="${idx}"]`).val()) || 0;
		} else if (currentType === 'price') {
			p.sVal = parseFloat(tbody.find(`.wm-row-sval[data-idx="${idx}"]`).val()) || 0;
			p.wVal = parseFloat(tbody.find(`.wm-row-wval[data-idx="${idx}"]`).val()) || 0;
		} else if (currentType === 'combo') {
			if (p.role !== 'main') {
				p.comboDisc = parseFloat(tbody.find(`.wm-row-cdisc[data-idx="${idx}"]`).val()) || 0;
			}
		}

		sync_items_to_form_slabs(frm);
		render_form_table(frm);
	});

	tbody.find('.wm-remove-row').on('click', function(e) {
		e.preventDefault();
		const idx = $(this).data('idx');
		items.splice(idx, 1);
		sync_items_to_form_slabs(frm);
		render_form_table(frm);
	});
}

function sync_items_to_form_slabs(frm) {
	const currentType = detect_offer_type(frm);
	frm.doc.__wm_offer_type = currentType;
	const items = frm.doc.__wm_items || [];

	// Persist full state to custom_item_discounts_json field on form document
	frm.doc.custom_item_discounts_json = JSON.stringify({
		offer_type: currentType,
		items: items
	});
	frm.refresh_field('custom_item_discounts_json');

	if (currentType === 'bogo' || currentType === 'bxgy') {
		frm.doc.product_discount_slabs = items.map(p => ({
			item_code: p.id,
			item_name: p.name,
			min_qty: p.buyQty || 1,
			free_qty: p.freeQty || 1,
			same_item: (currentType === 'bogo') ? 1 : 0,
			rule_description: `${p.name} - ${currentType.toUpperCase()} Promo`,
			custom_funding_type: p.fund || 'supplier'
		}));
		frm.refresh_field('product_discount_slabs');
	} else {
		frm.doc.price_discount_slabs = items.map(p => {
			const wVal = p.wVal || 0;
			const sVal = p.sVal || 0;
			const totDiscVal = (currentType === 'price') ? (wVal + sVal) : (wVal + sVal);
			const totDiscPct = (currentType === 'pct' || currentType === 'happy') ? (wVal + sVal) : (p.comboDisc || 0);
			const roleStr = (currentType === 'combo') ? ` COMBO ${(p.role || '').toUpperCase()}` : '';

			return {
				item_code: p.id,
				item_name: p.name,
				rate_or_discount: (currentType === 'price') ? 'Discount Amount' : 'Discount Percentage',
				min_qty: p.buyQty || p.qty || 1,
				rule_description: `${p.name} - ${currentType.toUpperCase()}${roleStr} Promo`,
				discount_percentage: (currentType === 'combo' && p.role === 'main') ? 0 : totDiscPct,
				discount_amount: totDiscVal,
				custom_woolmatt_pct: wVal,
				custom_funding_type: p.fund || 'supplier'
			};
		});
		frm.refresh_field('price_discount_slabs');
	}

	// Always keep Item Code child table in sync with active items
	if (items.length && (!frm.doc.apply_on || frm.doc.apply_on === 'Item Code')) {
		frm.doc.items = items.map(p => ({ item_code: p.id }));
		frm.refresh_field('items');
	}
}

function apply_bogo_preset_form(frm, bq, fq) {
	const items = frm.doc.__wm_items || [];
	items.forEach(p => {
		p.buyQty = bq;
		p.freeQty = fq;
	});
	sync_items_to_form_slabs(frm);
	render_form_table(frm);
	frappe.show_alert({ message: `Applied Buy ${bq} Get ${fq} Free`, indicator: 'green' });
}

function apply_bulk_form(frm) {
	const val = parseFloat($('#wm-bulk-val').val()) || 0;
	const fund = $('#wm-bulk-fund').val();
	const currentType = frm.doc.__wm_offer_type || 'pct';
	const items = frm.doc.__wm_items || [];

	items.forEach(p => {
		if (fund) p.fund = fund;
		if (currentType === 'pct' || currentType === 'happy') {
			p.sVal = val;
		} else if (currentType === 'price') {
			p.sVal = val;
		} else if (currentType === 'bogo') {
			if (val > 0) p.freeQty = val;
		} else if (currentType === 'combo') {
			if (p.role !== 'main') p.comboDisc = val;
		}
	});

	sync_items_to_form_slabs(frm);
	render_form_table(frm);
	frappe.show_alert({ message: `Applied bulk values to all items`, indicator: 'blue' });
}
