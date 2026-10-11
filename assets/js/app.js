const API = window.APP_CONFIG.API_BASE;
const icon = (name, weight = 'bold') => `<i class="ph-${weight} ph-${name}" aria-hidden="true"></i>`;
const REGIONS = [
  { id: 'north', label: 'Miền Bắc', icon: 'mountains' },
  { id: 'central', label: 'Miền Trung', icon: 'waves' },
  { id: 'south', label: 'Miền Nam', icon: 'tree-palm' },
];

const views = ['home', 'rides', 'post', 'messages', 'profile', 'income', 'guide', 'wallet', 'bookings', 'myrides'];
const PROVINCES = {
  north: ['Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Bắc Ninh', 'Hải Dương', 'Hưng Yên', 'Hà Nam', 'Nam Định', 'Thái Bình', 'Ninh Bình', 'Vĩnh Phúc', 'Bắc Giang', 'Phú Thọ', 'Thái Nguyên', 'Lạng Sơn', 'Cao Bằng', 'Bắc Kạn', 'Tuyên Quang', 'Hà Giang', 'Lào Cai', 'Yên Bái', 'Điện Biên', 'Lai Châu', 'Sơn La', 'Hòa Bình'],
  central: ['Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng'],
  south: ['TP. Hồ Chí Minh', 'Bình Dương', 'Bình Phước', 'Đồng Nai', 'Tây Ninh', 'Bà Rịa - Vũng Tàu', 'Long An', 'Tiền Giang', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Cần Thơ', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'],
};
const state = {
  view: views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home',
  region: 'north',
  rides: [],
  memberRides: [],
  myRides: [],
  user: JSON.parse(localStorage.getItem('dc_user') || 'null'),
  token: localStorage.getItem('dc_token') || '',
  qr: { bankName: '', accountNumber: '', accountName: '', amount: 0, transferNote: '' },
  drawer: false,
  prev: 'profile',
  loadingRides: true,
  loadingMembers: true,
  pendingRegister: null,
};

const app = document.querySelector('#app');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const digits = (value) => String(value || '').replace(/\D+/g, '');
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const maskPhone = (phone) => {
  const value = digits(phone);
  if (value.length < 7) return value;
  return `${value.slice(0, 3)} xxxx ${value.slice(-3)}`;
};
const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
const regionLabel = (id) => REGIONS.find((item) => item.id === id)?.label || 'Miền Bắc';
const incomeMonth = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', month: 'numeric', year: 'numeric',
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `Tháng ${pick('month')}/${pick('year')}`;
};
const formatToday = () => {
  const day = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
};
const hidePhone = (phone) => {
  const raw = String(phone || '');
  if (raw.includes('*')) return raw;
  const value = digits(raw);
  if (value.length <= 5) return `${value.slice(0, 2)}${'*'.repeat(Math.max(value.length - 2, 0))}`;
  return `${value.slice(0, 5)}${'*'.repeat(value.length - 5)}`;
};
const shownPhone = (ride) => (state.user ? String(ride.phone || '') : hidePhone(ride.phone));
const provinceOptions = () => {
  const groups = [['Miền Bắc', PROVINCES.north], ['Miền Trung', PROVINCES.central], ['Miền Nam', PROVINCES.south]];
  return `<option value="">Chọn tỉnh/thành</option>${groups.map(([label, items]) => `<optgroup label="${label}">${items.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</optgroup>`).join('')}`;
};
const mapsEmbed = (start, end) => `https://maps.google.com/maps?saddr=${encodeURIComponent(`${start}, Việt Nam`)}&daddr=${encodeURIComponent(`${end}, Việt Nam`)}&output=embed`;
const mapsLink = (start, end) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}`;
const qrImage = (cfg) => {
  const query = new URLSearchParams({
    amount: String(Number(cfg.amount) || 0),
    addInfo: cfg.transferNote || '',
    accountName: cfg.accountName || '',
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(cfg.bankName || '')}-${encodeURIComponent(cfg.accountNumber || '')}-compact2.png?${query}`;
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}/api${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(12000),
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('Máy chủ phản hồi quá chậm');
    }
    throw new Error('Không kết nối được máy chủ');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không kết nối được máy chủ');
  return data;
}

