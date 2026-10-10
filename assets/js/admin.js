const icon = (name) => `<i class="ph-bold ph-${name}" aria-hidden="true"></i>`;
const API = window.APP_CONFIG.API_BASE;
const root = document.querySelector('#root');
const REGIONS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'north', label: 'Miền Bắc' },
  { id: 'central', label: 'Miền Trung' },
  { id: 'south', label: 'Miền Nam' },
];
const state = {
  token: localStorage.getItem('dc_admin_token') || '',
  tab: 'dashboard',
  configTab: 'qr',
  dash: null,
  users: [],
  userPage: 1,
  userPages: 1,
  userTotal: 0,
  userStatus: 'all',
  userQuery: '',
  rides: [],
  rideRegion: 'all',
  ridePage: 1,
  editing: null,
  settings: { qrConfig: {}, telegramConfig: {} },
  loginError: '',
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
const regionLabel = (id) => REGIONS.find((item) => item.id === id)?.label || id;
const formatTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};
const nowInput = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
};
const toInput = (iso) => {
  if (!iso) return nowInput();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
};
const qrImage = (cfg = {}) => {
  const query = new URLSearchParams({
    amount: String(Number(cfg.amount) || 0),
    addInfo: cfg.transferNote || '',
    accountName: cfg.accountName || '',
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(cfg.bankName || 'BANK')}-${encodeURIComponent(cfg.accountNumber || '0')}-compact2.png?${query}`;
};

async function api(path, options = {}) {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    state.token = '';
    localStorage.removeItem('dc_admin_token');
  }
  if (!response.ok) throw new Error(data.message || 'Có lỗi xảy ra');
  return data;
}

function loginView() {
  return `<section class="login-screen">
    <div class="login-brand"><div class="logo">DRIVER <span>APP</span></div><h1>Quản trị nhóm tài xế</h1><p>Duyệt thành viên, đăng cuốc xe và cấu hình QR, Telegram.</p></div>
    <div class="login-panel"><form class="login-card" id="login-form">
      <h2>Đăng nhập</h2>
      <p class="muted">Dùng tài khoản quản trị để vào bảng điều khiển.</p>
      <label class="field">Tài khoản<input name="username" autocomplete="username" required></label>
      <label class="field">Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary full" type="submit">Vào trang quản trị</button>
      <div class="msg">${esc(state.loginError)}</div>
    </form></div>
  </section>`;
}

function side() {
  const item = (id, label, name) => `<button class="nav-btn${state.tab === id ? ' active' : ''}" data-tab="${id}">${icon(name)}<span>${label}</span></button>`;
  return `<aside class="side">
    <div class="logo">DRIVER <span>APP</span><div class="muted side-note">Bảng quản trị</div></div>
    ${item('dashboard', 'Tổng quan', 'squares-four')}
    ${item('members', 'Thành viên', 'users')}
    ${item('rides', 'Cuốc xe', 'car')}
    ${item('settings', 'Cấu hình', 'gear')}
    <button class="nav-btn logout" id="logout">${icon('sign-out')}<span>Đăng xuất</span></button>
  </aside>`;
}

function dashboardView() {
  const data = state.dash || { members: {}, rides: {}, recentMembers: [], recentRides: [] };
  return `<div class="topbar"><div><h1>Tổng quan</h1><p class="muted">Số liệu thành viên và cuốc xe đang mở.</p></div></div>
    <section class="grid stats">
      <article class="card stat"><span>Thành viên</span><b>${data.members.total || 0}</b></article>
      <article class="card stat"><span>Chờ duyệt</span><b>${data.members.pending || 0}</b></article>
      <article class="card stat"><span>Đã duyệt</span><b>${data.members.approved || 0}</b></article>
      <article class="card stat"><span>Cuốc xe</span><b>${data.rides.total || 0}</b></article>
    </section>
    <div style="height:12px"></div>
    <section class="grid stats">
      <article class="card stat"><span>Miền Bắc</span><b>${data.rides.north || 0}</b></article>
      <article class="card stat"><span>Miền Trung</span><b>${data.rides.central || 0}</b></article>
      <article class="card stat"><span>Miền Nam</span><b>${data.rides.south || 0}</b></article>
      <article class="card stat"><span>Từ chối</span><b>${data.members.rejected || 0}</b></article>
    </section>
    <div style="height:12px"></div>
    <section class="grid two">
      <article class="card"><h3>Thành viên mới</h3>${(data.recentMembers || []).map((user) => `<p>${esc(user.name)} · ${esc(user.phone)} · ${esc(user.status)}</p>`).join('') || '<p class="muted">Chưa có thành viên.</p>'}</article>
      <article class="card"><h3>Cuốc mới nhất</h3>${(data.recentRides || []).map((ride) => `<p>${esc(ride.driverName)} · ${esc(ride.startPoint)} → ${esc(ride.pickupPoint)}</p>`).join('') || '<p class="muted">Chưa có cuốc xe.</p>'}</article>
    </section>`;
}

function membersView() {
  const rows = state.users.length ? state.users.map((user, index) => `<tr>
      <td class="num">${(state.userPage - 1) * 8 + index + 1}</td>
      <td><div class="who"><span class="ava">${esc(initials(user.name))}</span><span><b>${esc(user.name)}</b><small>${esc(user.phone)}</small></span></div></td>
      <td>${esc(user.carType)} <span class="dim">· ${esc(user.carYear)}</span></td>
      <td><span class="status ${esc(user.status)}">${esc(STATUS_LABEL[user.status] || user.status)}</span></td>
      <td class="dim">${esc(formatTime(user.createdAt))}</td>
      <td class="ops">
        <button class="btn-approve" data-approve="${esc(user.id)}" ${user.status === 'pending' ? '' : 'disabled'}>${icon('check')} ${user.status === 'pending' ? 'Duyệt' : 'Đã duyệt'}</button>
        <button class="icon-act danger" data-delete-user="${esc(user.id)}" aria-label="Xóa ${esc(user.name)}">${icon('trash')}</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6">Không có thành viên phù hợp.</td></tr>';
  return `<div class="topbar"><div><h1>Thành viên</h1><p class="muted">Duyệt hoặc xóa tài khoản đăng ký.</p></div></div>
    <section class="card">
      <div class="toolbar">
        <select id="user-status" class="control">
          <option value="all">Tất cả</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </select>
        <input id="user-query" class="control grow" placeholder="Tìm tên hoặc số điện thoại" value="${esc(state.userQuery)}">
        <button class="primary" id="user-search" type="button">${icon('funnel')}<span>Lọc</span></button>
        <button class="ghost" id="user-export" type="button">${icon('download-simple')}<span>Xuất TXT</span></button>
      </div>
      <div class="table-wrap" style="margin-top:12px"><table class="members">
        <thead><tr><th>#</th><th>Thành viên</th><th>Xe</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="pager" style="margin-top:12px">
        <button class="ghost" id="prev-page" ${state.userPage <= 1 ? 'disabled' : ''}>Trước</button>
        <span>Trang ${state.userPage}/${state.userPages} · ${state.userTotal} thành viên</span>
        <button class="ghost" id="next-page" ${state.userPage >= state.userPages ? 'disabled' : ''}>Sau</button>
      </div>
    </section>`;
}

function mapEmbed(start, end) {
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(`${start}, Việt Nam`)}&daddr=${encodeURIComponent(`${end}, Việt Nam`)}&output=embed`;
}
function mapLink(start, end) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}`;
}

