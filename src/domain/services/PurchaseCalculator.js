/**
 * DOMAIN SERVICE: PurchaseCalculator
 * ALL math/calculation logic for purchase items and totals.
 * Pure functions — no side effects, no framework deps.
 */
export class PurchaseCalculator {
  /**
   * Calculate a single item's amounts based on rate + qty + discounts + tax.
   * Mirrors the original JS logic from PurchaseMaster.js
   */
  static calculateItemAmount(item, taxMode = 'exclusive') {
    const rate = parseFloat(item.PurchaseRate) || 0;
    const qty = parseFloat(item.ItemQty) || 0;
    const cdPer = parseFloat(item.CDPercent) || 0;
    const discPer = parseFloat(item.DiscountPercent) || 0;
    const taxPer = parseFloat(item.TaxPercent) || 0;
    const cessPer = parseFloat(item.CESSPer) || 0;

    let basicAmt = this.round(rate * qty, 2);

    // CD (Cash Discount) deduction
    const cdAmount = this.round((basicAmt * cdPer) / 100, 2);
    const afterCd = this.round(basicAmt - cdAmount, 2);

    // Discount deduction
    const discAmt = this.round((afterCd * discPer) / 100, 2);
    const afterDisc = this.round(afterCd - discAmt, 2);

    let taxAmt = 0;
    let cessAmount = 0;
    let amount = 0;

    if (taxMode === 'exclusive') {
      taxAmt = this.round((afterDisc * taxPer) / 100, 2);
      cessAmount = this.round((afterDisc * cessPer) / 100, 2);
      amount = this.round(afterDisc + taxAmt + cessAmount, 2);
    } else {
      // inclusive: back-calculate tax out
      const divisor = 1 + taxPer / 100 + cessPer / 100;
      const baseAmt = this.round(afterDisc / divisor, 2);
      taxAmt = this.round((baseAmt * taxPer) / 100, 2);
      cessAmount = this.round((baseAmt * cessPer) / 100, 2);
      amount = afterDisc;
    }

    return {
      ...item,
      ProductTotal: basicAmt,
      CDAmount: cdAmount,
      DiscountAmt: discAmt,
      TaxAmt: taxAmt,
      CESSAmount: cessAmount,
      Amount: amount,
    };
  }

  /**
   * Build GST summary grouped by tax slab (taxPercent).
   */
  static buildGstSummary(items, igst = false) {
    const map = {};
    for (const item of items) {
      if (!item.Productcode) continue; // Skip empty rows
      const slab = parseFloat(item.TaxPercent) || 0;
      if (!map[slab]) {
        map[slab] = { gstPer: slab, taxableAmt: 0, cgst: 0, sgst: 0, igstAmt: 0, cessAmt: 0, gstAmt: 0 };
      }
      const taxAmt = parseFloat(item.TaxAmt) || 0;
      const cessAmt = parseFloat(item.CESSAmount) || 0;
      const amount = parseFloat(item.Amount) || 0;

      const taxable = this.round(amount - taxAmt - cessAmt, 2);
      map[slab].taxableAmt = this.round(map[slab].taxableAmt + taxable, 2);
      map[slab].gstAmt = this.round(map[slab].gstAmt + taxAmt, 2);
      if (igst) {
        map[slab].igstAmt = this.round(map[slab].igstAmt + taxAmt, 2);
      } else {
        const half = this.round(taxAmt / 2, 2);
        map[slab].cgst = this.round(map[slab].cgst + half, 2);
        map[slab].sgst = this.round(map[slab].sgst + half, 2);
      }
      map[slab].cessAmt = this.round(map[slab].cessAmt + cessAmt, 2);
    }
    return Object.values(map).sort((a, b) => a.gstPer - b.gstPer);
  }

  /**
   * Calculate totals for the purchase footer.
   */
  static calculateTotals(items, overrides = {}) {
    const getEff = (overrideVal, calcVal) => {
      if (overrideVal !== undefined && overrideVal !== '') {
        const val = parseFloat(overrideVal);
        return isNaN(val) ? 0 : val;
      }
      return calcVal;
    };

    const validItems = items.filter(i => i.Productcode);

    const gridGross = this.round(
      validItems.reduce((sum, i) => sum + (parseFloat(i.ProductTotal) || 0), 0),
      2
    );
    const gridTax = this.round(
      validItems.reduce((sum, i) => sum + (parseFloat(i.TaxAmt) || 0), 0),
      2
    );
    const gridCess = this.round(
      validItems.reduce((sum, i) => sum + (parseFloat(i.CESSAmount) || 0), 0),
      2
    );
    const gridCd = this.round(
      validItems.reduce((sum, i) => sum + (parseFloat(i.CDAmount) || 0), 0),
      2
    );
    const gridDisc = this.round(
      validItems.reduce((sum, i) => sum + (parseFloat(i.DiscountAmt) || 0), 0),
      2
    );

    const grossAmt  = getEff(overrides.grossAmt, gridGross);
    const totalTax  = getEff(overrides.gstAmt, gridTax);
    const totalCess = getEff(overrides.cessAmt, gridCess);
    const totalCd   = getEff(overrides.cdAmt, gridCd);
    const totalDisc = getEff(overrides.discAmt, gridDisc);

    const transAmt  = getEff(overrides.transAmt, 0);
    const otherPlus = getEff(overrides.otherPlus, 0);
    const otherSub  = getEff(overrides.otherSub, 0);
    const tcsPercent = parseFloat(overrides.tcsPercent) || 0;

    const tcsAmt = this.round((grossAmt * tcsPercent) / 100, 2);

    const calculatedNet = this.round(
      (grossAmt + totalTax + totalCess + transAmt + otherPlus + tcsAmt) - (totalCd + totalDisc + otherSub),
      2
    );

    const netAmt = getEff(overrides.netAmt, calculatedNet);

    const igst = overrides.igst || false;
    const cgstAmt = igst ? 0 : getEff(overrides.cgstAmt, this.round(totalTax / 2, 2));
    const sgstAmt = igst ? 0 : getEff(overrides.sgstAmt, this.round(totalTax / 2, 2));
    const igstAmt = igst ? totalTax : 0;

    return {
      grossAmt,
      transAmt,
      displayAmt: getEff(overrides.displayAmt, grossAmt),
      cdAmt: totalCd,
      discAmt: totalDisc,
      cessAmt: totalCess,
      gstAmt: totalTax,
      cgstAmt,
      sgstAmt,
      igstAmt,
      otherPlus,
      otherSub,
      tcsPercent,
      tcsAmt,
      netAmt,
    };
  }

  /**
   * Calculate total item qty (sum of itemQty).
   */
  static totalItemQty(items) {
    return this.round(
      items.filter(i => i.Productcode).reduce((sum, i) => sum + (parseFloat(i.ItemQty) || 0), 0),
      2
    );
  }

  static round(val, decimals = 2) {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}