let toastTimer = 0;
function toast(message, error = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = error ? 'toast err' : 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

function ridesOfRegion() {
  return state.rides.filter((ride) => ride.region === state.region);
}

function rideCard(ride) {
  return `<article class="ride${ride.status === 'taken' ? ' taken' : ''}">
    <div class="ride-top"><span class="ride-time">${icon('calendar-blank')} ${esc(formatToday())}</span>${ride.hot ? `<span class="hot">${icon('lightning')} Cuốc hot</span>` : ''}</div>
    <div class="ride-main">
      <div>
        <div class="ride-driver"><span class="driver-ico">${icon('steering-wheel', 'fill')}</span>${esc(ride.driverName)}</div>
        <div class="ride-path">
          <div class="stop"><span class="stop-ico end">${icon('map-pin', 'fill')}</span><span class="stop-text"><small>Điểm đón</small><b>${esc(ride.pickupPoint)}</b></span></div>
          <div class="stop"><span class="stop-ico go">${icon('flag', 'fill')}</span><span class="stop-text"><small>Điểm đi</small><b>${esc(ride.startPoint)}</b></span></div>
        </div>
      </div>
      <div class="ride-price"><strong>${money(ride.price)}</strong><span>Giá chuyến</span></div>
    </div>
    ${ride.note ? `<div class="note"><strong>Ghi chú:</strong> ${esc(ride.note)}</div>` : ''}
    <a class="map" target="_blank" rel="noopener" href="${mapsLink(ride.startPoint, ride.pickupPoint)}">
      <iframe title="Bản đồ ${esc(ride.startPoint)} đến ${esc(ride.pickupPoint)}" loading="lazy" src="${mapsEmbed(ride.startPoint, ride.pickupPoint)}"></iframe>
      <span>${icon('map-trifold')} Google Maps</span>
    </a>
    <button class="accept${ride.status === 'taken' ? ' taken' : ''}" data-action="accept" data-id="${esc(ride.id)}">Nhận chuyến ngay ${icon('caret-right')}</button>
  </article>`;
}

function pills() {
  return `<div class="pills">${REGIONS.map((item) => `<button class="pill${state.region === item.id ? ' active' : ''}" data-action="region" data-region="${item.id}">${icon(item.icon, state.region === item.id ? 'fill' : 'bold')} ${item.label}</button>`).join('')}</div>`;
}

function header() {
  const home = state.view === 'home';
  return `<header class="top${home ? ' top-home' : ''}">
    <div style="display:flex;align-items:center;gap:8px">
      <button class="icon-btn" data-action="menu" aria-label="Menu">${icon('list')}</button>
      <div><div class="brand-title">DRIVER <span>APP</span></div><div class="brand-sub">KẾT NỐI TÀI XẾ - CUỐC XE MỖI NGÀY</div></div>
    </div>
    <button class="icon-btn" data-action="go" data-view="messages" aria-label="Thông báo">${icon('bell')}</button>
  </header>`;
}

function homeView() {
  const list = ridesOfRegion();
  const shown = list.slice(0, 3);
  const profile = state.user ? `<div class="profile-card">
      <div class="avatar">${esc(initials(state.user.name))}</div>
      <div class="profile-main"><div class="hello">Xin chào,</div><div class="profile-name">${esc(state.user.name)}</div><div class="profile-phone">${icon('phone')} ${esc(maskPhone(state.user.phone))} ${icon('check-circle', 'fill')}</div></div>
      <div class="badge">${icon('shield-check', 'fill')}<span>Tài xế đã xác thực</span></div>
    </div>` : `<div class="profile-card guest">
      <div class="avatar">TX</div>
      <div><div class="hello">Tài xế đối tác</div><div class="profile-name">Đăng nhập tài xế</div></div>
      <div class="auth-actions">
        <button class="mini-btn green" data-action="register">Đăng ký</button>
        <button class="mini-btn blue" data-action="login">Đăng nhập</button>
      </div>
    </div>`;
  return `${header()}<main>
    <div class="hero"></div>
    ${profile}
    <section class="stats">
      <button class="stat income" data-action="go" data-view="income"><span class="stat-label">${icon('wallet', 'fill')} Thu nhập tháng</span><b>0đ</b></button>
      <button class="stat rides" data-action="go" data-view="rides"><span class="stat-label">${icon('car', 'fill')} Cuốc đã nhận</span><b>0</b></button>
      <article class="stat rate"><span class="stat-label">${icon('star', 'fill')} Đánh giá</span><b>5.0</b></article>
    </section>
    <section class="actions">
      <button class="action a" data-action="go" data-view="rides">${icon('magnifying-glass', 'fill')}<strong>Tìm cuốc xe</strong><small>Có cuốc mới</small></button>
      <button class="action b" data-action="go" data-view="rides">${icon('users-three', 'fill')}<strong>Xe ghép</strong><small>Chuyến tiện đường</small></button>
      <button class="action c" data-action="go" data-view="rides">${icon('suitcase', 'fill')}<strong>Bao xe</strong><small>Đi tỉnh, đi xa</small></button>
      <button class="action d" data-action="go" data-view="post">${icon('map-trifold', 'fill')}<strong>Đăng chuyến</strong><small>Tạo cuốc xe</small></button>
    </section>
    <section class="download">
      <div class="dl-mark">DC</div>
      <div class="dl-copy"><strong>Tải ứng dụng di động</strong><p>Cài app để nhận thông báo <b>cuốc nổ tức thì</b> để không bỏ lỡ kèo thơm nào!</p></div>
      <button data-action="download">${icon('download-simple')} Tải ngay ${icon('caret-right')}</button>
    </section>
    ${pills()}
    <div class="section-head"><h2>${icon('bell')} Bạn có cuốc xe có thể nhận</h2><button class="linkish" data-action="go" data-view="rides">Xem tất cả ${icon('caret-right')}</button></div>
    <div class="list compact">${state.loadingRides ? '<div class="empty">Đang tải cuốc xe...</div>' : (shown.length ? shown.map(rideCard).join('') : `<div class="empty">Chưa có cuốc ở ${regionLabel(state.region)}. Bạn thêm cuốc trong trang quản trị.</div>`)}</div>
    ${bookingHead(false)}
    <div class="list">${state.loadingMembers ? '<div class="empty">Đang tải cuốc khách đặt...</div>' : (memberOfRegion().length ? memberOfRegion().slice(0, 3).map((ride) => bookingCard(ride)).join('') : `<div class="empty">Chưa có cuốc khách đặt ở ${regionLabel(state.region)}.</div>`)}</div>
  </main>`;
}

function ridesView() {
  const list = ridesOfRegion();
  const posted = memberOfRegion();
  return `${header()}<main class="page">
    <div class="panel"><h2>Cuốc xe ${regionLabel(state.region)}</h2><p class="muted">Danh sách do ban quản trị đăng. Cuốc mới nhất hiện trước.</p></div>
    <div style="height:12px"></div>
    ${pills()}
    <div class="list">${state.loadingRides ? '<div class="empty">Đang tải cuốc xe...</div>' : (list.length ? list.map(rideCard).join('') : `<div class="empty">Chưa có cuốc ở ${regionLabel(state.region)}.</div>`)}</div>
    ${bookingHead(true)}
    <div class="list">${state.loadingMembers ? '<div class="empty">Đang tải cuốc khách đặt...</div>' : (posted.length ? posted.map((ride) => bookingCard(ride)).join('') : `<div class="empty">Chưa có cuốc khách đặt ở ${regionLabel(state.region)}.</div>`)}</div>
  </main>`;
}

function memberOfRegion() {
  return state.memberRides.filter((ride) => ride.region === state.region);
}

function bookingHead(onPage) {
  const region = REGIONS.find((item) => item.id === state.region) || REGIONS[0];
  return `<div class="section-head booking-head">
    <h2 class="booking-title">${icon('car', 'fill')}<span>Cuốc xe khách đặt <em class="region-chip">(${icon(region.icon)} ${region.label})</em></span></h2>
    ${onPage ? '' : `<button class="linkish" data-action="go" data-view="bookings">Xem tất cả ${icon('caret-right')}</button>`}
  </div>`;
}

function bookingCard(ride, mine = false) {
  const phone = mine ? String(ride.phone || '') : shownPhone(ride);
  const hidden = !mine && (!state.user || phone.includes('*'));
  const fresh = Date.now() - new Date(ride.createdAt).getTime() < 24 * 60 * 60 * 1000;
  return `<article class="booking">
    <div class="booking-top">
      <div class="booking-who">${fresh ? `<span class="fresh">${icon('lightning', 'fill')} Mới</span>` : ''}<b>${esc(ride.driverName)}</b></div>
      <span class="ago">${icon('clock')} ${mine ? `${esc(regionLabel(ride.region))} · ` : ''}Vừa xong</span>
    </div>
    <div class="booking-phone"><span>${icon('phone', 'fill')} ${esc(phone)}</span><button type="button" data-action="copy-phone" data-phone="${esc(phone)}" data-hidden="${hidden ? '1' : '0'}" aria-label="Sao chép số điện thoại">${icon('copy')}</button></div>
    <div class="booking-route">
      <div class="track">
        <div class="leg"><span class="dot go"></span><span><b>${esc(ride.startPoint)}</b><small>Điểm đi</small></span></div>
        <div class="leg"><span class="dot end"></span><span><b>${esc(ride.endPoint)}</b><small>Điểm đến</small></span></div>
      </div>
      <div class="fare"><small>${icon('money', 'fill')} Giá chuyến</small><strong>${money(ride.price)}</strong></div>
    </div>
    ${ride.note ? `<div class="booking-note">${icon('note')}<span>Ghi chú: ${esc(ride.note)}</span></div>` : ''}
    ${mine
      ? `<button class="drop" type="button" data-action="ask-delete" data-id="${esc(ride.id)}">${icon('trash')} Xóa cuốc</button>`
      : `<button class="call-now" type="button" data-action="call-member" data-id="${esc(ride.id)}" data-phone="${esc(phone)}" data-hidden="${hidden ? '1' : '0'}">${icon('phone', 'fill')} Gọi tài xế ngay ${icon('caret-right')}</button>`}
  </article>`;
}

function memberTabs() {
  const tab = (view, label) => `<button class="${state.view === view ? 'on' : ''}" type="button" data-action="go" data-view="${view}">${label}</button>`;
  return `<div class="member-tabs">${tab('post', 'Đăng chuyến')}${tab('myrides', 'Cuốc xe của tôi')}</div>`;
}

function postView() {
  if (!state.user) {
    return `${header()}<main class="page">${memberTabs()}<section class="panel">
      <div class="mail">${icon('plus')}</div>
      <h2>Đăng ký chở cuốc xe</h2>
      <p class="muted">Đăng nhập tài khoản đã được duyệt để tự đăng cuốc. Bạn đăng bao nhiêu lần cũng được.</p>
      <button class="primary" data-action="login">Đăng nhập</button>
    </section></main>`;
  }
  return `${header()}<main class="page">${memberTabs()}<section class="trip-card">
    <div class="trip-head"><h2>Đăng ký chở cuốc xe</h2></div>
    <form class="trip-body" id="trip-form">
      <label class="field">Họ và tên<input name="name" value="${esc(state.user.name)}" readonly></label>
      <label class="field">Số điện thoại (SĐT tài khoản đăng ký)<input name="phone" value="${esc(state.user.phone)}" readonly></label>
      <p class="verified">${icon('check-circle', 'fill')} Số điện thoại chính thức đã đăng ký</p>
      <label class="field">Miền đăng ký<select name="region">${REGIONS.map((item) => `<option value="${item.id}"${item.id === state.region ? ' selected' : ''}>${item.label}</option>`).join('')}</select></label>
      <div class="field-row">
        <label class="field">Điểm xuất phát<select name="startPoint" required>${provinceOptions()}</select></label>
        <label class="field">Điểm đến<select name="endPoint" required>${provinceOptions()}</select></label>
      </div>
      <label class="field">Giá dự kiến (VND)<input name="price" inputmode="numeric" placeholder="VD: 800000" required></label>
      <label class="field">Ghi chú<textarea name="note" rows="3" placeholder="Giờ giấc, loại xe..."></textarea></label>
      <button class="primary" type="submit">Đăng cuốc xe</button>
      <p class="trip-hint">Không giới hạn số lần đăng.</p>
    </form>
  </section></main>`;
}

function bookingsView() {
  const list = memberOfRegion();
  return `${header()}<main class="page bookings-page">
    ${bookingHead(true)}
    ${pills()}
    <div class="list">${state.loadingMembers ? '<div class="empty">Đang tải cuốc khách đặt...</div>' : (list.length ? list.map((ride) => bookingCard(ride)).join('') : `<div class="empty">Chưa có cuốc khách đặt ở ${regionLabel(state.region)}.</div>`)}</div>
  </main>`;
}

function myridesView() {
  if (!state.user) {
    return `${header()}<main class="page">${memberTabs()}<section class="panel">
      <h2>Cuốc xe của tôi</h2>
      <p class="muted">Đăng nhập để xem và xóa các cuốc bạn đã đăng.</p>
      <button class="primary" data-action="login">Đăng nhập</button>
    </section></main>`;
  }
  return `${header()}<main class="page">${memberTabs()}
    <section class="panel mine-intro"><h2>Cuốc xe của tôi</h2><p class="muted">Danh sách cuốc bạn đã đăng. Có thể xóa bất cứ lúc nào, không giới hạn số lần đăng.</p></section>
    <div class="list mine">${state.myRides.length ? state.myRides.map((ride) => bookingCard(ride, true)).join('') : '<div class="empty">Bạn chưa đăng cuốc nào.</div>'}</div>
  </main>`;
}

function messagesView() {
  return `${header()}<main class="page"><section class="panel">
    <h2>${icon('chat-circle')} Hộp thư tin nhắn (0)</h2>
    <div class="mail">${icon('mailbox')}</div>
    <p class="muted" style="text-align:center">Chưa có tin nhắn hoặc yêu cầu trực tiếp nào.</p>
  </section></main>`;
}

function profileView() {
  if (!state.user) {
    return `${header()}<main class="page"><section class="panel">
      <div class="avatar" style="margin-bottom:10px">TX</div>
      <h2>Tài khoản tài xế</h2>
      <p class="muted">Đăng nhập để xem số điện thoại cuốc xe, hồ sơ và thông báo nhóm.</p>
      <div class="row-actions"><button class="primary" data-action="login">Đăng nhập</button><button class="ghost" data-action="register">Đăng ký</button></div>
    </section></main>`;
  }
  return `${header()}<main class="page"><section class="panel">
    <div style="display:flex;gap:12px;align-items:center">
      <div class="avatar">${esc(initials(state.user.name))}</div>
      <div><div class="profile-name">${esc(state.user.name)}</div><div class="profile-phone">${esc(maskPhone(state.user.phone))}</div><div class="hello">${icon('shield-check', 'fill')} Tài xế đã duyệt</div></div>
    </div>
    <div class="menu-list">
      <button class="menu-row" data-action="go" data-view="wallet">${icon('wallet')} Rút tiền <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="income">${icon('chart-line')} Thu nhập tài xế <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="myrides">${icon('car')} Cuốc xe của tôi <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="guide">${icon('device-mobile')} Hướng dẫn tải app <span>${icon('caret-right')}</span></button>
      <button class="menu-row danger" data-action="logout">${icon('sign-out')} Đăng xuất tài khoản <span>${icon('caret-right')}</span></button>
    </div>
  </section></main>`;
}

function backBar(title) {
  return `<div class="backbar"><button class="icon-btn" data-action="back" aria-label="Quay lại">${icon('arrow-left')}</button><h2>${title}</h2></div>`;
}

function walletView() {
  if (!state.user) {
    return `${header()}<main class="page">${backBar('Rút tiền')}<section class="panel">
      <h2>Số dư tài xế</h2>
      <p class="muted">Đăng nhập tài khoản đã được duyệt để xem số dư ký quỹ và rút tiền.</p>
      <button class="primary" data-action="login">Đăng nhập</button>
    </section></main>`;
  }
  const balance = Number(state.user.balance || 0);
  const on = state.user.acceptingRides !== false;
  return `${header()}<main class="page wallet-page">${backBar('Rút tiền')}
    <section class="balance-card">
      <p>Số dư hiện tại</p>
      <small>Số ký quỹ trừ đi các cuốc xe đã hoàn thành</small>
      <strong>${balance.toLocaleString('vi-VN')} <span>đ</span></strong>
    </section>
    <button class="wallet-row" type="button" data-action="withdraw">${icon('hand-coins')} Rút tiền <span>${icon('caret-right')}</span></button>
    <button class="wallet-row income" type="button" data-action="go" data-view="income">${icon('chart-line')} Thu nhập tài xế <span>${icon('caret-right')}</span></button>
    <section class="ride-stats">
      <h3>Thống kê cuốc xe</h3>
      <div>
        <article><span class="ride-ico">${icon('moped', 'fill')}</span><small>Cuốc xe hoàn thành/tháng</small><b>0</b></article>
        <article><span class="ride-ico ok">${icon('check-circle', 'fill')}</span><small>Tổng cuốc xe hoàn thành</small><b>0</b></article>
      </div>
    </section>
    <button class="service-row" type="button" data-action="toggle-service" aria-pressed="${on ? 'true' : 'false'}">
      <span>Bật/Tắt nhận dịch vụ cuốc xe</span>
      <span class="switch${on ? ' on' : ''}"></span>
    </button>
    ${state.user.withdrawRequestedAt ? '<p class="muted">Đã gửi yêu cầu rút tiền. Admin hoàn tiền trong vòng 30 phút.</p>' : ''}
  </main>`;
}

function incomeView() {
  const trips = 0;
  const tips = 0;
  const total = trips + tips;
  const vnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
  return `${header()}<main class="page income-page">${backBar('Thu nhập tài xế')}
    <section class="earn-hero">
      <div>
        <p>Tổng thu nhập ${incomeMonth()}</p>
        <small>(Tính đến hôm nay)</small>
        <strong>${vnd(total)}</strong>
        <em>*Đây là tổng số tiền bạn đã nhận.</em>
      </div>
      <span class="earn-badge">${icon('money', 'fill')}</span>
    </section>
    <section class="earn-card">
      <h3>Chi tiết thu nhập</h3>
      <table>
        <thead><tr><th>Nguồn thu</th><th>Số tiền</th></tr></thead>
        <tbody>
          <tr><td>Cuốc xe hoàn thành</td><td>${vnd(trips)}</td></tr>
          <tr><td>Tips khách hàng</td><td>${vnd(tips)}</td></tr>
        </tbody>
      </table>
    </section>
    ${total ? '' : `<section class="earn-empty"><span class="earn-art">${icon('money', 'fill')}${icon('money', 'fill')}</span><strong>Chưa có thu nhập trong tháng này</strong><p>Hoàn thành cuốc xe để nhận thu nhập!</p></section>`}
  </main>`;
}

function guideView() {
  return `${header()}<main class="page">${backBar('Hướng dẫn tải app')}<section class="panel">
    <ol class="steps">
      <li>Mở trang này trên điện thoại.</li>
      <li>Bấm Tải ngay nếu ban quản trị đã gắn link APK.</li>
      <li>Cho phép cài đặt từ nguồn không xác định rồi mở app.</li>
    </ol>
    <button class="primary" data-action="download">Tải ứng dụng</button>
  </section></main>`;
}

function tabbar() {
  const item = (view, label, name) => `<button class="tab${state.view === view ? ' active' : ''}" data-action="go" data-view="${view}"><div>${icon(name, state.view === view ? 'fill' : 'bold')}</div>${label}</button>`;
  return `<nav class="tabbar">
    ${item('home', 'Trang chủ', 'house')}
    ${item('rides', 'Cuốc xe', 'car')}
    <button class="tab-center" data-action="go" data-view="post"><div class="fab">${icon('plus')}</div>Đăng chuyến</button>
    ${item('messages', 'Tin nhắn', 'chat-circle')}
    ${item('profile', 'Cá nhân', 'user')}
  </nav>`;
}

function drawer() {
  if (!state.drawer) return '';
  const body = state.user ? `
    <div class="drawer-head"><button class="drawer-close" data-action="close-menu" aria-label="Đóng">${icon('x')}</button><div class="avatar">${esc(initials(state.user.name))}</div><strong>${esc(state.user.name)}</strong><div>${esc(state.user.phone)}</div></div>
    <nav>
      <button class="menu-row" data-action="go" data-view="home">${icon('squares-four')} Dashboard tài xế <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="wallet">${icon('wallet')} Rút tiền <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="income">${icon('chart-line')} Thu nhập tài xế <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="myrides">${icon('car')} Cuốc xe của tôi <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="guide">${icon('device-mobile')} Hướng dẫn tải app <span>${icon('caret-right')}</span></button>
    </nav>
    <div class="grow"><button class="menu-row danger" data-action="logout">${icon('sign-out')} Đăng xuất</button></div>` : `
    <div class="drawer-head"><button class="drawer-close" data-action="close-menu" aria-label="Đóng">${icon('x')}</button><div class="avatar">TX</div><strong>Khách</strong><div>Đăng nhập để dùng đủ tính năng</div></div>
    <nav>
      <button class="menu-row" data-action="login">${icon('sign-in')} Đăng nhập <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="register">${icon('user-plus')} Đăng ký thành viên <span>${icon('caret-right')}</span></button>
      <button class="menu-row" data-action="go" data-view="guide">${icon('device-mobile')} Hướng dẫn tải app <span>${icon('caret-right')}</span></button>
    </nav>`;
  return `<div class="backdrop" data-action="close-menu"></div><aside class="drawer">${body}</aside>`;
}

function render() {
  const views = { home: homeView, rides: ridesView, post: postView, messages: messagesView, profile: profileView, income: incomeView, guide: guideView, wallet: walletView, bookings: bookingsView, myrides: myridesView };
  const view = views[state.view] || homeView;
  app.innerHTML = `${view()}${tabbar()}${drawer()}`;
}

function openModal(title, body) {
  document.querySelector('.modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<button class="modal-backdrop" type="button" data-close aria-label="Đóng"></button><div class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button></div>${body}</div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  return modal;
}

function field(label, name, type = 'text', placeholder = '') {
  return `<label class="field">${label}<input name="${name}" type="${type}" placeholder="${placeholder}" required></label>`;
}

function openLogin() {
  state.drawer = false;
  render();
  const modal = openModal('Đăng nhập', `<form id="login-form">${field('Số điện thoại', 'phone', 'tel', '09xxxxxxxx')}${field('Mật khẩu', 'password', 'password', 'Ít nhất 4 ký tự')}<button class="primary" type="submit">Đăng nhập</button></form>`);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => { state.afterLogin = ''; }));
  modal.querySelector('#login-form').onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ phone: digits(data.phone), password: data.password }) });
      state.user = result.user;
      state.token = result.token;
      localStorage.setItem('dc_user', JSON.stringify(result.user));
      localStorage.setItem('dc_token', result.token);
      const next = state.afterLogin;
      state.afterLogin = '';
      modal.remove();
      toast('Đăng nhập thành công');
      try { await loadMemberRides(); } catch { /* giữ danh sách cũ */ }
      render();
      if (next === 'plans') openPlans();
      else openWelcome();
    } catch (error) {
      toast(error.message, true);
    }
  };
}

