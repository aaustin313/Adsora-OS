/**
 * Media Buyer Payout Calculator
 *
 * Net Profit = Revenue - Ad Spend - Overhead
 * Overhead = gross profit × overhead rate (default 18%)
 *
 * TIERS (applied to net profit):
 *   Base:     30%  — first $15K/mo net profit
 *   Scale:    35%  — $15K–$40K/mo net profit
 *   Elite:    40%  — $40K+ /mo net profit
 *   New Vert: +5%  — bonus on profit from new verticals (first 90 days)
 */

const TIERS = [
  { name: 'Base',  floor: 0,     ceiling: 15000, rate: 0.30 },
  { name: 'Scale', floor: 15000, ceiling: 40000, rate: 0.35 },
  { name: 'Elite', floor: 40000, ceiling: Infinity, rate: 0.40 },
];

const NEW_VERTICAL_BONUS = 0.05;
const DEFAULT_OVERHEAD_RATE = 0.18;

function calculate({ revenue, adSpend, overheadRate = DEFAULT_OVERHEAD_RATE, newVerticalProfit = 0 }) {
  const grossProfit = revenue - adSpend;
  const overhead = grossProfit * overheadRate;
  const netProfit = grossProfit - overhead;

  if (netProfit <= 0) {
    return {
      revenue, adSpend, grossProfit, overhead, netProfit,
      buyerPayout: 0, ownerKeeps: 0, breakdown: ['No profit — no payout.'],
    };
  }

  let buyerPayout = 0;
  const breakdown = [];
  let remaining = netProfit;

  for (const tier of TIERS) {
    const taxable = Math.min(Math.max(remaining, 0), tier.ceiling - tier.floor);
    if (taxable <= 0) break;

    const tierPayout = taxable * tier.rate;
    buyerPayout += tierPayout;
    breakdown.push(`${tier.name} (${(tier.rate * 100).toFixed(0)}%): $${taxable.toLocaleString()} × ${tier.rate} = $${tierPayout.toLocaleString()}`);
    remaining -= taxable;
  }

  // New vertical bonus
  let verticalBonus = 0;
  if (newVerticalProfit > 0) {
    verticalBonus = newVerticalProfit * NEW_VERTICAL_BONUS;
    buyerPayout += verticalBonus;
    breakdown.push(`New Vertical Bonus (+5%): $${newVerticalProfit.toLocaleString()} × 0.05 = $${verticalBonus.toLocaleString()}`);
  }

  const ownerKeeps = netProfit - buyerPayout;
  const effectiveRate = (buyerPayout / netProfit * 100).toFixed(1);

  return {
    revenue, adSpend, grossProfit, overhead, netProfit,
    buyerPayout, verticalBonus, ownerKeeps, effectiveRate, breakdown,
  };
}

function print(result) {
  console.log('\n========================================');
  console.log('  MEDIA BUYER PAYOUT CALCULATOR');
  console.log('========================================\n');
  console.log(`  Revenue:        $${result.revenue.toLocaleString()}`);
  console.log(`  Ad Spend:       $${result.adSpend.toLocaleString()}`);
  console.log(`  Gross Profit:   $${result.grossProfit.toLocaleString()}`);
  console.log(`  Overhead (18%): $${result.overhead.toLocaleString()}`);
  console.log(`  Net Profit:     $${result.netProfit.toLocaleString()}`);
  console.log('\n  --- Tier Breakdown ---');
  result.breakdown.forEach(line => console.log(`  ${line}`));
  console.log('\n  --- Summary ---');
  console.log(`  Buyer Payout:   $${result.buyerPayout.toLocaleString()} (${result.effectiveRate}% effective)`);
  console.log(`  Owner Keeps:    $${result.ownerKeeps.toLocaleString()}`);
  console.log('\n========================================\n');
}

// --- Run examples or pass your own numbers ---
if (process.argv[2]) {
  // Usage: node media-buyer-payout.js <revenue> <adSpend> [newVerticalProfit]
  const revenue = parseFloat(process.argv[2]);
  const adSpend = parseFloat(process.argv[3] || 0);
  const newVerticalProfit = parseFloat(process.argv[4] || 0);
  print(calculate({ revenue, adSpend, newVerticalProfit }));
} else {
  // Show example scenarios
  console.log('\n>>> SCENARIO 1: Small buyer — $30K revenue, $18K spend');
  print(calculate({ revenue: 30000, adSpend: 18000 }));

  console.log('>>> SCENARIO 2: Mid buyer — $80K revenue, $45K spend');
  print(calculate({ revenue: 80000, adSpend: 45000 }));

  console.log('>>> SCENARIO 3: Big buyer — $200K revenue, $110K spend');
  print(calculate({ revenue: 200000, adSpend: 110000 }));

  console.log('>>> SCENARIO 4: Big buyer + new vertical ($10K profit from mass torts)');
  print(calculate({ revenue: 200000, adSpend: 110000, newVerticalProfit: 10000 }));
}