function rideForm() {
  const ride = state.editing;
  return `<form id="ride-form" class="card">
    <h3>${ride ? 'Sửa cuốc xe' : 'Thêm cuốc xe'}</h3>
    <label class="field">Tên tài xế<input name="driverName" required value="${esc(ride?.driverName || '')}"></label>
    <label class="field">Số điện thoại<input name="phone" required value="${esc(ride?.phone || '')}"></label>
    <div class="split">
      <label class="field">Điểm đi<input name="startPoint" required value="${esc(ride?.startPoint || '')}"></label>
      <label class="field">Điểm đón<input name="pickupPoint" required value="${esc(ride?.pickupPoint || '')}"></label>
    </div>
    <div class="gmap is-empty" id="gmap">
      <p id="gmap-empty">Nhập điểm đi và điểm đón để tạo Google Maps.</p>
      <iframe id="gmap-frame" title="Bản đồ tuyến"></iframe>
      <a id="gmap-link" target="_blank" rel="noopener">Mở chỉ đường</a>
    </div>
    <label class="field">Vùng miền<select name="region">${REGIONS.filter((item) => item.id !== 'all').map((item) => `<option value="${item.id}" ${ride?.region === item.id ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
    <div class="split">
      <label class="field">Giá chuyến<input name="price" type="number" min="1" required value="${esc(ride?.price || '')}"></label>
      <label class="field">Thời gian<input name="departAt" type="datetime-local" required value="${esc(toInput(ride?.departAt))}"></label>
    </div>
    <label class="field">Ghi chú<textarea name="note" rows="3">${esc(ride?.note || '')}</textarea></label>
    <label class="field">Trạng thái<select name="status">
      <option value="open" ${ride?.status === 'taken' ? '' : 'selected'}>Chưa nhận</option>
      <option value="taken" ${ride?.status === 'taken' ? 'selected' : ''}>Đã nhận</option>
    </select></label>
    <label class="check"><input type="checkbox" name="hot" ${ride?.hot ? 'checked' : ''}> Đánh dấu cuốc hot</label>
    <div class="actions"><button class="primary" type="submit">${ride ? 'Cập nhật' : 'Thêm cuốc'}</button>${ride ? '<button class="ghost" type="button" id="cancel-edit">Hủy sửa</button>' : ''}</div>
    <div class="msg" id="ride-msg"></div>
  </form>`;
}

function ridesView() {
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(state.rides.length / pageSize));
  if (state.ridePage > pages) state.ridePage = pages;
  if (state.ridePage < 1) state.ridePage = 1;
  const start = (state.ridePage - 1) * pageSize;
  const visible = state.rides.slice(start, start + pageSize);
  const rows = visible.length ? visible.map((ride) => `<article class="ride-item">
      <div class="ride-item-main">
        <div class="ride-item-top"><strong>${esc(ride.driverName)}</strong><span>${esc(ride.phone)}</span>${ride.hot ? '<em>Hot</em>' : ''}</div>
        <div class="ride-item-route"><b>${esc(ride.startPoint)}</b><i class="ph-bold ph-arrow-right"></i><b>${esc(ride.pickupPoint)}</b></div>
        <div class="ride-item-meta"><span class="ride-state ${ride.status === 'taken' ? 'taken' : 'open'}">${ride.status === 'taken' ? 'Đã nhận' : 'Chưa nhận'}</span><span>${esc(regionLabel(ride.region))}</span><span>${money(ride.price)}</span><span>${esc(formatTime(ride.departAt))}</span></div>
        ${ride.note ? `<p>${esc(ride.note)}</p>` : ''}
      </div>
      <div class="ops">
        <button class="icon-act" data-edit="${esc(ride.id)}" aria-label="Sửa cuốc">${icon('pencil-simple')}</button>
        <button class="icon-act danger" data-delete-ride="${esc(ride.id)}" aria-label="Xóa cuốc">${icon('trash')}</button>
      </div>
    </article>`).join('') : '<div class="empty-admin">Chưa có cuốc xe.</div>';
  return `<div class="topbar"><div><h1>Cuốc xe</h1><p class="muted">Thêm cuốc để app tài xế hiển thị ngay. Thời gian mặc định là hôm nay.</p></div></div>
    <section class="rides-layout">
      ${rideForm()}
      <div class="card ride-board">
        <div class="filters">${REGIONS.map((item) => `<button class="${state.rideRegion === item.id ? 'primary' : 'ghost'}" data-ride-region="${item.id}">${item.label}</button>`).join('')}</div>
        <div class="ride-list">${rows}</div>
        <div class="pager">
          <button class="ghost" id="ride-prev" ${state.ridePage <= 1 ? 'disabled' : ''}>Trước</button>
          <span>Trang ${state.ridePage}/${pages} · ${state.rides.length} cuốc</span>
          <button class="ghost" id="ride-next" ${state.ridePage >= pages ? 'disabled' : ''}>Sau</button>
        </div>
      </div>
    </section>`;
}

function settingsView() {
  const qr = state.settings.qrConfig || {};
  const tg = state.settings.telegramConfig || {};
  return `<div class="topbar"><div><h1>Cấu hình</h1><p class="muted">QR thanh toán phí vào nhóm và bot Telegram.</p></div></div>
    <div class="tabs">
      <button class="ghost" data-config="qr">Cấu hình QR</button>
      <button class="ghost" data-config="telegram">Bot Telegram</button>
    </div>
    <section class="grid two ${state.configTab === 'qr' ? '' : 'hidden'}" id="qr-panel">
      <form class="card" id="qr-form">
        <label class="field">Ngân hàng<input name="bankName" value="${esc(qr.bankName || '')}" required></label>
        <label class="field">Số tài khoản<input name="accountNumber" value="${esc(qr.accountNumber || '')}" required></label>
        <label class="field">Tên chủ tài khoản<input name="accountName" value="${esc(qr.accountName || '')}" required></label>
        <label class="field">Số tiền<input name="amount" type="number" value="${esc(qr.amount || 0)}"></label>
        <label class="field">Nội dung chuyển khoản<input name="transferNote" value="${esc(qr.transferNote || '')}"></label>
        <button class="primary" type="submit">Lưu QR</button>
        <div class="msg" id="qr-msg"></div>
      </form>
      <article class="card preview"><h3>Xem trước</h3><img id="qr-preview" alt="QR" src="${qrImage(qr)}"><p class="muted" id="qr-text">${esc(qr.bankName)} · ${esc(qr.accountNumber)} · ${esc(qr.accountName)}</p></article>
    </section>
    <section class="${state.configTab === 'telegram' ? '' : 'hidden'}" id="tg-panel">
      <form class="card" id="tg-form">
        <label class="field">Bot Token<input name="botToken" value="${esc(tg.botToken || '')}"></label>
        <label class="field">Chat ID<input name="chatId" value="${esc(tg.chatId || '')}"></label>
        <p class="muted">Để trống cả hai nếu chưa dùng Telegram. Có người bấm đăng ký sẽ gửi tin vào chat này.</p>
        <button class="primary" type="submit">Lưu Telegram</button>
        <div class="msg" id="tg-msg"></div>
      </form>
    </section>`;
}

function render() {
  if (!state.token) {
    root.innerHTML = loginView();
    root.querySelector('#login-form').onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      try {
        const result = await api('/auth/admin/login', { method: 'POST', body: JSON.stringify(data) });
        state.token = result.token;
        state.loginError = '';
        localStorage.setItem('dc_admin_token', result.token);
        await loadTab();
      } catch (error) {
        state.loginError = error.message;
        render();
      }
    };
    return;
  }
  const views = { dashboard: dashboardView, members: membersView, rides: ridesView, settings: settingsView };
  root.innerHTML = `<div class="shell">${side()}<main class="main">${(views[state.tab] || dashboardView)()}</main></div>`;
  bind();
}

function bind() {
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.onclick = async () => {
      state.tab = button.dataset.tab;
      state.editing = null;
      await loadTab();
    };
  });
  root.querySelector('#logout').onclick = () => {
    state.token = '';
    localStorage.removeItem('dc_admin_token');
    render();
  };
  if (state.tab === 'members') bindMembers();
  if (state.tab === 'rides') bindRides();
  if (state.tab === 'settings') bindSettings();
}

async function exportMembers() {
  const response = await fetch(`${API}/api/admin/users/export`, {
    headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
  });
  if (response.status === 401) {
    state.token = '';
    localStorage.removeItem('dc_admin_token');
    render();
    return;
  }
  if (!response.ok) {
    alert('Không xuất được danh sách thành viên');
    return;
  }
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'thanh-vien.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindMembers() {
  root.querySelector('#user-status').value = state.userStatus;
  root.querySelector('#user-search').onclick = async () => {
    state.userStatus = root.querySelector('#user-status').value;
    state.userQuery = root.querySelector('#user-query').value.trim();
    state.userPage = 1;
    await loadUsers();
    render();
  };
  root.querySelector('#user-export').onclick = () => exportMembers();
  root.querySelector('#prev-page').onclick = async () => { state.userPage -= 1; await loadUsers(); render(); };
  root.querySelector('#next-page').onclick = async () => { state.userPage += 1; await loadUsers(); render(); };
  root.querySelectorAll('[data-approve]').forEach((button) => {
    button.onclick = async () => {
      await api(`/admin/users/${button.dataset.approve}/approve`, { method: 'PUT' });
      await loadUsers();
      render();
    };
  });
  root.querySelectorAll('[data-delete-user]').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('Xóa thành viên này?')) return;
      await api(`/admin/users/${button.dataset.deleteUser}`, { method: 'DELETE' });
      await loadUsers();
      render();
    };
  });
}

function bindRides() {
  root.querySelectorAll('[data-ride-region]').forEach((button) => {
    button.onclick = async () => {
      state.rideRegion = button.dataset.rideRegion;
      state.ridePage = 1;
      await loadRides();
      render();
    };
  });
  const rideFormEl = root.querySelector('#ride-form');
  const refreshMap = () => {
    const start = rideFormEl.startPoint.value.trim();
    const end = rideFormEl.pickupPoint.value.trim();
    const frame = root.querySelector('#gmap-frame');
    const link = root.querySelector('#gmap-link');
    const box = root.querySelector('#gmap');
    if (!start || !end) {
      box.classList.add('is-empty');
      return;
    }
    const embed = mapEmbed(start, end);
    if (frame.dataset.src !== embed) {
      frame.src = embed;
      frame.dataset.src = embed;
    }
    box.classList.remove('is-empty');
    link.href = mapLink(start, end);
  };
  rideFormEl.startPoint.addEventListener('input', refreshMap);
  rideFormEl.pickupPoint.addEventListener('input', refreshMap);
  refreshMap();
  root.querySelector('#ride-prev').onclick = () => { state.ridePage -= 1; render(); };
  root.querySelector('#ride-next').onclick = () => { state.ridePage += 1; render(); };
  rideFormEl.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const payload = Object.fromEntries(data.entries());
    payload.hot = data.get('hot') === 'on';
    payload.price = Number(payload.price);
    const msg = root.querySelector('#ride-msg');
    try {
      if (state.editing) {
        await api(`/admin/rides/${state.editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        state.editing = null;
      } else {
        await api('/admin/rides', { method: 'POST', body: JSON.stringify(payload) });
        state.ridePage = 1;
      }
      await loadRides();
      render();
    } catch (error) {
      msg.textContent = error.message;
    }
  };
  root.querySelector('#cancel-edit')?.addEventListener('click', () => { state.editing = null; render(); });
  root.querySelectorAll('[data-edit]').forEach((button) => {
    button.onclick = () => {
      state.editing = state.rides.find((ride) => ride.id === button.dataset.edit) || null;
      render();
    };
  });
  root.querySelectorAll('[data-delete-ride]').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('Xóa cuốc xe này?')) return;
      await api(`/admin/rides/${button.dataset.deleteRide}`, { method: 'DELETE' });
      await loadRides();
      render();
    };
  });
}