function openRegister() {
  state.drawer = false;
  render();
  const modal = openModal('Đăng ký thành viên', `<form id="register-form">${field('Họ và tên', 'name', 'text', 'Nguyễn Văn A')}${field('Số điện thoại', 'phone', 'tel', '09xxxxxxxx')}${field('Loại xe', 'carType', 'text', 'Toyota Innova')}${field('Đời xe', 'carYear', 'text', '2022')}${field('Mật khẩu', 'password', 'password')}${field('Nhập lại mật khẩu', 'confirm', 'password')}<button class="primary" type="submit">Xác nhận</button></form>`);
  modal.querySelector('#register-form').onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (data.password !== data.confirm) return toast('Mật khẩu xác nhận không khớp', true);
    state.pendingRegister = {
      name: String(data.name).trim(),
      phone: digits(data.phone),
      carType: String(data.carType).trim(),
      carYear: String(data.carYear).trim(),
      password: data.password,
    };
    api('/notify/register-intent', { method: 'POST', body: JSON.stringify(state.pendingRegister) }).catch(() => {});
    modal.remove();
    openPayment();
  };
}

function openPayment() {
  const cfg = state.qr;
  const modal = openModal(`Phí vào nhóm ${money(cfg.amount)}`, `
    <div class="qr-box"><img alt="QR thanh toán" src="${qrImage(cfg)}"><p>${esc(cfg.bankName)} · ${esc(cfg.accountNumber)}<br>${esc(cfg.accountName)}<br>Nội dung: <strong>${esc(cfg.transferNote)}</strong></p></div>
    <div class="row-actions"><button class="primary" id="paid" type="button">Tôi đã chuyển khoản</button><button class="ghost" id="later" type="button">Để sau</button></div>`);
  modal.querySelector('#later').onclick = () => modal.remove();
  modal.querySelector('#paid').onclick = async () => {
    const button = modal.querySelector('#paid');
    button.disabled = true;
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify(state.pendingRegister) });
      state.pendingRegister = null;
      modal.remove();
      toast('Đăng ký thành công. Tài khoản đang chờ admin duyệt.');
    } catch (error) {
      button.disabled = false;
      toast(error.message, true);
    }
  };
}

