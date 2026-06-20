/* ============================================================
   中学受験サポートアプリ - 画面ロジック
   バックエンド不要。すべてブラウザ内で動きます。
   ============================================================ */

const STORAGE_KEY = "jh-exam-home";
const view = document.getElementById("view");
const homeLabel = document.getElementById("homeLabel");

/* ---------- 自宅最寄り駅の読み込み/保存 ---------- */
function loadHome() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.lat === "number") return saved;
  } catch (e) {}
  return { ...DEFAULT_HOME };
}
function saveHome(home) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(home));
}
let HOME = loadHome();

function refreshHomeLabel() {
  homeLabel.textContent = "基準駅: " + (HOME.stationName || "未設定");
}

/* ---------- 距離計算（直線距離・ハバーサイン） ---------- */
function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== "number")) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function schoolDistance(s) {
  return distanceKm(HOME.lat, HOME.lng, s.lat, s.lng);
}
function fmtKm(km) {
  if (km == null) return "—";
  return km < 10 ? km.toFixed(1) + "km" : Math.round(km) + "km";
}

/* ---------- 日付ヘルパー ---------- */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
function parseDate(str) {
  const d = new Date(str + "T00:00:00");
  return isNaN(d) ? null : d;
}
function fmtDate(str) {
  const d = parseDate(str);
  if (!d) return str || "";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}
