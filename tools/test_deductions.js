const baseUrl = 'http://localhost:8080';

async function login(email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = res.headers.get('set-cookie');
  const data = await res.json();
  return { ok: data.ok, cookie, user: data.user };
}

async function testSalaryAndRefundDeductions() {
  console.log('=== TEST SALARY & REFUND DEDUCTIONS ===');
  const admin = await login('admin@travel.vn', 'Travel@2026');

  // 1. Check stats before paying salary
  const statsBefore = await fetch(`${baseUrl}/api/admin/daily-stats`, { headers: { cookie: admin.cookie } }).then(r => r.json());
  const netBefore = statsBefore.stats?.net || 0;
  console.log('Net revenue before paying salary:', netBefore);

  // 2. Pay salary to tn001 (15,000,000 d)
  const payRes = await fetch(`${baseUrl}/api/admin/salaries/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: admin.cookie, Origin: 'http://localhost:8080' },
    body: JSON.stringify({ staffId: 'tn001', amount: 15000000, note: 'Lương thử nghiệm trừ tiền' })
  }).then(r => r.json());
  console.log('Salary pay result:', payRes);

  // 3. Check stats after paying salary
  const statsAfter = await fetch(`${baseUrl}/api/admin/daily-stats`, { headers: { cookie: admin.cookie } }).then(r => r.json());
  const netAfter = statsAfter.stats?.net || 0;
  console.log('Net revenue after paying salary:', netAfter);
  console.log('Revenue difference (must be -15,000,000):', netAfter - netBefore);

  // Check last transaction in daily-stats
  const lastItem = statsAfter.stats?.items?.[0];
  console.log('Latest transaction in daily stats:', {
    payCode: lastItem?.payCode,
    kind: lastItem?.kind,
    kindLabel: lastItem?.kindLabel,
    amount: lastItem?.amount,
    isRefund: lastItem?.isRefund
  });

  // 4. Test Refund Pay
  console.log('\n--- TEST REFUND EXECUTION ---');
  // Find approved refund
  const refundList = await fetch(`${baseUrl}/api/admin/refunds`, { headers: { cookie: admin.cookie } }).then(r => r.json());
  const approvedRefund = refundList.refunds?.find(r => r.status === 'approved');
  console.log('Found approved refund:', approvedRefund ? { id: approvedRefund.id, amount: approvedRefund.amount, payCode: approvedRefund.payCode } : 'None');

  if (approvedRefund) {
    const refundPayRes = await fetch(`${baseUrl}/api/admin/refunds/${approvedRefund.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie, Origin: 'http://localhost:8080' },
      body: JSON.stringify({ note: 'Admin hoàn tiền trực tiếp' })
    }).then(r => r.json());
    console.log('Admin refund pay result:', refundPayRes);

    const statsAfterRefund = await fetch(`${baseUrl}/api/admin/daily-stats`, { headers: { cookie: admin.cookie } }).then(r => r.json());
    console.log('Net revenue after refund:', statsAfterRefund.stats?.net);
    console.log('Net decreased by refund amount:', statsAfter.stats?.net - statsAfterRefund.stats?.net);
  }
}

testSalaryAndRefundDeductions().catch(console.error);