function openTaken() {
  const modal = openBare(`<div class="taken">
    <span class="taken-ico">${icon('warning', 'fill')}</span>
    <h3>Rất tiếc!</h3>
    <p>Đã có tài xế nhận cuốc, vui lòng đợi cuốc tiếp theo</p>
    <button class="primary" type="button" data-close>Đóng</button>
  </div>`);
  modal.querySelector('.modal-card')?.classList.replace('sheet', 'dialog');
}

function openMemberCall(ride) {
  const phone = digits(ride.phone);
  openBare(`<div class="pay-head"><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button><h3>Gọi tài xế</h3></div>
    <div class="contact-body">
      <div class="contact-top">
        <div class="ride-driver"><span class="driver-ico">${icon('steering-wheel', 'fill')}</span><span>${esc(ride.driverName)}</span></div>
        <div class="ride-price"><strong>${money(ride.price)}</strong><span>Giá chuyến</span></div>
      </div>
      <div class="track">
        <div class="leg"><span class="dot go"></span><span><b>${esc(ride.startPoint)}</b><small>Điểm đi</small></span></div>
        <div class="leg"><span class="dot end"></span><span><b>${esc(ride.endPoint)}</b><small>Điểm đến</small></span></div>
      </div>
      <div class="contact-phone"><span class="driver-ico phone">${icon('phone', 'fill')}</span><span class="stop-text"><small>Số điện thoại</small><b>${esc(phone)}</b></span></div>
      <a class="call" href="tel:${esc(phone)}">${icon('phone')} Gọi ${esc(phone)}</a>
    </div>`);
}

