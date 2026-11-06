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

async function get(path, cookie) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookie || '' }
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e.message, status: res.status, raw: text.slice(0, 100) };
  }
}

async function run() {
  console.log('--- 1. ADMIN TEST (admin@travel.vn) ---');
  const admin = await login('admin@travel.vn', 'Travel@2026');
  if (admin.ok) {
    const queue = await get('/api/admin/queue', admin.cookie);
    console.log('✅ Admin Queue:', {
      confirmBookings: queue.confirm?.length,
      refundsPending: queue.refunds?.length,
      reconciliationsPending: queue.reconciliations?.length
    });
    const salaries = await get('/api/admin/salaries', admin.cookie);
    console.log('✅ Admin Salaries:', {
      staffCount: salaries.staff?.length,
      logsCount: salaries.logs?.length
    });
    const stats = await get('/api/admin/daily-stats', admin.cookie);
    console.log('✅ Admin Daily Stats:', {
      itemsCount: stats.stats?.items?.length
    });
    const allBookings = await get('/api/bookings', admin.cookie);
    console.log('✅ Admin All Bookings:', {
      total: allBookings.bookings?.length
    });
  }

  console.log('\n--- 2. CASHIER TEST (thungan@travel.vn) ---');
  const cashier = await login('thungan@travel.vn', 'Travel@2026');
  if (cashier.ok) {
    const queue = await get('/api/cashier/queue', cashier.cookie);
    console.log('✅ Cashier Queue:', {
      awaitingPayment: queue.awaiting?.length,
      pendingBalance: queue.balance?.length,
      discrepancies: queue.discrepancies?.length,
      refundsDue: queue.refunds?.length
    });
    const recs = await get('/api/cashier/reconcile', cashier.cookie);
    console.log('✅ Cashier Reconciliations:', { count: recs.reconciliations?.length });
  }

  console.log('\n--- 3. OPERATOR TEST (dieuhanh@travel.vn) ---');
  const op = await login('dieuhanh@travel.vn', 'Travel@2026');
  if (op.ok) {
    const queue = await get('/api/operator/queue', op.cookie);
    console.log('✅ Operator Queue:', {
      unassigned: queue.unassigned?.length,
      pending: queue.pending?.length,
      accepted: queue.accepted?.length,
      running: queue.running?.length,
      openIncidents: queue.incidents?.length,
      cancelProposals: queue.proposals?.length,
      departures: queue.departures?.length
    });
  }

  console.log('\n--- 4. SUPPORT TEST (cskh@travel.vn) ---');
  const sup = await login('cskh@travel.vn', 'Travel@2026');
  if (sup.ok) {
    const complaints = await get('/api/support/complaints', sup.cookie);
    const waitlist = await get('/api/support/waitlist', sup.cookie);
    console.log('✅ Support Data:', {
      complaintsCount: complaints.complaints?.length,
      waitlistCount: waitlist.waitlist?.length
    });
  }

  console.log('\n--- 5. CONTENT TEST (bientap@travel.vn) ---');
  const content = await login('bientap@travel.vn', 'Travel@2026');
  if (content.ok) {
    const drafts = await get('/api/content/drafts', content.cookie);
    const foods = await get('/api/content/foods', content.cookie);
    console.log('✅ Content Data:', {
      draftsCount: drafts.drafts?.length,
      foodsCount: foods.foods?.length
    });
  }

  console.log('\n--- 6. GUIDE TEST (hdv.quan@travel.vn) ---');
  const guide = await login('hdv.quan@travel.vn', 'Travel@2026');
  if (guide.ok) {
    const myTours = await get('/api/guide/tours', guide.cookie);
    console.log('✅ Guide (Quân) Tours:', {
      offers: myTours.offers?.length,
      upcoming: myTours.upcoming?.length,
      running: myTours.running?.length,
      done: myTours.done?.length
    });
  }

  console.log('\n--- 7. CUSTOMER TEST (an.nguyen@gmail.com) ---');
  const cus = await login('an.nguyen@gmail.com', 'Travel@2026');
  if (cus.ok) {
    const myBookings = await get('/api/bookings', cus.cookie);
    const wallet = await get('/api/wallet', cus.cookie);
    console.log('✅ Customer (An) Data:', {
      bookingsCount: myBookings.bookings?.length,
      walletBalance: wallet.wallet?.balance,
      walletPoints: wallet.wallet?.points
    });
  }
}

run().catch(console.error);