function nextExamDate(s) {
  const dates = (s.exams || []).map((e) => e.date).filter(Boolean).sort();
  return dates[0] || null;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ============================================================
   学校一覧
   ============================================================ */
let currentSort = "deviation";

function renderList() {
  const schools = [...SCHOOLS];
  schools.sort((a, b) => {
    switch (currentSort) {
      case "deviation": return (b.deviation || 0) - (a.deviation || 0);
      case "distance": {
        const da = schoolDistance(a), db = schoolDistance(b);
        return (da == null ? Infinity : da) - (db == null ? Infinity : db);
      }
      case "exam": return (nextExamDate(a) || "9999").localeCompare(nextExamDate(b) || "9999");
      case "capacity": return (b.capacity || 0) - (a.capacity || 0);
      default: return 0;
    }
  });

  let html = `
    <div class="controls">
      <select id="sortSel">
        <option value="deviation">偏差値が高い順</option>
        <option value="distance">距離が近い順</option>
        <option value="exam">受験日が早い順</option>
        <option value="capacity">募集人数が多い順</option>
      </select>
    </div>
    <p class="section-title">登録校 ${schools.length} 校</p>
  `;

  if (!schools.length) {
    html += `<div class="empty">学校が登録されていません。<br>js/data.js に追加してください。</div>`;
  }

  for (const s of schools) {
    const km = fmtKm(schoolDistance(s));
    html += `
      <div class="card" data-id="${esc(s.id)}">
        <div class="card-head">
          <div>
            <p class="card-name">${esc(s.name)}</p>
            <span class="badge ${esc(s.type)}">${esc(s.type)}</span>
          </div>
          <div class="dev">
            <div class="num">${s.deviation ?? "—"}</div>
            <div class="lbl">偏差値</div>
          </div>
        </div>
        <div class="meta-grid">
          <div><span class="k">距離</span><span class="v">${km}</span></div>
          <div><span class="k">募集</span><span class="v">${s.capacity ?? "—"}名</span></div>
          <div><span class="k">初回</span><span class="v">${nextExamDate(s) ? fmtDate(nextExamDate(s)) : "—"}</span></div>
          <div><span class="k">最寄</span><span class="v">${esc(s.station || "—")}</span></div>
        </div>
        <div class="tag-row">
          ${(s.subjects || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}
        </div>
      </div>`;
  }

  view.innerHTML = html;
  document.getElementById("sortSel").value = currentSort;
  document.getElementById("sortSel").onchange = (e) => {
    currentSort = e.target.value;
    renderList();
  };
  view.querySelectorAll(".card").forEach((c) => {
    c.onclick = () => renderDetail(c.dataset.id);
  });
}

/* ============================================================
   学校詳細
   ============================================================ */
function renderDetail(id) {
  const s = SCHOOLS.find((x) => x.id === id);
  if (!s) return renderList();
  const km = fmtKm(schoolDistance(s));
  const mapsUrl =
    s.lat && s.lng
      ? `https://www.google.com/maps/dir/?api=1&origin=${HOME.lat},${HOME.lng}&destination=${s.lat},${s.lng}`
      : null;

  const examRows = (s.exams || [])
    .map(
      (e) => `<div class="exam-row">
        <span class="d">${esc(e.name || "")}　${fmtDate(e.date)}</span>
        <span>${e.capacity ? esc(e.capacity) + "名" : ""}</span>
      </div>`
    )
    .join("") || `<div class="hint">受験日は未登録です</div>`;

  const evRows = (s.events || [])
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map(
      (e) => `<div class="exam-row">
        <span class="d">${fmtDate(e.date)}</span>
        <span><span class="ev-type ${esc(e.type || "その他")}">${esc(e.type || "その他")}</span> ${esc(e.title)}</span>
      </div>`
    )
    .join("") || `<div class="hint">イベントは未登録です</div>`;

  view.innerHTML = `
    <button class="detail-back" id="back">← 一覧へ戻る</button>
    <div class="detail">
      <h2>${esc(s.name)}</h2>
      <p class="sub"><span class="badge ${esc(s.type)}">${esc(s.type)}</span>　${esc(s.station || "")}</p>

      <div class="info-block">
        <h3>基本情報</h3>
        <div class="kv"><span class="k">偏差値</span><span class="v">${s.deviation ?? "—"}</span></div>
        <div class="kv"><span class="k">難易度</span><span class="v">${esc(s.level || "—")}</span></div>
        <div class="kv"><span class="k">募集人数</span><span class="v">${s.capacity ?? "—"} 名</span></div>
        <div class="kv"><span class="k">受験科目</span><span class="v">${(s.subjects || []).join("・") || "—"}</span></div>
        <div class="kv"><span class="k">自宅から</span><span class="v">${km}（直線距離）</span></div>
        <div class="kv"><span class="k">住所</span><span class="v">${esc(s.address || "—")}</span></div>
      </div>

      <div class="info-block">
        <h3>受験日程</h3>
        ${examRows}
      </div>

      <div class="info-block">
        <h3>特徴・特色</h3>
        <div class="feature-text">${esc(s.features || "—")}</div>
      </div>

      <div class="info-block">
        <h3>イベント</h3>
        ${evRows}
      </div>

      <div class="btn-row">
        ${s.url ? `<a class="btn btn-outline" href="${esc(s.url)}" target="_blank" rel="noopener">公式サイト</a>` : ""}
        ${mapsUrl ? `<a class="btn btn-primary" href="${mapsUrl}" target="_blank" rel="noopener">ルート検索</a>` : ""}
      </div>
    </div>
  `;
  document.getElementById("back").onclick = () => switchTab("list");
}

/* ============================================================
   カレンダー（全校のイベントを日付順に）
   ============================================================ */
function renderCalendar() {
  const today = todayStr();
  const all = [];
  for (const s of SCHOOLS) {
    for (const e of s.events || []) {
      if (e.date) all.push({ ...e, school: s.name });
    }
    for (const ex of s.exams || []) {
      if (ex.date) all.push({ date: ex.date, title: `${ex.name || ""}入試`, type: "受験", school: s.name });
    }
  }
  all.sort((a, b) => a.date.localeCompare(b.date));

  let html = `<p class="section-title">これからの予定</p>`;
  if (!all.length) {
    view.innerHTML = html + `<div class="empty">イベントが登録されていません。</div>`;
    return;
  }

  let lastMonth = "";
  for (const e of all) {
    const d = parseDate(e.date);
    const monthKey = d ? `${d.getFullYear()}年${d.getMonth() + 1}月` : "";
    if (monthKey !== lastMonth) {
      html += `<div class="month-head">${monthKey}</div>`;
      lastMonth = monthKey;
    }
    const past = e.date < today ? " past" : "";
    html += `
      <div class="ev${past}">
        <div class="ev-date">
          <div class="dd">${d ? d.getDate() : "?"}</div>
          <div class="wd">${d ? WEEKDAYS[d.getDay()] : ""}</div>
        </div>
        <div class="ev-body">
          <div class="t">${esc(e.title)}</div>
          <div class="s">${esc(e.school)}</div>
        </div>
        <span class="ev-type ${esc(e.type || "その他")}">${esc(e.type || "その他")}</span>
      </div>`;
  }
  view.innerHTML = html;
}

/* ============================================================
   設定（自宅最寄り駅）
   ============================================================ */
function renderSettings() {
  view.innerHTML = `
    <p class="section-title">自宅の最寄り駅（距離計算の基準）</p>
    <div class="info-block">
      <div class="field">
        <label>駅名（表示用）</label>
        <input id="stName" type="text" value="${esc(HOME.stationName || "")}" placeholder="例: 中野駅" />
      </div>
      <div class="field">
        <label>緯度（lat）</label>
        <input id="stLat" type="number" step="0.0001" value="${HOME.lat ?? ""}" placeholder="例: 35.7075" />
      </div>
      <div class="field">
        <label>経度（lng）</label>
        <input id="stLng" type="number" step="0.0001" value="${HOME.lng ?? ""}" placeholder="例: 139.6657" />
        <p class="hint">Googleマップで駅を長押し（右クリック）すると緯度・経度が表示されます。</p>
      </div>
      <button class="btn btn-primary" id="saveBtn">保存する</button>
      <div class="save-ok" id="saveOk"></div>
    </div>
    <p class="hint">※ 設定はこの端末のブラウザに保存されます。</p>
  `;
  document.getElementById("saveBtn").onclick = () => {
    const lat = parseFloat(document.getElementById("stLat").value);
    const lng = parseFloat(document.getElementById("stLng").value);
    HOME = {
      stationName: document.getElementById("stName").value.trim() || "自宅",
      lat: isNaN(lat) ? HOME.lat : lat,
      lng: isNaN(lng) ? HOME.lng : lng
    };
    saveHome(HOME);
    refreshHomeLabel();
    document.getElementById("saveOk").textContent = "✓ 保存しました";
  };
}

/* ============================================================
   タブ切り替え
   ============================================================ */
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === tab)
  );
  if (tab === "list") renderList();
  else if (tab === "calendar") renderCalendar();
  else if (tab === "settings") renderSettings();
}

document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => switchTab(t.dataset.tab);
});

/* ---------- 初期表示 ---------- */
refreshHomeLabel();
renderList();