function openContact(ride) {
  if (!state.user) {
    toast('Đăng nhập tài khoản đã duyệt để xem số điện thoại');
    openLogin();
    return;
  }
  openBare(`<div class="pay-head"><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button><h3>Liên hệ tài xế</h3></div>
    <div class="contact-body">
      <div class="contact-top">
        <div class="ride-driver"><span class="driver-ico">${icon('steering-wheel', 'fill')}</span><span>${esc(ride.driverName)}</span></div>
        <div class="ride-price"><strong>${money(ride.price)}</strong><span>Giá chuyến</span></div>
      </div>
      <div class="ride-path">
        <div class="stop"><span class="stop-ico end">${icon('map-pin', 'fill')}</span><span class="stop-text"><small>Điểm đón</small><b>${esc(ride.pickupPoint)}</b></span></div>
        <div class="stop"><span class="stop-ico go">${icon('flag', 'fill')}</span><span class="stop-text"><small>Điểm đi</small><b>${esc(ride.startPoint)}</b></span></div>
      </div>
      <div class="contact-phone"><span class="driver-ico phone">${icon('phone', 'fill')}</span><span class="stop-text"><small>Số điện thoại</small><b>${esc(ride.phone)}</b></span></div>
      <a class="call" href="tel:${esc(ride.phone)}">${icon('phone')} Gọi tài xế</a>
    </div>`);
}