function bindSettings() {
  root.querySelectorAll('[data-config]').forEach((button) => {
    button.onclick = () => { state.configTab = button.dataset.config; render(); };
  });
  const qrForm = root.querySelector('#qr-form');
  const preview = () => {
    const cfg = Object.fromEntries(new FormData(qrForm).entries());
    root.querySelector('#qr-preview').src = qrImage(cfg);
    root.querySelector('#qr-text').textContent = `${cfg.bankName} · ${cfg.accountNumber} · ${cfg.accountName}`;
  };
  qrForm.querySelectorAll('input').forEach((input) => input.addEventListener('input', preview));
  qrForm.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/admin/settings/qr', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(qrForm).entries())) });
      state.settings.qrConfig = result.qrConfig;
      root.querySelector('#qr-msg').textContent = result.message;
      root.querySelector('#qr-msg').style.color = '#087a38';
    } catch (error) {
      root.querySelector('#qr-msg').textContent = error.message;
    }
  };
  const tgForm = root.querySelector('#tg-form');
  tgForm.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/admin/settings/telegram', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(tgForm).entries())) });
      state.settings.telegramConfig = result.telegramConfig;
      root.querySelector('#tg-msg').textContent = result.message;
      root.querySelector('#tg-msg').style.color = '#087a38';
    } catch (error) {
      root.querySelector('#tg-msg').textContent = error.message;
    }
  };
}

async function loadUsers() {
  const query = new URLSearchParams({ status: state.userStatus, q: state.userQuery, page: String(state.userPage), limit: '8' });
  const data = await api(`/admin/users?${query}`);
  state.users = data.users;
  state.userPage = data.page;
  state.userPages = data.pages;
  state.userTotal = data.total;
}
async function loadRides() {
  const data = await api(`/admin/rides?region=${state.rideRegion}`);
  state.rides = data.rides;
}
async function loadTab() {
  if (state.tab === 'dashboard') state.dash = await api('/admin/dashboard');
  if (state.tab === 'members') await loadUsers();
  if (state.tab === 'rides') await loadRides();
  if (state.tab === 'settings') state.settings = await api('/admin/settings');
  render();
}

if (state.token) loadTab().catch(() => render());
else render();
