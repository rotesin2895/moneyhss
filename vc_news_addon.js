/* ==============================================================
   VIEW COUNTER — NEWS BASE VIEWS ADDON
   วิธีใช้งาน: วาง <script> นี้ต่อท้าย script.js หลัก
   ---------------------------------------------------------------
   ฟีเจอร์:
   1. รองรับ field `views` (number หรือ string "1,234") ใน ALL_NEWS
   2. vcGetNewsDisplayCount(newsId) → base + session views รวมกัน
   3. เมื่ออัพเดทไฟล์ใหม่และเพิ่ม/เปลี่ยน `views` ใน ALL_NEWS
      ระบบจะ migrate อัตโนมัติ:
      - ถ้า base ใหม่ > base เก่า → อัพเดท base (ยอดเพิ่มขึ้น)
      - Session views ของผู้ใช้ยังคงอยู่ครบ
   4. vcGetNewsTotal() → รวม views ทุกข่าว (base + session)
   ============================================================== */

/* ---------------------------------------------------------------
   ขั้นตอนที่ 1: เพิ่ม field "views" ใน ALL_NEWS ในไฟล์ script.js
   ตัวอย่าง:
     { id:"news1", ..., views: 1250, ... }
     { id:"news2", ..., views: "3,478", ... }   ← รูปแบบ string ก็ได้
   ถ้าไม่ใส่ views ระบบจะใช้ 0 เป็น base (เหมือนเดิม)
--------------------------------------------------------------- */

/* ---------------------------------------------------------------
   SECTION A: ฟังก์ชัน helper สำหรับ news base views
--------------------------------------------------------------- */

/**
 * ดึง base views จาก ALL_NEWS item
 * รองรับ field: views (number | string)
 */
function vcGetNewsBaseViews(newsId) {
  for (var i = 0; i < ALL_NEWS.length; i++) {
    if (ALL_NEWS[i].id === newsId) {
      var v = ALL_NEWS[i].views;
      if (v === undefined || v === null) return 0;
      return parseInt(String(v).replace(/,/g, '')) || 0;
    }
  }
  return 0;
}

/**
 * รวม base views (จากไฟล์) + session views (จาก localStorage)
 * ใช้แทน VC.get('news', newsId) เพื่อแสดงยอดจริง
 */
function vcGetNewsDisplayCount(newsId) {
  var base    = vcGetNewsBaseViews(newsId);
  var session = VC.get('news', newsId);
  return base + session;
}

/**
 * รวม views ทุกข่าว (base + session ทั้งหมด)
 */
function vcGetNewsTotal() {
  var total = 0;
  for (var i = 0; i < ALL_NEWS.length; i++) {
    total += vcGetNewsDisplayCount(ALL_NEWS[i].id);
  }
  return total;
}

/* ---------------------------------------------------------------
   SECTION B: Migration — ทำงานอัตโนมัติเมื่อโหลดหน้า
   เปรียบเทียบ base views ในไฟล์กับ snapshot ที่บันทึกไว้ครั้งก่อน
   ถ้า base ใหม่สูงกว่า → อัพเดท snapshot (ไม่ลบ session views)
--------------------------------------------------------------- */
var VC_BASE_KEY = 'hs4_vc_newsbase_v1';  // key สำหรับเก็บ base snapshot

function vcMigrateNewsBase() {
  var savedBase;
  try {
    savedBase = JSON.parse(localStorage.getItem(VC_BASE_KEY) || '{}');
  } catch(e) {
    savedBase = {};
  }

  var changed = false;
  for (var i = 0; i < ALL_NEWS.length; i++) {
    var id      = ALL_NEWS[i].id;
    var newBase = vcGetNewsBaseViews(id);
    var oldBase = savedBase[id] || 0;

    if (newBase > oldBase) {
      /* base views เพิ่มขึ้น (ไฟล์ถูก deploy ใหม่พร้อมค่า views ที่สูงขึ้น) */
      savedBase[id] = newBase;
      changed = true;
    }
  }

  if (changed) {
    try {
      localStorage.setItem(VC_BASE_KEY, JSON.stringify(savedBase));
    } catch(e) {}
  }
}

/* ---------------------------------------------------------------
   SECTION C: Override ฟังก์ชันแสดงผลที่มีอยู่แล้วใน script.js
   ให้ใช้ vcGetNewsDisplayCount แทน VC.get('news', ...) เฉพาะส่วน display
--------------------------------------------------------------- */

/* Override vcRefreshNewsBadge — แสดงยอดรวม (base + session) */
var _origVcRefreshNewsBadge = typeof vcRefreshNewsBadge === 'function' ? vcRefreshNewsBadge : null;
vcRefreshNewsBadge = function(newsId, sessionCount) {
  var displayCount = vcGetNewsDisplayCount(newsId);

  /* Homepage badge */
  var el = document.getElementById('hnum-' + newsId);
  if (el) {
    vcAnimNum(el, displayCount);
    var badge = document.getElementById('hbadge-' + newsId);
    if (badge) badge.className = 'vc-view-badge' + (displayCount >= 100 ? ' vc-hot' : '');
  }
  /* All-news badge */
  var el2 = document.getElementById('annum-' + newsId);
  if (el2) {
    vcAnimNum(el2, displayCount);
    var badge2 = document.getElementById('anbadge-' + newsId);
    if (badge2) badge2.className = 'vc-view-badge' + (displayCount >= 100 ? ' vc-hot' : '');
  }
};