const APP_PLANS = [
  { id: 'year', name: '1 năm', hint: 'Tiết kiệm nhất cho lâu dài', title: 'Gói 1 Năm', detail: 'Dùng 12 tháng', price: 400000, badge: 'Phổ biến', mark: 'star' },
  { id: 'life', name: 'Dùng vĩnh viễn', hint: 'Một lần – dùng mãi mãi', title: 'Gói Vĩnh Viễn', detail: 'Dùng trọn đời mãi mãi', price: 1000000, badge: 'Tốt nhất', mark: 'crown' },
];

function downloadApp() {
  if (!state.user) {
    state.afterLogin = 'plans';
    toast('Đăng nhập để tải ứng dụng');
    openLogin();
    return;
  }
  openPlans();
}

function openWelcome() {
  if (!state.user) return;
  const until = Number(localStorage.getItem('dc_welcome_until') || 0);
  if (until > Date.now()) return;
  const modal = openBare(`<div class="welcome-head"><div><h3>Chào mừng bạn!</h3><p>Xem quyền lợi thành viên của bạn</p></div><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button></div>
    <div class="welcome-body">
      <div class="welcome-grid">
        <article class="perk web">
          <div class="perk-top">
            <h4>${icon('browser')} Sử dụng trên web</h4>
            <p class="perk-fee"><span>Phí duy trì</span><b>200K / 1 lần</b><small>Cam kết không phát sinh</small></p>
          </div>
          <ul>
            <li><b>Quyền lợi</b><span>100% tính năng và dùng vĩnh viễn</span></li>
            <li><b>Thông báo</b><span>Web không hỗ trợ thông báo tức thì về đơn hàng hay sự kiện.</span></li>
            <li><b>Trải nghiệm</b><span>Ổn định trên trình duyệt</span></li>
          </ul>
        </article>
        <article class="perk recommended">
          <em>${icon('star', 'fill')} Khuyên nghị</em>
          <div class="perk-top">
            <h4>${icon('device-mobile')} Sử dụng qua app</h4>
            <p class="perk-fee"><span>Phí duy trì</span><b>400K / năm</b><small>hoặc <strong>1 triệu / trọn đời</strong></small></p>
          </div>
          <ul>
            <li><b>Quyền lợi</b><span>100% tính năng và hỗ trợ ưu tiên</span></li>
            <li><b>Thông báo</b><span>App có thông báo tức thì ngay khi có đơn hàng, kèo mới hoặc tin quan trọng.</span></li>
          </ul>
        </article>
      </div>
      <div class="welcome-note">
        <strong>${icon('lightbulb', 'fill')} Lời khuyên dành cho anh em</strong>
        <p><b>Web.</b> Sự lựa chọn cho người bắt đầu. Phù hợp nếu bạn chủ yếu dùng PC hoặc có thời gian kiểm tra web thường xuyên. Tuy nhiên, web sẽ không có hệ thống thông báo tức thì.</p>
        <p><b>App.</b> Dành cho chiến thần thực thụ. Với app, bạn sẽ luôn là người dẫn đầu. Thông báo tức thì giúp bạn nhận kèo mới và đơn hàng mới ngay lập tức.</p>
        <p><b>Gợi ý.</b> Nếu bạn nghiêm túc và muốn kiếm tiền nhanh nhất, hãy chọn gói App trọn đời.</p>
      </div>
    </div>
    <div class="welcome-actions">
      <button class="welcome-snooze" type="button" id="welcome-snooze">Không hiển thị lại trong 2 giờ</button>
      <button class="primary" type="button" id="welcome-guide">${icon('download-simple')} Hướng dẫn tải app</button>
    </div>`);
  modal.querySelector('#welcome-snooze').onclick = () => {
    localStorage.setItem('dc_welcome_until', String(Date.now() + 2 * 60 * 60 * 1000));
    modal.remove();
  };
  modal.querySelector('#welcome-guide').onclick = () => {
    modal.remove();
    state.prev = state.view;
    state.view = 'guide';
    history.replaceState(null, '', '#guide');
    render();
  };
}

