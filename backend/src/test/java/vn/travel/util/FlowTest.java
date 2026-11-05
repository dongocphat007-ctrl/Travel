package vn.travel.util;

import org.junit.jupiter.api.Test;
import vn.travel.service.OpsCore;
import vn.travel.service.OpsCore.Actor;
import vn.travel.web.HttpError;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** TASKS 2.6: đổi trạng thái sai thứ tự hoặc sai vai trò đều bị chặn; đúng thì ghi lịch sử. Duyệt TOÀN BỘ cặp (từ, sang) trong bảng. */
class FlowTest {
    private static final List<String> ROLES = List.of(Flow.CUSTOMER, Flow.CASHIER, Flow.OPERATOR, Flow.GUIDE, Flow.ADMIN, Flow.SYSTEM, Flow.SUPPORT, Flow.CONTENT);
    private static final long NOW = 1_800_000_000_000L;

    private static Map<String, Object> booking(String status) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("id", "bk_t");
        b.put("status", status);
        return b;
    }

    private static Actor actor(String role) { return new Actor("u_" + role, "Người " + role, role); }

    private static int status(Runnable r) { return assertThrows(HttpError.class, r::run).status(); }

    @Test void everyStatusIsKnownAndLabelled() {
        assertEquals(11, Flow.ALL.size());
        for (String s : Flow.ALL) {
            assertTrue(Flow.known(s));
            assertNotEquals(s, Flow.label(s), "thiếu nhãn tiếng Việt cho " + s);
        }
        assertFalse(Flow.known("shipped"));
    }

    @Test void invalidOrderIsRejectedWith409ForEveryRole() {
        int checked = 0;
        for (String from : Flow.ALL) for (String to : Flow.ALL) {
            if (Flow.valid(from, to)) continue;
            for (String role : ROLES) {
                Map<String, Object> b = booking(from);
                assertEquals(409, status(() -> OpsCore.applyStatus(b, to, actor(role), "x", NOW)), from + " → " + to + " (" + role + ")");
                assertEquals(from, b.get("status"), "bị từ chối thì đơn không được đổi");
                assertNull(b.get("history"), "bị từ chối thì không ghi lịch sử");
                checked++;
            }
        }
        assertTrue(checked > 500, "phải duyệt đủ các cặp không hợp lệ, đã duyệt " + checked);
    }

    @Test void validTransitionIsRejectedWith403ForWrongRoleAndAcceptedForRightRole() {
        for (String from : Flow.ALL) for (String to : Flow.ALL) {
            if (!Flow.valid(from, to)) continue;
            for (String role : ROLES) {
                Map<String, Object> b = booking(from);
                if (Flow.allowed(from, to, role)) {
                    OpsCore.applyStatus(b, to, actor(role), "ghi chú", NOW);
                    assertEquals(to, b.get("status"), from + " → " + to + " (" + role + ")");
                } else {
                    assertEquals(403, status(() -> OpsCore.applyStatus(b, to, actor(role), "x", NOW)), from + " → " + to + " (" + role + ")");
                    assertEquals(from, b.get("status"));
                    assertNull(b.get("history"));
                }
            }
        }
    }

    @Test void unknownTargetIsBadRequest() {
        assertEquals(400, status(() -> OpsCore.applyStatus(booking("pending_payment"), "shipped", actor(Flow.ADMIN), "", NOW)));
    }

    @Test void historyRecordsWhoRoleWhenFromToAndNote() {
        Map<String, Object> b = booking("paid_deposit");
        OpsCore.applyStatus(b, Flow.CONFIRMED, new Actor("ad001", "Quản trị", Flow.ADMIN), "Admin duyệt", NOW);
        List<Object> h = Maps.list(b.get("history"));
        assertEquals(1, h.size());
        Map<String, Object> e = Maps.map(h.get(0));
        assertEquals("paid_deposit", e.get("from"));
        assertEquals("confirmed", e.get("to"));
        assertEquals("ad001", e.get("byId"));
        assertEquals("Quản trị", e.get("byName"));
        assertEquals("ADMIN", e.get("role"));
        assertEquals("Admin duyệt", e.get("note"));
        assertEquals("ad001 – ADMIN", e.get("by"));
        assertNotNull(e.get("at"));
        assertNotNull(b.get("statusAt"));
    }

    @Test void legacyPendingStatusIsTreatedAsPendingPayment() {
        Map<String, Object> b = booking("pending");
        OpsCore.applyStatus(b, Flow.PAID_DEPOSIT, actor(Flow.CASHIER), "", NOW);
        assertEquals("paid_deposit", b.get("status"));
    }

    @Test void adminCanNeverMarkMoneyReceived() {
        for (String to : List.of(Flow.PAID_DEPOSIT, Flow.PAID_FULL)) {
            assertFalse(Flow.allowed(Flow.PENDING_PAYMENT, to, Flow.ADMIN), "tách người thu tiền và người duyệt đơn");
            assertTrue(Flow.allowed(Flow.PENDING_PAYMENT, to, Flow.CASHIER));
        }
    }

    @Test void finishedOrdersCannotBeCancelledAnymore() {
        for (String from : List.of(Flow.COMPLETED, Flow.IN_PROGRESS, Flow.CANCELLED, Flow.REFUNDED))
            for (String role : ROLES)
                assertFalse(Flow.allowed(from, Flow.CANCELLED, role), from + " không được hủy ngầm (" + role + ")");
    }
}