/* Override vcUpdateNewsStats — ยอดรวมทั้งหมดใช้ vcGetNewsTotal() */
var _origVcUpdateNewsStats = typeof vcUpdateNewsStats === 'function' ? vcUpdateNewsStats : null;
vcUpdateNewsStats = function() {
  var total = vcGetNewsTotal();  /* ← base + session ทุกข่าว */

  vcAnimNum(document.getElementById('vcNewsTotalEl'),    total);
  vcAnimNum(document.getElementById('vcAllNewsTotalEl'), total);

  /* หาข่าวที่มียอด display สูงสุด */
  var topId = null, topCount = 0;
  for (var i = 0; i < ALL_NEWS.length; i++) {
    var c = vcGetNewsDisplayCount(ALL_NEWS[i].id);
    if (c > topCount) { topCount = c; topId = ALL_NEWS[i].id; }
  }

  if (topId) {
    var found = null;
    for (var j = 0; j < ALL_NEWS.length; j++) {
      if (ALL_NEWS[j].id === topId) { found = ALL_NEWS[j]; break; }
    }
    var topText = found
      ? (found.title.length > 28 ? found.title.substring(0,28)+'…' : found.title)
        + ' (' + vcFmt(topCount) + ' ครั้ง)'
      : '—';
    var e1 = document.getElementById('vcNewsTopEl');
    var e2 = document.getElementById('vcAllNewsTopEl');
    if (e1) e1.textContent = topText;
    if (e2) e2.textContent = topText;
  }
};

/* Override vcInitBadges — แสดงยอดรวมตั้งแต่ต้น */
var _origVcInitBadges = typeof vcInitBadges === 'function' ? vcInitBadges : null;
vcInitBadges = function() {
  /* Homepage news cards (news1–4) */
  ['news1','news2','news3','news4'].forEach(function(id) {
    var displayCount = vcGetNewsDisplayCount(id);
    var el = document.getElementById('hnum-' + id);
    if (el) el.textContent = vcFmt(displayCount);
    var badge = document.getElementById('hbadge-' + id);
    if (badge && displayCount >= 100) badge.classList.add('vc-hot');
  });
  vcUpdateNewsStats();
  vcUpdateVideoStats();
};

/* ---------------------------------------------------------------
   SECTION D: แก้ openNewsModal ให้แสดง displayCount (base+session)
   แทนที่ newCount (session เท่านั้น) ในส่วน modalViewCount
--------------------------------------------------------------- */
var _origOpenNewsModal = typeof openNewsModal === 'function' ? openNewsModal : null;
openNewsModal = function(newsId) {
  /* เรียก original เพื่อให้ modal ทำงานปกติ */
  if (_origOpenNewsModal) _origOpenNewsModal(newsId);

  /* แก้ไข modalViewCount ให้แสดงยอดรวม (base + session) */
  var vcEl = document.getElementById('modalViewCount');
  if (vcEl) {
    var displayCount = vcGetNewsDisplayCount(newsId);
    vcEl.textContent = vcFmt(displayCount);
    vcEl.classList.remove('vc-pop');
    void vcEl.offsetWidth;
    vcEl.classList.add('vc-pop');
  }
};

/* ---------------------------------------------------------------
   SECTION E: รัน migration และ re-init badges เมื่อโหลดหน้าเสร็จ
--------------------------------------------------------------- */
(function() {
  function _init() {
    vcMigrateNewsBase();  /* ตรวจและอัพเดท base snapshot */
    vcInitBadges();       /* render ยอดรวมทันที */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();

/* ---------------------------------------------------------------
   SECTION F: ฟังก์ชัน utility เพิ่มเติม (ใช้งานใน console ได้)
--------------------------------------------------------------- */

/**
 * แสดง snapshot ยอด views ทุกข่าวใน console
 * ใช้ debug: vcDumpNewsViews()
 */
function vcDumpNewsViews() {
  console.group('[VC] News views snapshot');
  ALL_NEWS.forEach(function(n) {
    var base    = vcGetNewsBaseViews(n.id);
    var session = VC.get('news', n.id);
    var total   = base + session;
    console.log(n.id + ' | base:' + base + ' session:' + session + ' total:' + total + ' | ' + n.title.substring(0,40));
  });
  console.log('GRAND TOTAL:', vcGetNewsTotal());
  console.groupEnd();
}

/**
 * ใช้เมื่อ deploy ครั้งใหม่และต้องการ snapshot ค่า localStorage
 * เอาไปใส่ใน ALL_NEWS field `views` ก่อน deploy
 * vcExportNewsViewsForDeploy()
 */
function vcExportNewsViewsForDeploy() {
  var out = {};
  ALL_NEWS.forEach(function(n) {
    out[n.id] = vcGetNewsDisplayCount(n.id);
  });
  console.log('[VC] วางค่าเหล่านี้เป็น views: N ใน ALL_NEWS ก่อน deploy ครั้งถัดไป:');
  console.log(JSON.stringify(out, null, 2));
  return out;
}