function openBare(html) {
  document.querySelector('.modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<button class="modal-backdrop" type="button" data-close aria-label="Đóng"></button><div class="modal-card sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  return modal;
}

function openPlans() {
  const card = (plan, on) => `<button type="button" class="plan${on ? ' on' : ''}" data-plan="${plan.id}">
      <span class="radio"></span>
      <span class="plan-copy"><b>${plan.name}</b><small>${plan.hint}</small></span>
      <span class="plan-price"><em>${icon(plan.mark, 'fill')} ${plan.badge}</em><strong>${money(plan.price)}</strong></span>
    </button>`;
  const modal = openBare(`<div class="plan-head"><h3>Chọn gói duy trì App</h3><p>Để tiếp tục tải và sử dụng ứng dụng tài xế, vui lòng chọn gói phù hợp</p></div>
    <div class="plan-body">
      ${APP_PLANS.map((plan) => card(plan, plan.id === 'life')).join('')}
      <div class="plan-note">${icon('lightbulb', 'fill')}<span><b>Lưu ý:</b> Dù không sử dụng app nữa, bạn vẫn sẽ rút được tiền ký quỹ bất cứ lúc nào.</span></div>
      <div class="row-actions"><button class="ghost" type="button" data-close>Để sau</button><button class="primary" type="button" id="plan-next">Xác nhận thanh toán</button></div>
    </div>`);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  modal.querySelectorAll('[data-plan]').forEach((button) => {
    button.onclick = () => {
      modal.querySelectorAll('[data-plan]').forEach((item) => item.classList.toggle('on', item === button));
    };
  });
  modal.querySelector('#plan-next').onclick = () => {
    const picked = modal.querySelector('.plan.on')?.dataset.plan || 'life';
    modal.remove();
    openAppPay(picked);
  };
}

function openAppPay(planId) {
  let current = APP_PLANS.find((plan) => plan.id === planId) || APP_PLANS[1];
  const bank = state.qr || {};
  const ready = bank.bankName && bank.accountNumber;
  const hello = state.user.status === 'approved'
    ? `Xin chào <b>${esc(state.user.name)}</b>, tài khoản của bạn đã được duyệt!`
    : `Xin chào <b>${esc(state.user.name)}</b>!`;
  const modal = openBare(`<div class="pay-head"><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button><h3>Tải ứng dụng</h3></div>
    <p class="pay-hello">${hello}<br>Chọn gói và quét QR để thanh toán kích hoạt ứng dụng.</p>
    <div class="pay-picks">${APP_PLANS.map((plan) => `<button type="button" class="pick${plan.id === current.id ? ' on' : ''}" data-pay="${plan.id}"><em>${icon(plan.mark, 'fill')} ${plan.badge}</em><b>${plan.title}</b><strong>${money(plan.price)}</strong><small>${plan.detail}</small></button>`).join('')}</div>
    <div class="qr-box" id="pay-qr-box">${ready ? `<img id="pay-qr" alt="QR thanh toán" src="">` : '<p class="muted">Chưa cấu hình tài khoản nhận tiền trong trang quản trị.</p>'}</div>
    ${window.APP_CONFIG.APP_DOWNLOAD_URL ? `<button class="apk" type="button" id="apk">${icon('device-mobile', 'fill')} Android APK</button>` : ''}
    <div class="pay-sum"><span id="pay-caption"></span><b id="pay-amount"></b></div>
    <div class="plan-actions"><button class="primary" type="button" id="paid">Tôi đã chuyển khoản</button></div>
    <p class="pay-foot">${icon('shield-check', 'fill')} Không dùng app vẫn rút được tiền ký quỹ</p>`);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  const paint = () => {
    modal.querySelectorAll('[data-pay]').forEach((item) => item.classList.toggle('on', item.dataset.pay === current.id));
    modal.querySelector('#pay-caption').textContent = `Số tiền thanh toán (${current.name}):`;
    modal.querySelector('#pay-amount').textContent = money(current.price);
    const img = modal.querySelector('#pay-qr');
    if (img) {
      img.src = qrImage({
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
        amount: current.price,
        transferNote: '',
      });
    }
  };
  modal.querySelectorAll('[data-pay]').forEach((button) => {
    button.onclick = () => {
      current = APP_PLANS.find((plan) => plan.id === button.dataset.pay) || current;
      paint();
    };
  });
  const apk = modal.querySelector('#apk');
  if (apk) apk.onclick = () => window.open(window.APP_CONFIG.APP_DOWNLOAD_URL, '_blank', 'noopener');
  modal.querySelector('#paid').onclick = async () => {
    const button = modal.querySelector('#paid');
    if (button.disabled) return;
    button.disabled = true;
    button.innerHTML = '<span class="spin"></span> Đang xử lý';
    await new Promise((resolve) => setTimeout(resolve, 3000));
    modal.remove();
    openAppPoster();
  };
  paint();
}

function openWithdraw() {
  if (!state.user) return openLogin();
  const bank = state.qr || {};
  const ready = bank.bankName && bank.accountNumber;
  const amount = 200000;
  const note = 'Huy tai khoan';
  const src = ready ? qrImage({ ...bank, amount, transferNote: note }) : '';
  const modal = openBare(`<div class="pay-head withdraw-head"><h3>Rút tiền ký quỹ</h3><button class="icon-btn" type="button" data-close aria-label="Đóng">${icon('x')}</button></div>
    <p class="withdraw-copy">Để rút tiền ký quỹ và huỷ tài khoản, vui lòng chuyển khoản <b>200.000đ</b> theo QR bên dưới. Admin sẽ hoàn trả tổng cộng <b>400.000đ</b> cho bạn trong vòng 30 phút.</p>
    <div class="withdraw-qr">${ready ? `<img id="withdraw-qr" alt="QR rút tiền" src="${src}"><div class="withdraw-bank">${esc(bank.accountName || '')}<small>${esc(bank.accountNumber)}</small><small>Số tiền: ${amount.toLocaleString('vi-VN')} VND</small></div>` : '<p class="muted">Chưa cấu hình tài khoản nhận tiền trong trang quản trị.</p>'}</div>
    ${ready ? `<button class="qr-save" type="button" id="save-qr">${icon('download-simple')} Tải xuống QR</button>` : ''}
    <p class="withdraw-note">Nội dung chuyển khoản: <b>${esc(note)}</b></p>
    <div class="withdraw-actions"><button class="primary" type="button" id="withdraw-paid">Tôi đã chuyển 200k - Tiếp tục</button><button class="ghost" type="button" data-close>Để sau</button></div>`);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => modal.remove()));
  const save = modal.querySelector('#save-qr');
  if (save) {
    save.onclick = async () => {
      try {
        const blob = await (await fetch(src)).blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'qr-rut-tien.png';
        link.click();
        URL.revokeObjectURL(link.href);
      } catch {
        window.open(src, '_blank', 'noopener');
      }
    };
  }
  modal.querySelector('#withdraw-paid').onclick = async () => {
    try {
      const data = await api('/auth/me/withdraw', { method: 'POST', body: '{}' });
      state.user = data.user;
      localStorage.setItem('dc_user', JSON.stringify(data.user));
      modal.remove();
      toast(data.message || 'Đã ghi nhận. Admin hoàn tiền trong vòng 30 phút.');
      render();
    } catch (error) {
      toast(error.message, true);
    }
  };
}

async function toggleService() {
  if (!state.user) return openLogin();
  const next = state.user.acceptingRides === false;
  try {
    const data = await api('/auth/me/service', { method: 'PATCH', body: JSON.stringify({ accepting: next }) });
    state.user = data.user;
    localStorage.setItem('dc_user', JSON.stringify(data.user));
    render();
    toast(next ? 'Đã bật nhận cuốc xe' : 'Đã tắt nhận cuốc xe');
  } catch (error) {
    toast(error.message, true);
  }
}

async function loadMemberRides() {
  const jobs = [api('/member-rides')];
  if (state.token) jobs.push(api('/member-rides/mine').catch(() => ({ rides: [] })));
  const [data, mine] = await Promise.all(jobs);
  state.memberRides = data.rides || [];
  state.myRides = mine ? (mine.rides || []) : [];
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  toast('Đã sao chép số điện thoại');
}

async function logout() {
  state.user = null;
  state.token = '';
  state.drawer = false;
  state.view = 'home';
  localStorage.removeItem('dc_user');
  localStorage.removeItem('dc_token');
  try { await loadMemberRides(); } catch { state.memberRides = []; state.myRides = []; }
  toast('Đã đăng xuất');
  render();
}

function openNeedAccount() {
  const modal = openBare(`<div class="warn">
    <svg class="warn-sign" viewBox="0 0 64 56" aria-hidden="true"><path d="M32 4 62 54H2L32 4z" fill="#ffd400" stroke="#111" stroke-width="3" stroke-linejoin="round"/><rect x="29.5" y="20" width="5" height="16" rx="1.2" fill="#111"/><circle cx="32" cy="44" r="2.6" fill="#111"/></svg>
    <h3>Bạn cần đăng ký trước khi nhận cuốc</h3>
    <p>Vui lòng đăng ký hoặc đăng nhập để có thể nhận cuốc xe.</p>
    <button class="warn-ok" type="button" data-close>Đã hiểu</button>
  </div>`);
  modal.querySelector('.modal-card')?.classList.replace('sheet', 'dialog');
}

function openAppPoster() {
  const modal = openBare(`<button class="poster-close" type="button" data-close aria-label="Đóng">${icon('x')}</button><img src="assets/img/download-app.jpg" alt="Tải DRIVER APP">`);
  const card = modal.querySelector('.modal-card');
  card?.classList.remove('sheet');
  card?.classList.add('poster');
}

function askDeleteRide(ride) {
  const modal = openBare(`<div class="warn">
    <span class="taken-ico">${icon('trash', 'fill')}</span>
    <h3>Xóa cuốc xe này?</h3>
    <p>${esc(ride.startPoint)} → ${esc(ride.endPoint)}</p>
    <div class="row-actions"><button class="ghost" type="button" data-close>Hủy</button><button class="warn-ok" type="button" id="confirm-delete">Xóa</button></div>
  </div>`);
  modal.querySelector('.modal-card')?.classList.replace('sheet', 'dialog');
  modal.querySelector('#confirm-delete').onclick = async () => {
    const button = modal.querySelector('#confirm-delete');
    button.disabled = true;
    try {
      await api(`/member-rides/${ride.id}`, { method: 'DELETE' });
      state.myRides = state.myRides.filter((item) => item.id !== ride.id);
      state.memberRides = state.memberRides.filter((item) => item.id !== ride.id);
      modal.remove();
      toast('Đã xóa cuốc xe');
      render();
    } catch (error) {
      button.disabled = false;
      toast(error.message, true);
    }
  };
}

async function submitTrip(form) {
  if (!state.user) return openLogin();
  const data = Object.fromEntries(new FormData(form).entries());
  const price = Number(digits(data.price));
  if (!data.startPoint || !data.endPoint) return toast('Chọn điểm đi và điểm đến', true);
  if (data.startPoint === data.endPoint) return toast('Điểm đi và điểm đến phải khác nhau', true);
  if (!price) return toast('Nhập giá dự kiến', true);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api('/member-rides', {
      method: 'POST',
      body: JSON.stringify({
        region: data.region,
        startPoint: data.startPoint,
        endPoint: data.endPoint,
        price,
        note: data.note,
      }),
    });
    await loadMemberRides();
    toast('Đã đăng cuốc xe');
    state.prev = state.view;
    state.view = 'myrides';
    history.replaceState(null, '', '#myrides');
    render();
  } catch (error) {
    button.disabled = false;
    toast(error.message, true);
  }
}

document.addEventListener('submit', (event) => {
  if (event.target?.id !== 'trip-form') return;
  event.preventDefault();
  submitTrip(event.target);
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || !app.contains(target)) return;
  const action = target.dataset.action;
  if (action === 'menu') { state.drawer = true; render(); }
  if (action === 'close-menu') { state.drawer = false; render(); }
  if (action === 'go') {
    const next = target.dataset.view;
    if (next !== state.view) state.prev = state.view;
    state.view = next;
    state.drawer = false;
    history.replaceState(null, '', `#${state.view}`);
    render();
  }
  if (action === 'back') {
    state.view = state.prev || 'profile';
    state.drawer = false;
    history.replaceState(null, '', `#${state.view}`);
    render();
  }
  if (action === 'region') { state.region = target.dataset.region; render(); }
  if (action === 'login') openLogin();
  if (action === 'register') openRegister();
  if (action === 'download') downloadApp();
  if (action === 'logout') logout();
  if (action === 'withdraw') openWithdraw();
  if (action === 'toggle-service') toggleService();
  if (action === 'copy-phone') {
    if (target.dataset.hidden === '1') {
      toast('Đăng nhập để xem số đầy đủ', true);
      openLogin();
      return;
    }
    copyText(target.dataset.phone);
  }
  if (action === 'call-member') {
    if (target.dataset.hidden === '1' || !state.user) {
      openNeedAccount();
      return;
    }
    const ride = state.memberRides.find((item) => item.id === target.dataset.id);
    openMemberCall(ride || { phone: target.dataset.phone, driverName: '', startPoint: '', endPoint: '', price: 0 });
  }
  if (action === 'ask-delete') {
    const ride = state.myRides.find((item) => item.id === target.dataset.id);
    if (ride) askDeleteRide(ride);
  }
  if (action === 'accept') {
    if (!state.user) {
      openNeedAccount();
      return;
    }
    if (state.user.acceptingRides === false) {
      toast('Bạn đang tắt nhận dịch vụ cuốc xe', true);
      return;
    }
    const ride = state.rides.find((item) => item.id === target.dataset.id);
    if (!ride) return;
    if (ride.status === 'taken') {
      openTaken();
      return;
    }
    openContact(ride);
  }
});

async function boot() {
  render();
  const jobs = [
    api('/rides').then((data) => {
      state.rides = data.rides || [];
    }).catch((error) => {
      toast(error.message, true);
    }).finally(() => {
      state.loadingRides = false;
      render();
    }),
    loadMemberRides().catch(() => {
      state.memberRides = [];
      state.myRides = [];
    }).finally(() => {
      state.loadingMembers = false;
      render();
    }),
    api('/qr-config').then((data) => {
      state.qr = data.qrConfig || state.qr;
    }).catch(() => {}),
  ];
  if (state.token) {
    jobs.push(api('/auth/me').then((me) => {
      state.user = me.user;
      localStorage.setItem('dc_user', JSON.stringify(me.user));
      render();
    }).catch(() => {
      state.user = null;
      state.token = '';
      localStorage.removeItem('dc_user');
      localStorage.removeItem('dc_token');
      render();
    }));
  }
  await Promise.allSettled(jobs);
  openWelcome();
}

boot();
setInterval(() => {
  const shown = document.querySelector('.ride-time');
  if (!shown || shown.textContent.includes(formatToday())) return;
  render();
}, 30000);
