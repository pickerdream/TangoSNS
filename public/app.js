const API_BASE = '/api';

// XSS対策: HTMLエスケープ
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// XSS対策: avatar_url の javascript: プロトコル排除
function safeAvatarUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null;
  } catch { return null; }
}

// ホームタブ切り替え関数
window.switchHomeTab = (tab) => {
  const newHash = tab === 'latest' ? '#/' : '#/?following_only=true';
  const currentHash = window.location.hash || '#/';
  
  // ハッシュを設定
  window.location.hash = newHash;
  
  // ハッシュが変わらない場合は手動でイベントをトリガー
  if (currentHash === newHash) {
    window.dispatchEvent(new Event('hashchange'));
  }
};

// ルーター関数
const router = async () => {
  const hash = window.location.hash || '#/';
  const appDiv = document.getElementById('app');
  appDiv.innerHTML = ''; // クリア

  // 認証の確認
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // 未ログイン時のアクセス制限（特定のページを除く）
  if (!token &&
    hash !== '#/login' &&
    hash !== '#/register' &&
    hash !== '#/' &&
    hash !== '#/terms' &&
    hash !== '#/privacy' &&
    !hash.startsWith('#/?') &&
    !hash.startsWith('#/wordbook/') &&
    !hash.startsWith('#/user/')) {
    renderLanding(appDiv);
    return;
  }

  // 画面描画
  if (hash === '#/login') {
    renderLogin(appDiv);
  } else if (hash === '#/register') {
    renderRegister(appDiv);
  } else if (hash === '#/' || hash.startsWith('#/?')) {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderHomeFeed(layout.querySelector('.main'), token, user);
  } else if (hash === '#/bookmarks') {
    if (!user) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderBookmarkedFeed(layout.querySelector('.main'), token, user);
  } else if (hash.startsWith('#/wordbook/')) {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    const id = hash.split('/')[2];
    await renderWordbookDetail(layout.querySelector('.main'), id, token, user);
  } else if (hash === '#/profile') {
    if (!user) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderMyProfile(layout.querySelector('.main'), token, user);
  } else if (hash === '#/settings') {
    if (!user) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderSettings(layout.querySelector('.main'), token, user);
  } else if (hash === '#/history') {
    if (!user) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderHistory(layout.querySelector('.main'));
  } else if (hash.startsWith('#/user/')) {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    const username = hash.split('/')[2];
    await renderUserProfile(layout.querySelector('.main'), username, token);
  } else if (hash === '#/notifications') {
    if (!user) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderNotifications(layout.querySelector('.main'));
  } else if (hash.startsWith('#/admin')) {
    if (!user || !user.is_admin) {
      window.location.hash = '#/';
      return;
    }
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    const subRoute = hash.split('/')[2] || 'stats';
    await renderAdminDashboard(layout.querySelector('.main'), subRoute);
  } else if (hash === '#/terms') {
    renderTermsOfService(appDiv);
  } else if (hash === '#/privacy') {
    renderPrivacyPolicy(appDiv);
  }
};

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// === API クライアント ===
async function fetchAPI(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'リクエストに失敗しました');
  }
  return res.json();
}

// === テーマ適用 ===
function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme');
  }
}

// 初期ロード時にlocalStorageからテーマを適用
(function () {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user && user.theme) {
    applyTheme(user.theme);
  }
  // 未読通知バッジの更新（定期実行または初回）
  if (user) updateUnreadBadge();
})();

async function updateUnreadBadge() {
  try {
    const notifications = await fetchAPI('/notifications');
    const unreadCount = notifications.filter(n => !n.is_read).length;
    const badge = document.getElementById('unreadBadge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) { }
}

// === レイアウト (サイドバー含む) ===
function createLayout(user) {
  // ゲストユーザー用レイアウト
  if (!user) {
    const container = document.createElement('div');
    container.className = 'layout';
    container.innerHTML = `
      <div class="sidebar">
        <a href="#/" class="sidebar-logo">
          <span class="material-icons">menu_book</span>
          TangoSNS
        </a>
        <div class="nav-links">
          <a href="#/" class="nav-link"><span class="material-icons">home</span> ホーム</a>
        </div>
        <a href="#/login" class="btn-primary btn-wide sidebar-btn" style="background:var(--accent-color)">
          <span class="material-icons" style="vertical-align:middle;margin-right:8px">login</span>ログイン
        </a>
        <a href="#/register" class="btn-primary btn-wide sidebar-btn" style="background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary)">
          <span class="material-icons" style="vertical-align:middle;margin-right:8px">person_add</span>登録
        </a>
      </div>
      
      <div class="main"></div>

      <div class="right-sidebar">
        <input type="text" id="searchInput" class="search-box" placeholder="単語帳を検索..." onkeydown="handleSearch(event)">
        
        <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px;">
          <h3 style="margin-bottom: 12px">急上昇</h3>
          <div id="trendingWordsList" class="trending-words">
            <span style="color: var(--text-secondary); font-size: 14px;">読み込み中...</span>
          </div>
        </div>
        
        <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px;">
          <h3 style="margin-bottom: 12px">人気のタグ</h3>
          <div id="popularTagsList" class="popular-tags">
            <span style="color: var(--text-secondary); font-size: 14px;">読み込み中...</span>
          </div>
        </div>
        
        <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px; text-align: center; font-size: 12px; color: var(--text-secondary)">
          <a href="#/terms" style="color:var(--accent-color); text-decoration:none; margin-right:12px">利用規約</a>
          <a href="#/privacy" style="color:var(--accent-color); text-decoration:none">プライバシーポリシー</a>
        </div>
      </div>
    `;

    // 人気タグを非同期で取得
    loadPopularTags();
    loadTrendingWordbooks();


    renderGuestConsentPopup(container);

    return container;
  }

  // ログイン済みユーザー用レイアウト
  const container = document.createElement('div');
  container.className = 'layout';
  container.innerHTML = `
    <div class="sidebar">
      <a href="#/" class="sidebar-logo">
        <span class="material-icons">menu_book</span>
        TangoSNS
      </a>
      <div class="nav-links">
        <a href="#/" class="nav-link"><span class="material-icons">home</span> ホーム</a>
        <a href="#/history" class="nav-link"><span class="material-icons">history</span> 学習履歴</a>
        <a href="#/notifications" class="nav-link" id="navNotifications">
          <span class="material-icons">notifications</span> 通知
          <span class="badge-unread" id="unreadBadge" style="display:none"></span>
        </a>
        <a href="#/profile" class="nav-link"><span class="material-icons">person</span> プロフィール</a>
        <a href="#/bookmarks" class="nav-link"><span class="material-icons">bookmark</span> ブックマーク</a>
        <a href="#/settings" class="nav-link"><span class="material-icons">settings</span> 設定</a>
        ${user.is_admin ? '<a href="#/admin" class="nav-link" style="color: #f59e0b"><span class="material-icons">admin_panel_settings</span> 管理者</a>' : ''}
      </div>
      <button class="btn-primary btn-wide sidebar-btn" onclick="openCreateModal()">単語帳を作成</button>
      
      <div class="user-menu" onclick="window.location.hash='#/profile'">
        <div class="avatar">
          ${safeAvatarUrl(user.avatar_url) ? `<img src="${safeAvatarUrl(user.avatar_url)}" alt="">` : escapeHtml(user.username.charAt(0).toUpperCase())}
        </div>
        <div class="user-info">
          <div class="user-name">${escapeHtml(user.username)}</div>
          <div class="user-handle">@${escapeHtml(user.username)}</div>
        </div>
        <button onclick="event.stopPropagation(); logout()" title="ログアウト">
          <span class="material-icons">logout</span>
        </button>
      </div>
    </div>
    
    <div class="main"></div>

    <div class="right-sidebar">
      <input type="text" id="searchInput" class="search-box" placeholder="単語帳を検索..." onkeydown="handleSearch(event)">
      
      <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px;">
        <h3 style="margin-bottom: 12px">急上昇</h3>
        <div id="trendingWordsList" class="trending-words">
          <span style="color: var(--text-secondary); font-size: 14px;">読み込み中...</span>
        </div>
      </div>
      
      <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px;">
        <h3 style="margin-bottom: 12px">人気のタグ</h3>
        <div id="popularTagsList" class="popular-tags">
          <span style="color: var(--text-secondary); font-size: 14px;">読み込み中...</span>
        </div>
      </div>
      
      <div style="background: var(--bg-secondary); padding: 16px; border-radius: 16px; margin-top: 16px; text-align: center; font-size: 12px; color: var(--text-secondary)">
        <a href="#/terms" style="color:var(--accent-color); text-decoration:none; margin-right:12px">利用規約</a>
        <a href="#/privacy" style="color:var(--accent-color); text-decoration:none">プライバシーポリシー</a>
      </div>
    </div>
  `;

  // 人気タグを非同期で取得
  loadPopularTags();
  loadTrendingWordbooks();


  return container;
}

function renderGuestConsentPopup(container) {
  // すでにポップアップが表示されているか、あるいは以前に同意したか（今回は毎回表示でも良いが、親切にするならsessionStorageなど）
  // ユーザーの要望は「サービスを利用すると同意したとみなす旨のメッセージを表示」なので、常時表示または簡素な表示。
  const popup = document.createElement('div');
  popup.className = 'guest-consent-banner';
  popup.innerHTML = `
    <div class="guest-consent-content">
      サービスを利用することで、
      <a href="#/terms">利用規約</a>と
      <a href="#/privacy">プライバシーポリシー</a>に同意したものとみなされます。
    </div>
    <button onclick="this.parentElement.remove()" style="color:white; opacity:0.7">
      <span class="material-icons" style="font-size:18px">close</span>
    </button>
  `;
  container.appendChild(popup);
}

async function loadPopularTags() {
  try {
    const tags = await fetchAPI('/tags/popular');
    const container = document.getElementById('popularTagsList');
    if (!container) return;

    if (tags.length === 0) {
      container.innerHTML = '<span style="color: var(--text-secondary); font-size: 14px;">タグはまだありません</span>';
      return;
    }

    container.innerHTML = tags.map(t =>
      `<a href="#/?tag=${encodeURIComponent(t.name)}" class="tag-chip">#${t.name}</a>`
    ).join('');
  } catch (e) {
    const container = document.getElementById('popularTagsList');
    if (container) container.innerHTML = '';
  }
}

async function loadTrendingWordbooks() {
  try {
    const wordbooks = await fetchAPI('/trending/wordbooks');
    const container = document.getElementById('trendingWordsList');
    if (!container) return;

    if (wordbooks.length === 0) {
      container.innerHTML = '<span style="color: var(--text-secondary); font-size: 14px;">まだありません</span>';
      return;
    }

    container.innerHTML = wordbooks.map(wb =>
      `<div class="trending-word" onclick="window.location.hash='#/wordbook/${wb.id}'" style="padding: 8px 0; border-bottom: 1px solid var(--border-color); cursor: pointer;">
        <div style="font-weight: 600; font-size: 14px;">${escapeHtml(wb.title)}</div>
        <div style="color: var(--text-secondary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(wb.description || '説明はありません')}</div>
        <div style="color: var(--text-secondary); font-size: 11px;">学習 ${wb.study_count}回 · 閲覧 ${wb.view_count}回 · @${escapeHtml(wb.username)}</div>
      </div>`
    ).join('');
  } catch (e) {
    const container = document.getElementById('trendingWordsList');
    if (container) container.innerHTML = '<span style="color: var(--text-secondary); font-size: 14px;">読み込みエラー</span>';
  }
}


window.logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.hash = '#/';
};

window.handleSearch = (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value;
    window.location.hash = `#/?q=${encodeURIComponent(q)}`;
  }
};

// === ランディング ===
function renderLanding(container) {
  container.innerHTML = `
    <div class="auth-layout">
      <div style="text-align: center; margin-bottom: 32px;">
        <span class="material-icons" style="font-size: 64px; color: var(--accent-color)">menu_book</span>
        <h1 style="font-size: 48px; margin: 16px 0;">すべての単語を、<br>あなたの力に。</h1>
        <p style="color: var(--text-secondary); font-size: 20px;">今すぐ TangoSNS に参加して、自分だけの単語帳を作ろう。</p>
      </div>
      <div style="width: 300px; display: flex; flex-direction: column; gap: 16px;">
        <a href="#/register" class="btn-primary" style="text-align: center; font-size: 18px">アカウントを作成</a>
        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary)">
          <div style="height: 1px; background: var(--border-color); flex: 1;"></div>
          または
          <div style="height: 1px; background: var(--border-color); flex: 1;"></div>
        </div>
        <p style="font-size: 15px; margin-bottom: 8px;">すでにアカウントをお持ちですか？</p>
        <a href="#/login" class="btn-primary" style="text-align: center; background: transparent; border: 1px solid var(--border-color); color: var(--accent-color);">ログイン</a>
        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary)">
          <div style="height: 1px; background: var(--border-color); flex: 1;"></div>
          または
          <div style="height: 1px; background: var(--border-color); flex: 1;"></div>
        </div>
        <p style="font-size: 15px; margin-bottom: 8px; color: var(--text-secondary)">まず確認してみたい方</p>
        <a href="#/" class="btn-primary" style="text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary);">
          <span class="material-icons" style="vertical-align:middle;margin-right:8px;font-size:18px">visibility</span>ホームを見る
        </a>
      </div>
    </div>
  `;
}

// === 認証 ===
function renderLogin(container) {
  container.innerHTML = `
    <div class="auth-layout">
      <form class="auth-form" id="loginForm">
        <span class="material-icons" style="font-size: 40px; color: var(--accent-color); align-self: center">menu_book</span>
        <h1 style="text-align: center">TangoSNSにログイン</h1>
        <input type="text" id="username" placeholder="ユーザー名" required>
        <input type="password" id="password" placeholder="パスワード" required>
        <button type="submit" class="btn-primary btn-wide">ログイン</button>
        <div id="errorMsg" class="error-msg"></div>
        <p style="text-align: center; font-size: 14px; margin-top: 16px;">
          アカウントをお持ちでない場合は <a href="#/register">登録</a>
        </p>
      </form>
    </div>
  `;

  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    try {
      const { user, token } = await fetchAPI('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password })
      });
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      window.location.hash = '#/';
    } catch (err) {
      document.getElementById('errorMsg').textContent = err.message;
    }
  };
}

function renderRegister(container) {
  container.innerHTML = `
    <div class="auth-layout">
      <form class="auth-form" id="registerForm">
        <span class="material-icons" style="font-size: 40px; color: var(--accent-color); align-self: center">menu_book</span>
        <h1 style="text-align: center">アカウントを作成</h1>
        <input type="text" id="username" placeholder="ユーザー名" required>
        <input type="password" id="password" placeholder="パスワード (6文字以上)" required minlength="6">
        <div style="display:flex; align-items:center; gap:8px; margin:16px 0">
          <input type="checkbox" id="agreeTerms" required style="width:18px; height:18px; cursor:pointer">
          <label for="agreeTerms" style="cursor:pointer; font-size:14px">
            <a href="#/terms" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color); text-decoration:underline">利用規約</a>と
            <a href="#/privacy" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color); text-decoration:underline">プライバシーポリシー</a>に同意する
          </label>
        </div>
        <button type="submit" class="btn-primary btn-wide">登録する</button>
        <div id="errorMsg" class="error-msg"></div>
        <p style="text-align: center; font-size: 14px; margin-top: 16px;">
          すでにアカウントをお持ちの場合は <a href="#/login">ログイン</a>
        </p>
      </form>
    </div>
  `;

  document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    if (!agreeTerms) {
      document.getElementById('errorMsg').textContent = '利用規約とプライバシーポリシーに同意してください';
      return;
    }

    try {
      const { user, token } = await fetchAPI('/auth/register', {
        method: 'POST', body: JSON.stringify({ username, password })
      });
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      window.location.hash = '#/';
    } catch (err) {
      document.getElementById('errorMsg').textContent = err.message;
    }
  };
}

// === ホームフィード ===
async function renderHomeFeed(container, token, user, initialUrlParams = null) {
  let urlParams = initialUrlParams || new URLSearchParams(window.location.hash.split('?')[1]);
  const q = urlParams.get('q');
  const tag = urlParams.get('tag');
  const sort = urlParams.get('sort') || 'latest';
  const followingOnly = urlParams.get('following_only') === 'true';
  const uncompleted = urlParams.get('uncompleted') === 'true';
  const unstudied = urlParams.get('unstudied') === 'true';
  const mistakes = urlParams.get('mistakes') === 'true';

  let headerTitle = 'ホーム';
  if (q) headerTitle = `検索結果: ${q}`;
  if (tag) headerTitle = `タグ: #${tag}`;

  container.innerHTML = `
    <div class="header" style="border-bottom:none">
      <h2>${headerTitle}</h2>
      ${(q || tag) ? '<a href="#/" style="font-size:14px">クリア</a>' : ''}
    </div>
    ${(!q && !tag && user) ? `
      <div class="home-tabs">
        <div class="home-tab ${!followingOnly ? 'active' : ''}" onclick="switchHomeTab('latest')">最新</div>
        <div class="home-tab ${followingOnly ? 'active' : ''}" onclick="switchHomeTab('following')">フォロー中</div>
      </div>
    ` : ''}
    ${(q || tag) && user ? `
    <div class="filter-bar" style="padding:12px 16px; display:flex; gap:12px; border-bottom:1px solid var(--border-color); flex-wrap:wrap">
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none ${uncompleted ? 'background:rgba(59, 130, 246, 0.1); border-color:var(--accent-color); color:var(--accent-color)' : ''}">
        <input type="checkbox" id="filterUncompleted" ${uncompleted ? 'checked' : ''} style="display:none">
        <span class="material-icons" style="font-size:16px">check_circle_outline</span> 未完了
      </label>
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none ${unstudied ? 'background:rgba(59, 130, 246, 0.1); border-color:var(--accent-color); color:var(--accent-color)' : ''}">
        <input type="checkbox" id="filterUnstudied" ${unstudied ? 'checked' : ''} style="display:none">
        <span class="material-icons" style="font-size:16px">history</span> 未学習
      </label>
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none ${mistakes ? 'background:rgba(59, 130, 246, 0.1); border-color:var(--accent-color); color:var(--accent-color)' : ''}">
        <input type="checkbox" id="filterMistakes" ${mistakes ? 'checked' : ''} style="display:none">
        <span class="material-icons" style="font-size:16px">error_outline</span> 間違えあり
      </label>
    </div>
    ` : ''}
    ${(q || tag) ? `
    <div style="margin-bottom: 16px; padding: 0 16px">
      <select id="sortSelect" onchange="changeSort(this.value)" style="padding: 8px; border-radius: 4px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color);">
        <option value="latest" ${sort === 'latest' ? 'selected' : ''}>最新順</option>
        <option value="popular" ${sort === 'popular' ? 'selected' : ''}>閲覧回数順</option>
      </select>
    </div>
    ` : ''}
    <div id="feedList"></div>
  `;

  const renderFeed = async () => {
    try {
      let url = '/wordbooks';
      const params = [];
      if (urlParams.get('q')) params.push(`q=${encodeURIComponent(urlParams.get('q'))}`);
      if (urlParams.get('tag')) params.push(`tag=${encodeURIComponent(urlParams.get('tag'))}`);
      if (urlParams.get('sort')) params.push(`sort=${encodeURIComponent(urlParams.get('sort'))}`);
      if (urlParams.get('following_only') === 'true') params.push(`following_only=true`);
      if (urlParams.get('uncompleted') === 'true') params.push(`uncompleted=true`);
      if (urlParams.get('unstudied') === 'true') params.push(`unstudied=true`);
      if (urlParams.get('mistakes') === 'true') params.push(`mistakes=true`);
      if (params.length > 0) url += '?' + params.join('&');

      const wordbooks = await fetchAPI(url);
      const feedList = document.getElementById('feedList');
      
      // 前の結果をクリア
      feedList.innerHTML = '';

      if (wordbooks.length === 0) {
        feedList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">まだ単語帳がありません。${urlParams.get('following_only') === 'true' ? '誰かをフォローして、フィードを充実させましょう！' : '最初の単語帳を作成しましょう！'}</div>`;
        return;
      }

    wordbooks.forEach(wb => {
      const d = new Date(wb.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const card = document.createElement('div');
      card.className = 'feed-card';
      card.onclick = () => window.location.hash = `#/wordbook/${wb.id}`;

      let completionBadge = wb.is_completed ? `
        <div class="badge-completed" style="margin-left:auto">
          <span class="material-icons" style="font-size:14px">check_circle</span>
          完了
        </div>
      ` : '';

      // タグ表示
      const tags = wb.tags || [];
      const tagsHtml = tags.length > 0 ? `
        <div class="card-tags" onclick="event.stopPropagation()">
          ${tags.map(t => `<a href="#/?tag=${encodeURIComponent(t.name)}" class="tag-chip">#${t.name}</a>`).join('')}
        </div>
      ` : '';

      card.innerHTML = `
        <div class="card-header">
          <div class="avatar" style="width:24px;height:24px;font-size:12px" onclick="event.stopPropagation(); window.location.hash='#/user/${escapeHtml(wb.username)}'">
            ${safeAvatarUrl(wb.avatar_url) ? `<img src="${safeAvatarUrl(wb.avatar_url)}" alt="">` : escapeHtml(wb.username.charAt(0).toUpperCase())}
          </div>
          <span class="card-author" onclick="event.stopPropagation(); window.location.hash='#/user/${escapeHtml(wb.username)}'">${escapeHtml(wb.username)}</span>
          <span>·</span>
          <span>${d}</span>
          ${completionBadge}
        </div>
        <h3 class="card-title">${escapeHtml(wb.title)}</h3>
        ${wb.description ? `<p class="card-desc">${escapeHtml(wb.description)}</p>` : ''}
        ${tagsHtml}
        <div class="card-stats">
          <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">visibility</span>${wb.view_count || 0}</span>
        </div>
          <div style="display:flex; align-items:center; gap:4px; margin-left:-12px">
          <div class="like-btn" data-wordbook-id="${wb.id}">
            <span class="material-icons" style="font-size:16px">favorite_border</span>
            <span class="like-count">0</span>
          </div>
          <div class="bookmark-btn" data-wordbook-id="${wb.id}" style="cursor:pointer; padding:6px; border-radius:50%; display:flex; align-items:center; transition: background-color 0.2s">
            <span class="material-icons" style="font-size:16px; color:var(--text-secondary)">bookmark_border</span>
          </div>
          ${(user && wb.user_id !== user.id) ? `
            <span class="material-icons report-icon" onclick="event.stopPropagation(); openReportModal({wordbook_id: ${wb.id}})" title="通報する" style="font-size:18px; color:var(--text-secondary); cursor:pointer; padding:6px; border-radius:50%; transition: background-color 0.2s">flag</span>
          ` : ''}
        </div>
      `;

      // いいね情報を読み込む
      const likeBtn = card.querySelector('.like-btn');
      if (likeBtn) {
        loadLikeInfo(wb.id, likeBtn);
        likeBtn.onclick = (e) => {
          e.stopPropagation();
          toggleLike(wb.id, likeBtn);
        };
      }

      // ブックマーク情報を読み込む
      const bookmarkBtn = card.querySelector('.bookmark-btn');
      if (bookmarkBtn) {
        loadBookmarkInfo(wb.id, bookmarkBtn);
        bookmarkBtn.onclick = (e) => {
          e.stopPropagation();
          toggleBookmark(wb.id, bookmarkBtn);
        };
      }

      feedList.appendChild(card);
    });
    } catch (err) {
      const feedList = document.getElementById('feedList');
      if (feedList) {
        feedList.innerHTML = `<div class="error-msg" style="padding:16px">${err.message}</div>`;
      }
    }
  };

  renderFeed();

  // フィルタイベント設定
  if ((urlParams.get('q') || urlParams.get('tag')) && user) {
    const setupFilter = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const label = el.parentElement;
      
      // 初期状態のスタイルを設定
      const updateFilterStyle = () => {
        if (el.checked) {
          label.style.background = 'rgba(59, 130, 246, 0.1)';
          label.style.borderColor = 'var(--accent-color)';
          label.style.color = 'var(--accent-color)';
        } else {
          label.style.background = 'var(--bg-secondary)';
          label.style.borderColor = 'var(--border-color)';
          label.style.color = 'var(--text-primary)';
        }
      };
      
      updateFilterStyle();
      
      el.onchange = () => {
        if (el.checked) {
          urlParams.set(key, 'true');
        } else {
          urlParams.delete(key);
        }
        updateFilterStyle();
        renderFeed();
      };
    };

    setupFilter('filterUncompleted', 'uncompleted');
    setupFilter('filterUnstudied', 'unstudied');
    setupFilter('filterMistakes', 'mistakes');
  }

  // changeSort定義
  window.changeSort = (sortValue) => {
    urlParams.set('sort', sortValue);
    renderFeed();
  };
}

// === 設定 (テーマ・パスワード) ===
async function renderSettings(container, token, user) {
  container.innerHTML = `
    <div class="header">
      <h2>設定</h2>
    </div>
    <div style="padding: 24px;">
      <form id="settingsForm" style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <h3 style="margin-bottom:12px">一般</h3>
          <label style="color:var(--text-secondary);font-size:14px">テーマ設定</label>
          <select id="theme" style="width:100%; padding:10px; border-radius:4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color)">
            <option value="system" ${user.theme === 'system' ? 'selected' : ''}>システム設定に従う</option>
            <option value="light" ${user.theme === 'light' ? 'selected' : ''}>ライト</option>
            <option value="dark" ${user.theme === 'dark' ? 'selected' : ''}>ダーク</option>
          </select>
        </div>
        <div style="margin-top:24px; padding-top:24px; border-top:1px solid var(--border-color)">
          <h3 style="margin-bottom:16px">セキュリティ</h3>
          <div>
            <label style="color:var(--text-secondary);font-size:14px">現在のパスワード (変更時のみ)</label>
            <input type="password" id="currentPassword">
          </div>
          <div style="margin-top:16px">
            <label style="color:var(--text-secondary);font-size:14px">新しいパスワード</label>
            <input type="password" id="newPassword">
          </div>
        </div>
        
        <div style="display:flex; justify-content:flex-end; margin-top:16px">
          <button type="submit" class="btn-primary" style="width:fit-content">保存する</button>
        </div>
        <div id="settingsError" class="error-msg"></div>
        <div id="settingsSuccess" style="color:#00ba7c; font-size:14px; margin-top:8px"></div>
      </form>
    </div>
  `;

  document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const theme = e.target.theme.value;
    const currentPassword = e.target.currentPassword.value;
    const newPassword = e.target.newPassword.value;

    const payload = { ...user, theme };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const updatedUser = await fetchAPI('/users/me', {
        method: 'PUT', body: JSON.stringify(payload)
      });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      applyTheme(updatedUser.theme);
      document.getElementById('settingsError').textContent = '';
      document.getElementById('settingsSuccess').textContent = '設定を更新しました。';
      setTimeout(() => {
        router();
      }, 1500);
    } catch (err) {
      document.getElementById('settingsSuccess').textContent = '';
      document.getElementById('settingsError').textContent = err.message;
    }
  };
}

// === マイプロフィール (閲覧用) ===
async function renderMyProfile(container, token, user) {
  container.innerHTML = `<div style="padding:32px;text-align:center">読み込み中...</div>`;
  try {
    // 最新のユーザー情報を取得 (bioやavatar_urlが反映されているか確認するため)
    const me = await fetchAPI('/users/me');
    const data = await fetchAPI(`/users/${me.username}`);
    const { wordbooks } = data;

    container.innerHTML = `
      <div class="header" style="justify-content:flex-start; gap:24px">
        <button onclick="history.back()"><span class="material-icons">arrow_back</span></button>
        <h2>${me.username}</h2>
      </div>
      
      <div class="profile-header">
        <div class="profile-banner"></div>
        <div class="profile-avatar-container">
          <div class="avatar">
            ${me.avatar_url ? `<img src="${me.avatar_url}" alt="">` : me.username.charAt(0).toUpperCase()}
          </div>
          <button class="btn-primary" style="background:transparent; border:1px solid var(--border-color); color:var(--text-primary)" onclick="openEditProfileModal()">プロフィールを編集</button>
        </div>
        <div class="profile-name">${me.username}</div>
        <div class="profile-handle">@${me.username}</div>
        <div class="profile-bio">${me.bio || '自己紹介はまだありません。'}</div>
        <div class="profile-stats" style="display:flex; gap:16px; margin:12px 0; font-size:14px">
          <span style="cursor:pointer" onclick="viewFollowers(${me.id}, '${me.username}')"><strong>${me.followers_count || 0}</strong> フォロワー</span>
          <span style="cursor:pointer" onclick="viewFollowing(${me.id}, '${me.username}')"><strong>${me.following_count || 0}</strong> フォロー中</span>
        </div>
        <div class="profile-meta" style="display:flex; justify-content:space-between; align-items:center">
          <span><span class="material-icons" style="font-size:16px;vertical-align:text-bottom">calendar_today</span> ${new Date(me.created_at).toLocaleDateString('ja-JP')} に登録</span>
        </div>
      </div>

      <div class="header" style="border-bottom:none; margin-top:8px">
        <h3>作成した単語帳</h3>
      </div>
      <div id="myWbList"></div>
    `;

    const list = document.getElementById('myWbList');
    if (wordbooks.length === 0) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">作成した単語帳はありません。</div>`;
    } else {
      wordbooks.forEach(wb => {
        const d = new Date(wb.created_at).toLocaleDateString('ja-JP');
        const card = document.createElement('div');
        card.className = 'feed-card';
        card.onclick = () => window.location.hash = `#/wordbook/${wb.id}`;
        card.innerHTML = `
          <div class="card-header">
            <span class="card-author">${escapeHtml(me.username)}</span>
            <span>·</span>
            <span>${d}</span>
          </div>
          <h3 class="card-title">${escapeHtml(wb.title)}</h3>
          ${wb.description ? `<p class="card-desc">${escapeHtml(wb.description)}</p>` : ''}
        `;
        list.appendChild(card);
      });
    }

  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}

// === プロフィール編集モーダル ===
window.openEditProfileModal = async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 500px">
      <div class="modal-header">
        <h2 style="font-size:20px">プロフィールを編集</h2>
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
      </div>
      <form id="editProfileForm" style="display:flex; flex-direction:column; gap:16px; padding-top:16px">
        <div>
          <label style="color:var(--text-secondary);font-size:14px">ユーザー名</label>
          <input type="text" id="username" value="${user.username}" required>
        </div>
        <div>
          <label style="color:var(--text-secondary);font-size:14px">アイコン画像のURL</label>
          <input type="url" id="avatar_url" value="${user.avatar_url || ''}" placeholder="https://example.com/image.png">
        </div>
        <div>
          <label style="color:var(--text-secondary);font-size:14px">自己紹介</label>
          <textarea id="bio" placeholder="自分の情報を入力..." style="height:100px; resize:none">${user.bio || ''}</textarea>
        </div>
        <div id="editProfileError" class="error-msg"></div>
        <div style="display:flex; justify-content:flex-end; margin-top:16px">
          <button type="submit" class="btn-primary">保存する</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('editProfileForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const avatar_url = e.target.avatar_url.value;
    const bio = e.target.bio.value;

    try {
      const updatedUser = await fetchAPI('/users/me', {
        method: 'PUT', body: JSON.stringify({ ...user, username, avatar_url, bio })
      });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      overlay.remove();
      router(); // 再描画
    } catch (err) {
      document.getElementById('editProfileError').textContent = err.message;
    }
  };
};

// === 単語帳作成モーダル ===
window.openCreateModal = async () => {
  // 人気タグを取得
  let popularTags = [];
  try {
    popularTags = await fetchAPI('/tags/popular');
  } catch (e) { }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
        <button class="btn-primary" onclick="submitWordbook(this)">作成する</button>
      </div>
      <input type="text" id="wb-title" placeholder="単語帳のタイトル" style="font-size:24px; font-weight:bold; border:none; margin-bottom:16px; background:transparent">
      <textarea id="wb-desc" placeholder="この単語帳の説明を入力..." style="border:none; height:100px; resize:none; font-size:16px; background:transparent"></textarea>
      
      <div style="margin-top:16px">
        <label style="font-size:14px;color:var(--text-secondary)">タグ（カンマ区切りで入力）</label>
        <input type="text" id="wb-tags" placeholder="例: 英語, TOEIC, 初心者" style="margin-top:8px">
        ${popularTags.length > 0 ? `
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
            ${popularTags.map(t => `
              <button type="button" class="tag-suggestion" onclick="addTagSuggestion('${t.name}')">${t.name}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <div id="createError" class="error-msg"></div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.addTagSuggestion = (tagName) => {
  const input = document.getElementById('wb-tags');
  if (!input) return;
  const current = input.value.split(',').map(t => t.trim()).filter(t => t);
  if (!current.includes(tagName)) {
    current.push(tagName);
    input.value = current.join(', ');
  }
};

window.submitWordbook = async (btn) => {
  const container = btn.closest('.modal-overlay');
  const title = container.querySelector('#wb-title').value;
  const description = container.querySelector('#wb-desc').value;
  const tagsInput = container.querySelector('#wb-tags').value;
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

  try {
    const wb = await fetchAPI('/wordbooks', {
      method: 'POST', body: JSON.stringify({ title, description, tags })
    });
    container.remove();
    window.location.hash = `#/wordbook/${wb.id}`;
  } catch (err) {
    container.querySelector('#createError').textContent = err.message;
  }
};

// === 単語帳詳細 (単語とコメント) ===
async function renderWordbookDetail(container, wbId, token, user) {
  container.innerHTML = `<div style="padding:32px;text-align:center">読み込み中...</div>`;

  try {
    const wb = await fetchAPI(`/wordbooks/${wbId}`);
    const isOwner = user && wb.user_id === user.id;
    const isGuest = !user;
    const words = await fetchAPI(`/wordbooks/${wbId}/words`);

    // ログイン中のユーザーの間違い単語IDセットを取得
    let mistakeWordIds = new Set();
    if (!isGuest) {
      try {
        const mistakeList = await fetchAPI(`/study/mistakes/${wbId}`);
        mistakeList.forEach(m => mistakeWordIds.add(m.id));
      } catch (e) { /* 未学習の場合は空のままにする */ }
    }

    let html = `
      <div class="header" style="justify-content:flex-start; gap:24px">
        <button onclick="history.back()"><span class="material-icons">arrow_back</span></button>
        <h2>単語帳</h2>
      </div>
      <div style="padding: 16px; border-bottom: 1px solid var(--border-color);">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px">
          <div class="avatar" style="width:48px;height:48px;cursor:pointer" onclick="window.location.hash='#/user/${escapeHtml(wb.username)}'">
            ${safeAvatarUrl(wb.avatar_url) ? `<img src="${safeAvatarUrl(wb.avatar_url)}" alt="">` : escapeHtml(wb.username.charAt(0).toUpperCase())}
          </div>
          <div>
            <h1 style="font-size:24px;">${escapeHtml(wb.title)}</h1>
            <p style="color:var(--text-secondary); cursor:pointer" onclick="window.location.hash='#/user/${escapeHtml(wb.username)}'">作成者: @${escapeHtml(wb.username)}</p>
          </div>
        </div>
        ${wb.tags && wb.tags.length > 0 ? `
          <div class="card-tags" style="margin-bottom:12px">
            ${wb.tags.map(t => `<a href="#/?tag=${encodeURIComponent(t.name)}" class="tag-chip">#${t.name}</a>`).join('')}
          </div>
        ` : ''}
        <p style="margin-bottom:16px; white-space:pre-wrap">${escapeHtml(wb.description || '')}</p>
        ${wb.bio ? `<div style="padding:8px 12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:16px; font-size:13px; color:var(--text-secondary)">
          <div style="font-weight:bold; margin-bottom:4px">作成者の自己紹介:</div>
          <div>${escapeHtml(wb.bio)}</div>
        </div>` : ''}
        <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; color:var(--text-secondary); font-size:14px;">
          <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">library_books</span>${wb.word_count || 0} 単語</span>
          <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">comment</span>${wb.comment_count || 0} コメント</span>
          <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">visibility</span>${wb.view_count || 0} 閲覧</span>
          <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">school</span>${wb.study_count || 0} 学習</span>
        </div>
        <div style="margin-bottom:16px; margin-left:-12px; display:flex; align-items:center; gap:8px">
          <div class="like-btn" data-wordbook-id="${wb.id}">
            <span class="material-icons" style="font-size:18px">favorite_border</span>
            <span class="like-count">0</span>
          </div>
          <div class="bookmark-btn" data-wordbook-id="${wb.id}" style="cursor:pointer; padding:8px; border-radius:50%; display:flex; align-items:center;">
            <span class="material-icons" style="font-size:20px; color:var(--text-secondary)">bookmark_border</span>
          </div>
          ${!isOwner && !isGuest ? `
            <span class="material-icons report-icon" onclick="openReportModal({wordbook_id: ${wb.id}})" title="この単語帳を通報する" style="font-size:20px; color:var(--text-secondary); cursor:pointer; padding:8px; border-radius:50%; transition: background-color 0.2s">flag</span>
          ` : ''}
        </div>
        <div style="display:flex; gap:12px; margin-bottom:8px; align-items:center; flex-wrap:wrap">
          ${isGuest ? `
            <button class="btn-primary" onclick="window.location.hash='#/login'" style="background:var(--accent-color)">
              <span class="material-icons" style="vertical-align:middle;margin-right:8px">login</span>ログインして学習を始める
            </button>
          ` : `
            ${words.length > 0 ? `<button class="btn-primary" onclick='startStudy(${wbId}, ${JSON.stringify(words).replace(/'/g, "&#39;")})'><span class="material-icons" style="vertical-align:middle;margin-right:8px">school</span>最初から学習</button>` : ''}
            
            ${(() => {
        const saved = localStorage.getItem(`study_session_${wbId}`);
        if (saved) {
          return `<button class="btn-primary" style="background:var(--accent-color)" onclick="resumeStudy(${wbId})"><span class="material-icons" style="vertical-align:middle;margin-right:8px">play_arrow</span>続きから再開</button>`;
        }
        return '';
      })()}

            <button class="btn-primary" style="background:transparent; border:1px solid var(--accent-color); color:var(--accent-color)" onclick="startMistakeStudy(${wbId})"><span class="material-icons" style="vertical-align:middle;margin-right:8px">replay</span>間違えた単語を復習</button>
            
            <button id="toggleCompleteBtn" class="btn-primary" style="background:${wb.is_completed ? '#00ba7c' : 'transparent'}; border:1px solid ${wb.is_completed ? '#00ba7c' : 'var(--border-color)'}; color:${wb.is_completed ? 'white' : 'var(--text-secondary)'}">
              <span class="material-icons" style="vertical-align:middle;margin-right:8px">${wb.is_completed ? 'check_circle' : 'radio_button_unchecked'}</span>
              ${wb.is_completed ? '完了済み' : '完了にする'}
            </button>
          `}

          ${isOwner ? `
            <button class="btn-primary" style="background:transparent; border:1px solid var(--border-color); color:var(--text-primary); margin-left:auto" onclick='openEditWordbookModal(${JSON.stringify(wb).replace(/'/g, "&#39;")})'>
              <span class="material-icons" style="vertical-align:middle;margin-right:4px;font-size:18px">edit</span>編集
            </button>
            <button class="btn-primary" style="background:transparent; border:1px solid var(--error-color); color:var(--error-color)" onclick="deleteWordbook(${wb.id})">削除</button>
          ` : ''}
        </div>
      </div>
      
      <!-- 単語追加フォーム (所有者のみ) -->
      ${isOwner ? `
        <form class="add-form" id="addWordForm">
          <input type="text" id="newWord" placeholder="単語" required>
          <input type="text" id="newMeaning" placeholder="意味" required>
          <button type="submit" class="btn-primary" style="padding:8px 16px">追加</button>
        </form>
      ` : ''}
      
      <div style="padding:16px; border-bottom:1px solid var(--border-color)">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px">
          <h3 style="margin:0; flex:1">登録された単語</h3>
          <button type="button" id="toggleWordsBtn" class="btn-primary" style="background:transparent; border:1px solid var(--border-color); color:var(--text-primary); padding:8px 16px">
            <span class="material-icons" style="vertical-align:middle; font-size:18px">expand_more</span>
          </button>
        </div>
        
        <table style="width:100%; border-collapse:collapse; font-size:14px">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color)">
              <th style="text-align:left; padding:12px; font-weight:bold; color:var(--text-secondary)">単語</th>
              <th style="text-align:left; padding:12px; font-weight:bold; color:var(--text-secondary)">意味</th>
              ${!isGuest ? '<th style="text-align:center; padding:12px; font-weight:bold; color:var(--text-secondary); width:60px">状況</th>' : ''}
              ${isOwner ? '<th style="text-align:center; padding:12px; font-weight:bold; color:var(--text-secondary); width:50px">削除</th>' : ''}
            </tr>
          </thead>
          <tbody id="wordTableBody">
          </tbody>
        </table>
      </div>
      
      <div style="border-top:1px solid var(--border-color); margin-top:16px; padding-top:16px">
        <h3 style="padding:0 16px; margin-bottom:16px;">コメント</h3>
        ${isGuest ? `
          <div style="padding:16px; background:var(--bg-secondary); border-radius:8px; margin-bottom:16px; text-align:center">
            <p style="color:var(--text-secondary); margin-bottom:12px">コメントを投稿するにはログインしてください</p>
            <a href="#/login" class="btn-primary" style="display:inline-block; padding:8px 16px; text-decoration:none">ログイン</a>
          </div>
        ` : `
          <form class="add-form" id="addCommentForm" style="border:none">
            <input type="text" id="newComment" placeholder="コメントを投稿..." required>
            <button type="submit" class="btn-primary" style="padding:8px 16px">返信</button>
          </form>
        `}
        <div id="commentList"></div>
      </div>
    `;
    container.innerHTML = html;

    // 単語一覧の描画（表形式）
    const wordTableBody = document.getElementById('wordTableBody');
    const maxRows = 10;
    let isExpanded = false;

    function renderWordTable() {
      wordTableBody.innerHTML = '';
      const visibleWords = isExpanded ? words : words.slice(0, maxRows);
      visibleWords.forEach(w => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        const isMistake = mistakeWordIds.has(w.id);
        const statusCell = !isGuest
          ? `<td style="padding:12px; text-align:center">
               ${mistakeWordIds.size > 0 || isMistake
                 ? isMistake
                   ? `<span class="material-icons" style="font-size:18px; color:var(--error-color)" title="直近の学習で間違えた単語">close</span>`
                   : `<span class="material-icons" style="font-size:18px; color:#00ba7c" title="直近の学習で正解した単語">check</span>`
                 : ''}
             </td>`
          : '';
        row.innerHTML = `
          <td style="padding:12px; color:var(--text-primary)">${escapeHtml(w.word)}</td>
          <td style="padding:12px; color:var(--text-primary)">${escapeHtml(w.meaning)}</td>
          ${statusCell}
          ${isOwner ? `<td style="padding:12px; text-align:center"><button class="delete-btn" onclick="deleteWord(${wbId}, ${w.id})"><span class="material-icons" style="font-size:18px">delete</span></button></td>` : ''}
        `;
        wordTableBody.appendChild(row);
      });
    }

    // トグルボタンのイベントリスナー
    const toggleWordsBtn = document.getElementById('toggleWordsBtn');
    if (toggleWordsBtn && words.length > maxRows) {
      toggleWordsBtn.onclick = () => {
        isExpanded = !isExpanded;
        renderWordTable();
        toggleWordsBtn.innerHTML = isExpanded
          ? '<span class="material-icons" style="vertical-align:middle; font-size:18px">expand_less</span>'
          : '<span class="material-icons" style="vertical-align:middle; font-size:18px">expand_more</span>';
      };
    } else if (toggleWordsBtn && words.length <= maxRows) {
      // 単語数が少ない場合はボタンを不可にする
      toggleWordsBtn.disabled = true;
      toggleWordsBtn.style.opacity = '0.5';
      toggleWordsBtn.style.cursor = 'not-allowed';
    }

    // 初期描画
    renderWordTable();

    // コメント一覧の描画
    const comments = await fetchAPI(`/wordbooks/${wbId}/comments`);
    const cl = document.getElementById('commentList');
    comments.forEach(c => {
      const isCmdOwner = user && c.user_id === user.id;
      cl.innerHTML += `
        <div style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; gap:12px; align-items:flex-start">
          <div class="avatar" style="width:32px; height:32px; font-size:14px; cursor:pointer" onclick="window.location.hash='#/user/${escapeHtml(c.username)}'">
            ${safeAvatarUrl(c.avatar_url) ? `<img src="${safeAvatarUrl(c.avatar_url)}" alt="">` : escapeHtml(c.username.charAt(0).toUpperCase())}
          </div>
          <div style="flex:1">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-weight:bold; cursor:pointer" onclick="window.location.hash='#/user/${escapeHtml(c.username)}'">${escapeHtml(c.username)}</span>
              ${isCmdOwner ? `<button class="delete-btn" onclick="deleteComment(${wbId}, ${c.id})"><span class="material-icons" style="font-size:18px">delete</span></button>` : ''}
            </div>
            <p style="margin-top:4px; white-space:pre-wrap">${escapeHtml(c.comment)}</p>
          </div>
        </div>
      `;
    });

    // イベント登録
    if (isOwner) {
      document.getElementById('addWordForm').onsubmit = async (e) => {
        e.preventDefault();
        const word = e.target.newWord.value;
        const meaning = e.target.newMeaning.value;
        try {
          await fetchAPI(`/wordbooks/${wbId}/words`, { method: 'POST', body: JSON.stringify({ word, meaning }) });
          renderWordbookDetail(container, wbId, token, user);
        } catch (err) { alert(err.message); }
      };
    }

    // いいね情報を読み込む
    const likeBtnDetail = container.querySelector('.like-btn');
    if (likeBtnDetail) {
      loadLikeInfo(wb.id, likeBtnDetail);
      likeBtnDetail.onclick = (e) => {
        e.stopPropagation();
        toggleLike(wb.id, likeBtnDetail);
      };
    }

    // ブックマーク情報を読み込む
    const bookmarkBtnDetail = container.querySelector('.bookmark-btn');
    if (bookmarkBtnDetail) {
      loadBookmarkInfo(wb.id, bookmarkBtnDetail);
      bookmarkBtnDetail.onclick = (e) => {
        e.stopPropagation();
        toggleBookmark(wb.id, bookmarkBtnDetail);
      };
    }

    // コメントフォーム
    const commentForm = document.getElementById('addCommentForm');
    if (commentForm) {
      commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const comment = e.target.newComment.value;
        try {
          await fetchAPI(`/wordbooks/${wbId}/comments`, { method: 'POST', body: JSON.stringify({ comment }) });
          renderWordbookDetail(container, wbId, token, user);
        } catch (err) { alert(err.message); }
      };
    }

    // 完了トグルイベント（ログインユーザーのみ）
    const toggleCompleteBtn = document.getElementById('toggleCompleteBtn');
    if (toggleCompleteBtn && !isGuest) {
      toggleCompleteBtn.onclick = async () => {
        try {
          if (wb.is_completed) {
            await fetchAPI(`/completions/${wbId}`, { method: 'DELETE' });
          } else {
            await fetchAPI(`/completions/${wbId}`, { method: 'POST' });
          }
          renderWordbookDetail(container, wbId, token, user);
        } catch (err) { alert(err.message); }
      };
    }

  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}

// 削除ハンドラ
window.deleteWordbook = async (id) => {
  if (!confirm('本当にこの単語帳を削除しますか？')) return;
  try {
    await fetchAPI(`/wordbooks/${id}`, { method: 'DELETE' });
    window.location.hash = '#/';
  } catch (err) { alert(err.message); }
};

window.deleteWord = async (wbId, wordId) => {
  if (!confirm('削除しますか？')) return;
  try {
    await fetchAPI(`/wordbooks/${wbId}/words/${wordId}`, { method: 'DELETE' });
    router(); // 再描画
  } catch (err) { alert(err.message); }
};

window.deleteComment = async (wbId, cId) => {
  if (!confirm('削除しますか？')) return;
  try {
    await fetchAPI(`/wordbooks/${wbId}/comments/${cId}`, { method: 'DELETE' });
    router();
  } catch (err) { alert(err.message); }
};

// === 単語帳編集モーダル ===
window.openEditWordbookModal = async (wb) => {
  // 人気タグを取得
  let popularTags = [];
  try {
    popularTags = await fetchAPI('/tags/popular');
  } catch (e) { }

  const currentTags = (wb.tags || []).map(t => t.name).join(', ');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
        <button class="btn-primary" onclick="submitEditWordbook(this, ${wb.id})">保存する</button>
      </div>
      <input type="text" id="edit-wb-title" value="${wb.title.replace(/"/g, '&quot;')}" placeholder="単語帳のタイトル" style="font-size:24px; font-weight:bold; border:none; margin-bottom:16px; background:transparent">
      <textarea id="edit-wb-desc" placeholder="この単語帳の説明を入力..." style="border:none; height:100px; resize:none; font-size:16px; background:transparent">${wb.description || ''}</textarea>
      
      <div style="margin-top:16px">
        <label style="font-size:14px;color:var(--text-secondary)">タグ（カンマ区切りで入力）</label>
        <input type="text" id="edit-wb-tags" value="${currentTags}" placeholder="例: 英語, TOEIC, 初心者" style="margin-top:8px">
        ${popularTags.length > 0 ? `
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
            ${popularTags.map(t => `
              <button type="button" class="tag-suggestion" onclick="addEditTagSuggestion('${t.name}')">${t.name}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <div id="editError" class="error-msg"></div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.addEditTagSuggestion = (tagName) => {
  const input = document.getElementById('edit-wb-tags');
  if (!input) return;
  const current = input.value.split(',').map(t => t.trim()).filter(t => t);
  if (!current.includes(tagName)) {
    current.push(tagName);
    input.value = current.join(', ');
  }
};

window.submitEditWordbook = async (btn, wbId) => {
  const container = btn.closest('.modal-overlay');
  const title = container.querySelector('#edit-wb-title').value;
  const description = container.querySelector('#edit-wb-desc').value;
  const tagsInput = container.querySelector('#edit-wb-tags').value;
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

  try {
    await fetchAPI(`/wordbooks/${wbId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, tags })
    });
    container.remove();
    router();
  } catch (err) {
    container.querySelector('#editError').textContent = err.message;
  }
};

// === 学習履歴画面 ===
async function renderHistory(container) {
  // フィルター状態
  const historyFilters = {
    uncompleted: false,
    mistakes: false
  };

  container.innerHTML = `
    <div class="header">
      <h2><span class="material-icons" style="vertical-align:middle;margin-right:8px;color:var(--accent-color)">history</span>学習履歴</h2>
    </div>
    <div class="filter-bar" style="padding:12px 16px; display:flex; gap:12px; border-bottom:1px solid var(--border-color); flex-wrap:wrap">
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none">
        <input type="checkbox" id="filterUncompleted" style="display:none">
        <span class="material-icons" style="font-size:16px">check_circle_outline</span> 未完了
      </label>
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none">
        <input type="checkbox" id="filterMistakes" style="display:none">
        <span class="material-icons" style="font-size:16px">error_outline</span> 間違えあり
      </label>
    </div>
    <div id="historyList"></div>
  `;

  const renderList = async () => {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">読み込み中...</div>`;

    try {
      const params = new URLSearchParams();
      if (historyFilters.uncompleted) params.append('uncompleted', 'true');
      if (historyFilters.mistakes) params.append('mistakes', 'true');

      const history = await fetchAPI(`/study/history?${params.toString()}`);
      list.innerHTML = '';

      if (history.length === 0) {
        list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">学習履歴はありません。</div>`;
        return;
      }

      history.forEach(h => {
        const d = new Date(h.last_studied).toLocaleString('ja-JP');
        const mCount = Number(h.mistakes_count);

        const card = document.createElement('div');
        card.className = 'feed-card';
        card.onclick = () => window.location.hash = `#/wordbook/${h.wordbook_id}`;

        let mistakesBadge = '';
        if (mCount > 0) {
          mistakesBadge = `
            <div style="margin-top:12px; display:inline-flex; align-items:center; color:var(--error-color); background:rgba(244, 33, 46, 0.1); padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">
              <span class="material-icons" style="font-size:14px; margin-right:4px;">error_outline</span>
              間違えた単語あり (${mCount}問)
            </div>
          `;
        }

        let completionBadge = h.is_completed ? `
          <div class="badge-completed" style="margin-left:auto">
            <span class="material-icons" style="font-size:14px">check_circle</span>
            完了
          </div>
        ` : '';

        card.innerHTML = `
          <div class="card-header">
            <span class="material-icons" style="color:#00ba7c; font-size:16px;">done_all</span>
            <span style="color:var(--text-secondary); margin-left:4px">${d} に学習</span>
            ${completionBadge}
          </div>
          <h3 class="card-title">${h.title}</h3>
          <p class="card-desc" style="font-size:14px">作成者: @${h.username}</p>
          ${mistakesBadge}
        `;
        list.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--error-color)">読み込みに失敗しました</div>`;
    }
  };

  // フィルター初期化
  const setupFilter = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    const label = input.parentElement;

    input.onchange = () => {
      historyFilters[key] = input.checked;
      if (input.checked) {
        label.style.background = 'rgba(0, 186, 124, 0.1)';
        label.style.borderColor = 'var(--accent-color)';
        label.style.color = 'var(--accent-color)';
        label.querySelector('.material-icons').textContent = key === 'uncompleted' ? 'check_circle' : 'error';
      } else {
        label.style.background = 'var(--bg-secondary)';
        label.style.borderColor = 'var(--border-color)';
        label.style.color = 'var(--text-primary)';
        label.querySelector('.material-icons').textContent = key === 'uncompleted' ? 'check_circle_outline' : 'error_outline';
      }
      renderList();
    };
  };

  setupFilter('filterUncompleted', 'uncompleted');
  setupFilter('filterMistakes', 'mistakes');

  // 初回表示
  renderList();
}

// 復習スタート用関数
window.startMistakeStudy = async (wbId) => {
  try {
    const mistakes = await fetchAPI(`/study/mistakes/${wbId}`);
    if (mistakes.length === 0) {
      alert('この単語帳で間違えた単語はまだありません！');
      return;
    }
    // study_mistakesテーブルから取得したデータは created_at 付きで word もそのまま
    // 復習時は isReview=true フラグを渡す
    window.startStudy(wbId, mistakes, true);
  } catch (err) {
    alert(err.message);
  }
};

// 続きから再開するためのヘルパー
window.resumeStudy = (wbId) => {
  const saved = localStorage.getItem(`study_session_${wbId}`);
  if (!saved) return;
  const state = JSON.parse(saved);
  // オリジナルの単語リストと、保存された状態を渡す
  window.startStudy(wbId, state.words, state.isReview, state);
};

window.closeStudyModal = (wbId, el) => {
  if (el) el.closest('.study-modal').remove();
  else {
    const modal = document.querySelector('.study-modal');
    if (modal) modal.remove();
  }
  // 背景のページ（単語帳詳細など）を再描画して、再開ボタンの状態を同期する
  router();
};

// === 学習機能 (Study Mode) ===
window.startStudy = (wbId, words, isReview = false, resumeState = null) => {
  if (!words || words.length === 0) return;

  // ラウンド状態
  const initialWordIds = resumeState ? resumeState.initialWordIds : words.map(w => w.id || w.word_id);
  let currentWords = resumeState ? resumeState.currentWords : [...words]; // 今回の周回で解く単語
  let roundWrongs = resumeState ? resumeState.roundWrongs : [];          // 今回の周回で間違えた単語をプール
  let currentIndex = resumeState ? resumeState.currentIndex : 0;          // 現在の周回内でのインデックス
  let isFlipped = false;

  const saveState = () => {
    const state = {
      initialWordIds,
      currentWords,
      roundWrongs,
      currentIndex,
      isReview,
      words // オリジナルの単語リストも保存（再開時に必要）
    };
    localStorage.setItem(`study_session_${wbId}`, JSON.stringify(state));
  };

  const modal = document.createElement('div');
  modal.className = 'study-modal';

  const renderCard = () => {
    // 全問終了チェック
    if (currentIndex >= currentWords.length) {
      // 1周（またはラウンド）が終わったので再開用ステートを一度消す
      localStorage.removeItem(`study_session_${wbId}`);

      if (roundWrongs.length === 0) {
        // 完全クリアの場合のみ学習完了として記録
        fetchAPI('/study/finish', {
          method: 'POST',
          body: JSON.stringify({
            wordbookId: wbId,
            wrongWordIds: [], // 全てクリアしたので空
            testedWordIds: initialWordIds
          })
        }).catch(err => console.error('学習記録の保存に失敗:', err));

        // 完全クリア
        modal.innerHTML = `
            <div class="study-header">
              <h2 style="font-size:24px">クリア！</h2>
              <button onclick="closeStudyModal(${wbId}, this)"><span class="material-icons" style="font-size:32px">close</span></button>
            </div>
            <div class="study-body">
              <span class="material-icons" style="font-size:80px; color:#00ba7c; margin-bottom:16px">celebration</span>
              <h1 style="margin-bottom:24px">すべての単語をマスターしました！</h1>
              <button class="btn-primary" onclick="closeStudyModal(${wbId}, this)">一覧へ戻る</button>
            </div>
          `;
      } else {
        // 間違えた問題がある場合、次のラウンドへ
        modal.innerHTML = `
            <div class="study-header">
              <h2 style="font-size:24px">ラウンド終了</h2>
              <button onclick="closeStudyModal(${wbId}, this)"><span class="material-icons" style="font-size:32px">close</span></button>
            </div>
            <div class="study-body">
              <span class="material-icons" style="font-size:80px; color:var(--text-secondary); margin-bottom:16px">refresh</span>
              <h1 style="margin-bottom:8px">${roundWrongs.length} 問間違えました</h1>
              <p style="color:var(--text-secondary); margin-bottom:32px">間違えた単語だけを解き直します。</p>
              <button class="btn-primary" id="btnRetry">やり直す</button>
            </div>
          `;
        modal.querySelector('#btnRetry').onclick = () => {
          currentWords = [...roundWrongs];
          roundWrongs = [];
          currentIndex = 0;
          saveState();
          renderCard();
        };
      }
      return;
    }

    // 問題の描画
    isFlipped = false;
    const w = currentWords[currentIndex];

    modal.innerHTML = `
        <div class="study-header">
          <h2 style="font-size:20px; color:var(--text-secondary)">学習中</h2>
          <button onclick="closeStudyModal(${wbId}, this)"><span class="material-icons">close</span></button>
        </div>
        <div class="study-body">
          <div class="study-progress">${currentIndex + 1} / ${currentWords.length}</div>
          
          <div class="flashcard-container" id="fcContainer">
            <div class="flashcard" id="fcInner">
              <div class="flashcard-face flashcard-front">${escapeHtml(w.word)}</div>
              <div class="flashcard-face flashcard-back">${escapeHtml(w.meaning)}</div>
            </div>
          </div>
          
          <p style="color:var(--text-secondary); margin-bottom:32px">カードをタップして裏返す</p>
  
          <div class="study-actions" id="studyActions">
            <button class="btn-judge btn-wrong" id="btnWrong"><span class="material-icons">close</span></button>
            <button class="btn-judge btn-correct" id="btnCorrect"><span class="material-icons">radio_button_unchecked</span></button>
          </div>
        </div>
      `;

    // フリップイベント
    const fcInner = modal.querySelector('#fcInner');
    const actions = modal.querySelector('#studyActions');
    modal.querySelector('#fcContainer').onclick = () => {
      if (isFlipped) return; // 判定ボタンを出した後はフリップしない
      isFlipped = true;
      fcInner.classList.add('flipped');
      actions.classList.add('visible');
    };

    // 判定イベント
    modal.querySelector('#btnCorrect').onclick = () => {
      if (isReview) {
        // 復習モードで正解したら間違えリストから消す
        fetchAPI(`/study/mistakes/${wbId}/${w.id}`, { method: 'DELETE' }).catch(e => console.error(e));
      }
      currentIndex++;
      saveState();
      renderCard();
    };
    modal.querySelector('#btnWrong').onclick = () => {
      roundWrongs.push(w);
      currentIndex++;
      saveState();
      renderCard();
    };
  };

  document.body.appendChild(modal);
  renderCard();
};

// === 他ユーザーのプロフィール画面 ===
async function renderUserProfile(container, username, token) {
  container.innerHTML = `<div style="padding:32px;text-align:center">読み込み中...</div>`;
  try {
    const data = await fetchAPI(`/users/${username}`);
    const { user, wordbooks } = data;

    // ユーザーが見つからない場合
    if (!user) {
      container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)"><p>ユーザーが見つかりません。</p><a href="#/" style="color:var(--accent-color)">ホームに戻る</a></div>`;
      return;
    }

    const me = JSON.parse(localStorage.getItem('user') || 'null');
    const isAdmin = me && me.is_admin === true;
    const isMe = me && me.id === user.id;

    const adminMenu = (isAdmin && !isMe) ? `
      <div class="admin-dropdown">
        <button class="btn-sm" onclick="toggleAdminMenu(event)" title="管理者メニュー">
          <span class="material-icons">more_vert</span>
        </button>
        <div class="admin-dropdown-menu" id="adminDropdownMenu">
          <button onclick="openWarnModal(${user.id}, '${escapeHtml(user.username)}')">
            <span class="material-icons">warning</span> 警告を送信
          </button>
          <button onclick="openBanModal(${user.id}, '${escapeHtml(user.username)}')">
            <span class="material-icons">block</span> BANする
          </button>
          <button onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')" style="color:#dc2626">
            <span class="material-icons">delete</span> ユーザーを削除
          </button>
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="header" style="justify-content:flex-start; gap:24px">
        <button onclick="history.back()"><span class="material-icons">arrow_back</span></button>
        <h2>${escapeHtml(user.username)}</h2>
        <div style="margin-left:auto">${adminMenu}</div>
      </div>
      
      <div class="profile-header">
        <div class="profile-banner"></div>
        <div class="profile-avatar-container">
          <div class="avatar">
            ${safeAvatarUrl(user.avatar_url) ? `<img src="${safeAvatarUrl(user.avatar_url)}" alt="">` : escapeHtml(user.username.charAt(0).toUpperCase())}
          </div>
          <div style="display:flex; gap:8px; align-items:center">
            ${!isMe && me ? `
              <button class="btn-sm" onclick="openReportModal({user_id: ${user.id}})" title="通報する" style="border-radius:50%; width:40px; height:40px; border:1px solid var(--border-color)">
                <span class="material-icons" style="font-size:20px; color:var(--text-secondary)">flag</span>
              </button>
              <button class="btn-primary" 
                      id="followBtn" 
                      style="background:${user.is_following ? 'transparent' : 'var(--accent-color)'}; 
                             border:1px solid ${user.is_following ? 'var(--border-color)' : 'var(--accent-color)'}; 
                             color:${user.is_following ? 'var(--text-primary)' : 'white'}"
                      onclick="toggleFollow(${user.id}, this)">
                ${user.is_following ? 'フォロー中' : 'フォローする'}
              </button>
            ` : ''}
            ${isMe ? `<button class="btn-primary" style="background:transparent; border:1px solid var(--border-color); color:var(--text-primary)" onclick="openEditProfileModal()">プロフィールを編集</button>` : ''}
          </div>
        </div>
        <div class="profile-name">${escapeHtml(user.username)}</div>
        <div class="profile-handle">@${escapeHtml(user.username)}</div>
        <div class="profile-bio">${escapeHtml(user.bio || '自己紹介はまだありません。')}</div>
        <div class="profile-stats" style="display:flex; gap:16px; margin:12px 0; font-size:14px">
          <span style="cursor:pointer" onclick="viewFollowers(${user.id}, '${escapeHtml(user.username)}')"><strong>${user.followers_count || 0}</strong> フォロワー</span>
          <span style="cursor:pointer" onclick="viewFollowing(${user.id}, '${escapeHtml(user.username)}')"><strong>${user.following_count || 0}</strong> フォロー中</span>
        </div>
        <div class="profile-meta">
          <span><span class="material-icons" style="font-size:16px;vertical-align:text-bottom">calendar_today</span> ${new Date(user.created_at).toLocaleDateString('ja-JP')} に登録</span>
        </div>
      </div>

      <div class="header" style="border-bottom:none; margin-top:8px">
        <h3>作成した単語帳</h3>
      </div>
      <div id="userWbList"></div>
    `;

    const list = document.getElementById('userWbList');
    if (wordbooks.length === 0) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">作成した単語帳はありません。</div>`;
    } else {
      wordbooks.forEach(wb => {
        const d = new Date(wb.created_at).toLocaleDateString('ja-JP');
        const card = document.createElement('div');
        card.className = 'feed-card';
        card.onclick = () => window.location.hash = `#/wordbook/${wb.id}`;
        card.innerHTML = `
          <div class="card-header">
            <span class="card-author">${escapeHtml(user.username)}</span>
            <span>·</span>
            <span>${d}</span>
          </div>
          <h3 class="card-title">${escapeHtml(wb.title)}</h3>
          ${wb.description ? `<p class="card-desc">${escapeHtml(wb.description)}</p>` : ''}
        `;
        list.appendChild(card);
      });
    }

  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}

// === 通知画面 ===
async function renderNotifications(container) {
  try {
    container.innerHTML = `
      <div class="header">
        <h2>通知</h2>
        <button class="btn-secondary" onclick="markAllNotificationsAsRead()">すべて既読にする</button>
      </div>
      <div id="notificationsList" class="notifications-list">
        <div style="padding:32px;text-align:center;color:var(--text-secondary)">読み込み中...</div>
      </div>
    `;

    const list = document.getElementById('notificationsList');
    const notifications = await fetchAPI('/notifications');

    if (notifications.length === 0) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">通知はありません。</div>`;
      return;
    }

    list.innerHTML = '';
    notifications.forEach(n => {
      const d = new Date(n.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const item = document.createElement('div');
      item.className = `notification-item ${n.is_read ? '' : 'unread'}`;

      if (n.type === 'warning') {
        // 警告通知は確認が必要
        item.onclick = async () => {
          if (confirm('この警告を確認しましたか？')) {
            await fetchAPI(`/notifications/${n.id}/read`, { method: 'PUT' });
            updateUnreadBadge();
            router();
          }
        };
        item.innerHTML = `
          <div class="notification-content">
            <div class="notification-message" style="color: var(--error-color); font-weight: bold;">${escapeHtml(n.message)}</div>
            <div class="notification-date">${d}</div>
            <div style="margin-top: 8px; color: var(--text-secondary); font-size: 12px;">確認するまで通知に残ります</div>
          </div>
          <div class="notification-dot" style="background: var(--error-color);"></div>
        `;
      } else {
        item.onclick = async () => {
          if (!n.is_read) {
            await fetchAPI(`/notifications/${n.id}/read`, { method: 'PUT' });
            updateUnreadBadge();
          }
          if (n.link) window.location.hash = n.link;
        };
        item.innerHTML = `
          <div class="notification-content">
            <div class="notification-message">${escapeHtml(n.message)}</div>
            <div class="notification-date">${d}</div>
          </div>
          ${n.is_read ? '' : '<div class="notification-dot"></div>'}
        `;
      }

      list.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}

async function markAllNotificationsAsRead() {
  try {
    await fetchAPI('/notifications/read-all', { method: 'PUT' });
    updateUnreadBadge();
    router();
  } catch (e) {
    alert('エラーが発生しました');
  }
}

// === 管理者ダッシュボード ===
async function renderAdminDashboard(container, tab = 'stats') {
  container.innerHTML = `
    <div class="header">
      <h2><span class="material-icons" style="vertical-align:middle;margin-right:8px;color:#f59e0b">admin_panel_settings</span>管理者ダッシュボード</h2>
    </div>
    <div class="home-tabs">
      <div class="home-tab ${tab === 'stats' ? 'active' : ''}" onclick="window.location.hash='#/admin/stats'">概要</div>
      <div class="home-tab ${tab === 'users' ? 'active' : ''}" onclick="window.location.hash='#/admin/users'">ユーザー一覧</div>
      <div class="home-tab ${tab === 'reports' ? 'active' : ''}" onclick="window.location.hash='#/admin/reports'">通報一覧</div>
    </div>
    <div id="adminContent" style="padding:16px">
      <div style="padding:32px;text-align:center;color:var(--text-secondary)">読み込み中...</div>
    </div>
  `;

  const content = document.getElementById('adminContent');

  try {
    if (tab === 'stats') {
      await renderAdminStats(content);
    } else if (tab === 'users') {
      await renderAdminUsers(content);
    } else if (tab === 'reports') {
      await renderAdminReports(content);
    }
  } catch (err) {
    content.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}

async function renderAdminStats(container) {
  try {
    const stats = await fetchAPI('/admin/stats');
    container.innerHTML = `
      <div id="adminStats" class="admin-stats-grid">
        <div class="admin-stat-card">
          <span class="material-icons" style="font-size:32px;color:var(--accent-color)">people</span>
          <div class="stat-value">${stats.totalUsers}</div>
          <div class="stat-label">総ユーザー数</div>
        </div>
        <div class="admin-stat-card">
          <span class="material-icons" style="font-size:32px;color:#ef4444">block</span>
          <div class="stat-value">${stats.bannedUsers}</div>
          <div class="stat-label">BANユーザー</div>
        </div>
        <div class="admin-stat-card">
          <span class="material-icons" style="font-size:32px;color:#10b981">menu_book</span>
          <div class="stat-value">${stats.totalWordbooks}</div>
          <div class="stat-label">総単語帳数</div>
        </div>
        <div class="admin-stat-card">
          <span class="material-icons" style="font-size:32px;color:#f59e0b">warning</span>
          <div class="stat-value">${stats.totalWarnings}</div>
          <div class="stat-label">発行済み警告</div>
        </div>
        <div class="admin-stat-card">
          <span class="material-icons" style="font-size:32px;color:#f4212e">flag</span>
          <div class="stat-value">${stats.totalReports}</div>
          <div class="stat-label">未対処の通報</div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function renderAdminUsers(container) {
  try {
    const users = await fetchAPI('/admin/users');
    container.innerHTML = `
      <h3 style="margin-bottom:16px">ユーザー管理</h3>
      <div id="adminUserList"></div>
    `;
    const userList = document.getElementById('adminUserList');
    if (users.length === 0) {
      userList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">ユーザーがいません。</div>`;
    } else {
      let html = `
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ユーザー</th>
                <th>登録日 / IP</th>
                <th>状態 / 警告</th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
      `;
      users.forEach(u => {
        const d = new Date(u.created_at).toLocaleDateString('ja-JP');
        const badge = u.is_admin ? '<span class="badge badge-admin">管理者</span>' : (u.is_banned ? '<span class="badge badge-banned">BAN中</span>' : '<span class="badge badge-active">有効</span>');
        html += `
          <tr>
            <td>
              <div style="font-weight:bold">@${escapeHtml(u.username)}</div>
              <div style="font-size:11px;color:var(--text-secondary)">ID: ${u.id}</div>
            </td>
            <td>
              <div>${d}</div>
              <div style="font-size:11px;color:var(--text-secondary)">IP: <a href="javascript:void(0)" onclick="showIpUsers('${escapeHtml(u.registration_ip)}')" style="color:inherit;text-decoration:underline">${escapeHtml(u.registration_ip)}</a><button class="btn-ip-log" onclick="showIpLogs(${u.id}, '${escapeHtml(u.username)}')" title="IP履歴"><span class="material-icons" style="font-size:14px">history</span></button></div>
            </td>
            <td>
              <div>${badge}</div>
              <div style="font-size:11px;color:var(--text-secondary)">警告: <a href="javascript:void(0)" onclick="showWarnings(${u.id}, '${escapeHtml(u.username)}')" style="color:inherit;text-decoration:underline">${u.warning_count}回</a></div>
            </td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn-sm btn-warn" onclick="openWarnModal(${u.id}, '${escapeHtml(u.username)}')" title="警告送信"><span class="material-icons">warning</span></button>
                ${u.is_banned ? `<button class="btn-sm btn-unban" onclick="unbanUser(${u.id}, '${escapeHtml(u.username)}')" title="BAN解除"><span class="material-icons">check_circle</span></button>` : `<button class="btn-sm btn-ban" onclick="openBanModal(${u.id}, '${escapeHtml(u.username)}')" title="BAN実行"><span class="material-icons">block</span></button>`}
                <button class="btn-sm btn-delete" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" title="完全削除"><span class="material-icons">delete</span></button>
              </div>
            </td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
      userList.innerHTML = html;
    }
  } catch (err) {
    container.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function renderAdminReports(container) {
  try {
    const reports = await fetchAPI('/admin/reports');
    container.innerHTML = `
      <h3 style="margin-bottom:16px">通報管理</h3>
      <div id="adminReportList"></div>
    `;
    const reportList = document.getElementById('adminReportList');
    if (reports.length === 0) {
      reportList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">現在通報はありません</div>`;
    } else {
      let html = `
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>通報者</th>
                <th>対象</th>
                <th>内容</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
      `;
      reports.forEach(r => {
        html += `
          <tr>
            <td>@${escapeHtml(r.reporter_username)}</td>
            <td>
              ${r.reported_user_username ? `ユーザー: @${escapeHtml(r.reported_user_username)}` : `単語帳: <a href="#/wordbook/${r.reported_wordbook_id}">${escapeHtml(r.reported_wordbook_title)}</a>`}
            </td>
            <td>${escapeHtml(r.reason)}</td>
            <td>${new Date(r.created_at).toLocaleString('ja-JP')}</td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
      reportList.innerHTML = html;
    }
  } catch (err) {
    container.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

// 警告モーダル
window.openWarnModal = (userId, username) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:400px">
      <div class="modal-header">
        <h2 style="font-size:18px">@${username} に警告を送信</h2>
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
      </div>
      <form id="warnForm" style="padding-top:16px">
        <label style="color:var(--text-secondary);font-size:14px">警告理由</label>
        <textarea id="warnReason" required placeholder="警告の理由を入力..." style="height:100px;resize:none"></textarea>
        <div id="warnError" class="error-msg"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:8px">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">キャンセル</button>
          <button type="submit" class="btn-primary" style="background:#f59e0b">警告を送信</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('warnForm').onsubmit = async (e) => {
    e.preventDefault();
    const reason = document.getElementById('warnReason').value;
    try {
      await fetchAPI(`/admin/users/${userId}/warn`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      overlay.remove();
      router();
    } catch (err) {
      document.getElementById('warnError').textContent = err.message;
    }
  };
};

// BANモーダル
window.openBanModal = (userId, username) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:400px">
      <div class="modal-header">
        <h2 style="font-size:18px">@${username} をBANする</h2>
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
      </div>
      <form id="banForm" style="padding-top:16px">
        <label style="color:var(--text-secondary);font-size:14px">BAN理由（任意）</label>
        <textarea id="banReason" placeholder="BANの理由を入力..." style="height:100px;resize:none"></textarea>
        <div id="banError" class="error-msg"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:8px">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">キャンセル</button>
          <button type="submit" class="btn-primary" style="background:#ef4444">BANする</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('banForm').onsubmit = async (e) => {
    e.preventDefault();
    const reason = document.getElementById('banReason').value;
    try {
      await fetchAPI(`/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      overlay.remove();
      router();
    } catch (err) {
      document.getElementById('banError').textContent = err.message;
    }
  };
};

// BAN解除
window.unbanUser = async (userId) => {
  if (!confirm('このユーザーのBANを解除しますか？')) return;
  try {
    await fetchAPI(`/admin/users/${userId}/unban`, { method: 'POST' });
    router();
  } catch (err) {
    alert(err.message);
  }
};

// 警告履歴表示
window.showWarnings = async (userId, username) => {
  try {
    const warnings = await fetchAPI(`/admin/users/${userId}/warnings`);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width:500px">
        <div class="modal-header">
          <h2 style="font-size:18px">@${username} の警告履歴</h2>
          <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
        </div>
        <div style="padding-top:16px;max-height:400px;overflow-y:auto">
          ${warnings.length === 0
        ? '<p style="color:var(--text-secondary);text-align:center;padding:16px">警告履歴はありません。</p>'
        : warnings.map(w => `
              <div style="padding:12px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-size:14px;margin-bottom:4px">${w.reason}</div>
                  <div style="font-size:12px;color:var(--text-secondary)">
                    ${new Date(w.created_at).toLocaleString('ja-JP')} - by @${w.admin_username}
                  </div>
                </div>
                <button class="btn-sm" style="color:var(--error-color)" onclick="deleteWarning(${w.id})">
                  <span class="material-icons" style="font-size:16px">delete</span>
                </button>
              </div>
            `).join('')
      }
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    alert(err.message);
  }
};

// 警告削除
window.deleteWarning = async (warningId) => {
  if (!confirm('この警告を削除しますか？')) return;
  try {
    await fetchAPI(`/admin/warnings/${warningId}`, { method: 'DELETE' });
    document.querySelector('.modal-overlay')?.remove();
    router();
  } catch (err) {
    alert(err.message);
  }
};

// ユーザー削除
window.deleteUser = async (userId, username) => {
  if (!confirm(`@${username} を完全に削除しますか？\n\nこの操作は取り消せません。ユーザーの単語帳やコメントも全て削除されます。`)) return;
  try {
    await fetchAPI(`/admin/users/${userId}`, { method: 'DELETE' });
    window.location.hash = '#/';
  } catch (err) {
    alert(err.message);
  }
};

// 管理者ドロップダウンメニュー切り替え
window.toggleAdminMenu = (event) => {
  event.stopPropagation();
  const menu = document.getElementById('adminDropdownMenu');
  if (menu) {
    menu.classList.toggle('show');
  }
};

// メニュー外クリックで閉じる
document.addEventListener('click', () => {
  const menu = document.getElementById('adminDropdownMenu');
  if (menu) menu.classList.remove('show');
});

// IPアクティビティログ表示
window.showIpLogs = async (userId, username) => {
  try {
    const logs = await fetchAPI(`/admin/users/${userId}/ip-logs`);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width:600px">
        <div class="modal-header">
          <h2 style="font-size:18px">@${username} のIPアクティビティ</h2>
          <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
        </div>
        <div style="padding-top:16px;max-height:400px;overflow-y:auto">
          ${logs.length === 0
        ? '<p style="color:var(--text-secondary);text-align:center;padding:16px">アクティビティログはありません。</p>'
        : `<table class="admin-table" style="font-size:13px">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>アクション</th>
                    <th>IPアドレス</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(log => `
                    <tr>
                      <td>${new Date(log.created_at).toLocaleString('ja-JP')}</td>
                      <td>
                        <span class="badge ${log.action === 'register' ? 'badge-admin' : 'badge-active'}">
                          ${log.action === 'register' ? '登録' : 'ログイン'}
                        </span>
                      </td>
                      <td>
                        <span style="font-family:monospace;cursor:pointer;color:var(--accent-color)" 
                              onclick="this.closest('.modal-overlay').remove(); showIpUsers('${log.ip_address}')">
                          ${log.ip_address}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
      }
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    alert(err.message);
  }
};

// 同じIPのユーザー一覧表示
window.showIpUsers = async (ip) => {
  try {
    const users = await fetchAPI(`/admin/ip/${encodeURIComponent(ip)}/users`);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width:500px">
        <div class="modal-header">
          <h2 style="font-size:18px">IP: ${ip} のユーザー</h2>
          <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
        </div>
        <div style="padding-top:16px;max-height:400px;overflow-y:auto">
          ${users.length === 0
        ? '<p style="color:var(--text-secondary);text-align:center;padding:16px">このIPからのユーザーはいません。</p>'
        : `<div style="margin-bottom:12px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;font-size:13px">
                <strong>${users.length}人</strong>のユーザーがこのIPを使用
              </div>
              ${users.map(u => `
                <div style="padding:12px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <a href="#/user/${escapeHtml(u.username)}" style="color:var(--accent-color);font-weight:bold"
                       onclick="this.closest('.modal-overlay').remove()">@${escapeHtml(u.username)}</a>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
                      登録: ${new Date(u.created_at).toLocaleDateString('ja-JP')} · アクティビティ: ${u.activity_count}回
                    </div>
                  </div>
                  ${u.is_banned ? '<span class="badge badge-banned">BAN</span>' : ''}
                </div>
              `).join('')}`
      }
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    alert(err.message);
  }
};

// === いいね機能 ===
let isLikeProcessing = false;

async function loadLikeInfo(wordbookId, likeBtn) {
  try {
    const likes = await fetchAPI(`/wordbooks/${wordbookId}/likes`);
    const countSpan = likeBtn.querySelector('.like-count');
    const icon = likeBtn.querySelector('.material-icons');

    if (countSpan) countSpan.textContent = likes.like_count;

    if (icon) {
      if (likes.liked_by_current_user) {
        icon.textContent = 'favorite';
        likeBtn.classList.add('liked');
      } else {
        icon.textContent = 'favorite_border';
        likeBtn.classList.remove('liked');
      }
    }
  } catch (err) {
    console.error('いいね情報の読み込みに失敗しました:', err);
  }
}

async function toggleLike(wordbookId, element) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('ログインしてください');
    return;
  }

  if (isLikeProcessing) return;
  isLikeProcessing = true;

  const icon = element.querySelector('.material-icons');
  const countSpan = element.querySelector('.like-count');
  const isCurrentlyLiked = element.classList.contains('liked');

  // Optimistic UI Update
  try {
    if (isCurrentlyLiked) {
      element.classList.remove('liked');
      icon.textContent = 'favorite_border';
      countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
    } else {
      element.classList.add('liked');
      icon.textContent = 'favorite';
      countSpan.textContent = parseInt(countSpan.textContent) + 1;
    }

    if (isCurrentlyLiked) {
      await fetchAPI(`/wordbooks/${wordbookId}/like`, { method: 'DELETE' });
    } else {
      await fetchAPI(`/wordbooks/${wordbookId}/like`, { method: 'POST' });
    }
  } catch (err) {
    alert(err.message);
    // Rollback on error
    loadLikeInfo(wordbookId, element);
  } finally {
    isLikeProcessing = false;
  }
}

// === ブックマーク機能 ===
let isBookmarkProcessing = false;

async function loadBookmarkInfo(wordbookId, bookmarkBtn) {
  try {
    const res = await fetchAPI(`/wordbooks/${wordbookId}/bookmark-status`);
    const icon = bookmarkBtn.querySelector('.material-icons');
    if (icon) {
      if (res.is_bookmarked) {
        icon.textContent = 'bookmark';
        icon.style.color = 'var(--accent-color)';
        bookmarkBtn.classList.add('bookmarked');
      } else {
        icon.textContent = 'bookmark_border';
        icon.style.color = 'var(--text-secondary)';
        bookmarkBtn.classList.remove('bookmarked');
      }
    }
  } catch (err) {
    console.error('ブックマーク情報の読み込みに失敗しました:', err);
  }
}

async function toggleBookmark(wordbookId, element) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('ログインしてください');
    return;
  }

  if (isBookmarkProcessing) return;
  isBookmarkProcessing = true;

  const icon = element.querySelector('.material-icons');
  const isBookmarked = element.classList.contains('bookmarked');

  // Optimistic UI Update
  try {
    if (isBookmarked) {
      element.classList.remove('bookmarked');
      icon.textContent = 'bookmark_border';
      icon.style.color = 'var(--text-secondary)';
    } else {
      element.classList.add('bookmarked');
      icon.textContent = 'bookmark';
      icon.style.color = 'var(--accent-color)';
    }

    if (isBookmarked) {
      await fetchAPI(`/wordbooks/${wordbookId}/bookmark`, { method: 'DELETE' });
    } else {
      await fetchAPI(`/wordbooks/${wordbookId}/bookmark`, { method: 'POST' });
    }
  } catch (err) {
    alert(err.message);
    loadBookmarkInfo(wordbookId, element);
  } finally {
    isBookmarkProcessing = false;
  }
}

async function renderBookmarkedFeed(container, token, user) {
  // フィルター状態
  const bookmarkFilters = {
    uncompleted: false,
    unstudied: false,
    mistakes: false
  };

  container.innerHTML = `
    <div class="header">
      <h2><span class="material-icons" style="vertical-align:middle;margin-right:8px;color:var(--accent-color)">bookmark</span>ブックマーク</h2>
    </div>
    <div class="filter-bar" style="padding:12px 16px; display:flex; gap:12px; border-bottom:1px solid var(--border-color); flex-wrap:wrap">
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none">
        <input type="checkbox" id="filterUncompleted" style="display:none">
        <span class="material-icons" style="font-size:16px">check_circle_outline</span> 未完了
      </label>
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none">
        <input type="checkbox" id="filterUnstudied" style="display:none">
        <span class="material-icons" style="font-size:16px">history</span> 未学習
      </label>
      <label class="filter-label" style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:16px; background:var(--bg-secondary); font-size:13px; transition:0.2s; border:1px solid var(--border-color); user-select:none">
        <input type="checkbox" id="filterMistakes" style="display:none">
        <span class="material-icons" style="font-size:16px">error_outline</span> 間違えあり
      </label>
    </div>
    <div id="feedList"></div>
  `;

  const renderFeed = async () => {
    const feedList = document.getElementById('feedList');
    if (!feedList) return;
    feedList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">読み込み中...</div>`;

    try {
      const params = new URLSearchParams();
      if (bookmarkFilters.uncompleted) params.append('uncompleted', 'true');
      if (bookmarkFilters.unstudied) params.append('unstudied', 'true');
      if (bookmarkFilters.mistakes) params.append('mistakes', 'true');

      const wordbooks = await fetchAPI(`/wordbooks/bookmarked?${params.toString()}`);
      feedList.innerHTML = '';

      if (wordbooks.length === 0) {
        feedList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">条件に一致する単語帳はありません。</div>`;
        return;
      }

      wordbooks.forEach(wb => {
        const card = document.createElement('div');
        card.className = 'feed-card';
        card.onclick = () => window.location.hash = `#/wordbook/${wb.id}`;

        // タグ表示
        const tags = wb.tags || [];
        const tagsHtml = tags.length > 0 ? `
          <div class="card-tags" onclick="event.stopPropagation()">
            ${tags.map(t => `<a href="#/?tag=${encodeURIComponent(t)}" class="tag-chip">#${t}</a>`).join('')}
          </div>
        ` : '';

        let completionBadge = wb.is_completed ? `
          <div class="badge-completed" style="margin-left:auto">
            <span class="material-icons" style="font-size:14px">check_circle</span>
            完了
          </div>
        ` : '';

        card.innerHTML = `
          <div class="card-header">
            <div class="avatar" style="width:24px; height:24px; font-size:12px" onclick="event.stopPropagation(); window.location.hash='#/user/${escapeHtml(wb.username)}'">
              ${safeAvatarUrl(wb.avatar_url) ? `<img src="${safeAvatarUrl(wb.avatar_url)}" alt="">` : escapeHtml(wb.username.charAt(0).toUpperCase())}
            </div>
            <span class="card-author" onclick="event.stopPropagation(); window.location.hash='#/user/${escapeHtml(wb.username)}'">${escapeHtml(wb.username)}</span>
            ${completionBadge}
          </div>
          <h3 class="card-title">${escapeHtml(wb.title)}</h3>
          ${wb.description ? `<p class="card-desc">${escapeHtml(wb.description)}</p>` : ''}
          ${tagsHtml}
          <div class="card-stats">
            <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">library_books</span>${wb.word_count || 0}</span>
            <span><span class="material-icons" style="vertical-align:middle;font-size:16px;margin-right:4px">visibility</span>${wb.view_count || 0}</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px; margin-left:-12px">
            <div class="like-btn" data-wordbook-id="${wb.id}">
              <span class="material-icons" style="font-size:16px">favorite_border</span>
              <span class="like-count">0</span>
            </div>
            <div class="bookmark-btn" data-wordbook-id="${wb.id}" style="cursor:pointer; padding:6px; border-radius:50%; display:flex; align-items:center; transition: background-color 0.2s">
              <span class="material-icons" style="font-size:16px; color:var(--text-secondary)">bookmark_border</span>
            </div>
          </div>
        `;

        // 共通処理
        const likeBtn = card.querySelector('.like-btn');
        if (likeBtn) {
          loadLikeInfo(wb.id, likeBtn);
          likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(wb.id, likeBtn); };
        }
        const bookmarkBtn = card.querySelector('.bookmark-btn');
        if (bookmarkBtn) {
          loadBookmarkInfo(wb.id, bookmarkBtn);
          bookmarkBtn.onclick = (e) => { e.stopPropagation(); toggleBookmark(wb.id, bookmarkBtn); };
        }

        feedList.appendChild(card);
      });
    } catch (err) {
      feedList.innerHTML = `<div class="error-msg" style="padding:16px">${err.message}</div>`;
    }
  };

  // イベント登録
  const setupFilter = (id, key) => {
    const el = document.getElementById(id);
    const label = el.parentElement;
    el.onchange = () => {
      bookmarkFilters[key] = el.checked;
      if (el.checked) {
        label.style.background = 'rgba(59, 130, 246, 0.1)';
        label.style.borderColor = 'var(--accent-color)';
        label.style.color = 'var(--accent-color)';
      } else {
        label.style.background = 'var(--bg-secondary)';
        label.style.borderColor = 'var(--border-color)';
        label.style.color = 'var(--text-primary)';
      }
      renderFeed();
    };
  };

  setupFilter('filterUncompleted', 'uncompleted');
  setupFilter('filterUnstudied', 'unstudied');
  setupFilter('filterMistakes', 'mistakes');

  renderFeed();
}

// === 利用規約 ===
function renderTermsOfService(container) {
  container.innerHTML = `
    <div style="max-width:900px; margin:0 auto; padding:32px 16px">
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px">
        <button onclick="history.back()" style="background:none; border:none; cursor:pointer; padding:0">
          <span class="material-icons">arrow_back</span>
        </button>
        <h1>利用規約</h1>
      </div>
      
      <div style="background:var(--bg-secondary); padding:24px; border-radius:16px; line-height:1.8; color:var(--text-primary)">
        <p><strong>最終更新日: 2026年2月23日</strong></p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第1条 はじめに</h2>
        <p>
          TangoSNS（以下「本サービス」）は、ユーザーが単語帳を作成・共有し、
          コミュニティを通じて学習する場を提供するサービスです。
          本利用規約（以下「本規約」）は、本サービスの利用条件を定めます。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第2条 利用者の定義</h2>
        <p>
          本サービスは、13歳以上の個人および法人（以下「ユーザー」）を対象としています。
          13歳未満の方はご利用いただけません。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第3条 ユーザーの責務</h2>
        <p>ユーザーは以下の行為を行わないことに同意します:</p>
        <ul style="margin-left:20px">
          <li>他のユーザーの名誉や信用を傷つける行為</li>
          <li>違法行為や不正行為</li>
          <li>スパムや詐欺的な内容の投稿</li>
          <li>著作権または知的財産権の侵害</li>
          <li>本サービスのセキュリティを妨害する行為</li>
          <li>他のユーザーへの嫌がらせまたはいじめ</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第4条 コンテンツの所有権</h2>
        <p>
          ユーザーが投稿した単語帳、単語、コメント等（以下「ユーザーコンテンツ」）の
          著作権はユーザーに帰属します。ただし、本サービスの運営・改善のため、
          本サービスにユーザーコンテンツの利用許諾を与えるものとします。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第5条 利用禁止事項</h2>
        <p>以下の行為は禁止されています:</p>
        <ul style="margin-left:20px">
          <li>本サービスの改ざん、破壊</li>
          <li>自動化ツールやボットによるアクセス（公式APIの利用を除く）</li>
          <li>他のユーザーのアカウント情報の不正取得</li>
          <li>本サービスへの過度なアクセス（DDoS攻撃等）</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第6条 アカウント停止・削除</h2>
        <p>
          本規約に違反する行為が確認された場合、
          事前通知なくアカウントを停止・削除する場合があります。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第7条 免責事項</h2>
        <p>
          本サービスは「現状のまま」提供されます。
          本サービスの利用によって生じた損害について、
          サービス提供者は一切責任を負いません。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第8条 規約の変更</h2>
        <p>
          本規約は予告なく変更される場合があります。
          変更後の規約に同意されない場合は、本サービスのご利用をお断りください。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第9条 準拠法</h2>
        <p>本規約は日本法に準拠し、日本の裁判所を管轄とします。</p>
        
        <p style="margin-top:32px; text-align:center; color:var(--text-secondary); font-size:12px">
          ご不明な点がある場合は、お問合わせください。
        </p>
      </div>
    </div>
  `;
}

// === プライバシーポリシー ===
function renderPrivacyPolicy(container) {
  container.innerHTML = `
    <div style="max-width:900px; margin:0 auto; padding:32px 16px">
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:24px">
        <button onclick="history.back()" style="background:none; border:none; cursor:pointer; padding:0">
          <span class="material-icons">arrow_back</span>
        </button>
        <h1>プライバシーポリシー</h1>
      </div>
      
      <div style="background:var(--bg-secondary); padding:24px; border-radius:16px; line-height:1.8; color:var(--text-primary)">
        <p><strong>最終更新日: 2026年2月23日</strong></p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第1条 個人情報の収集</h2>
        <p>本サービス利用時に、以下の情報を収集します:</p>
        <ul style="margin-left:20px">
          <li><strong>登録情報:</strong> ユーザー名、パスワード、メールアドレス（取得時）</li>
          <li><strong>プロフィール情報:</strong> プロフィール写真、自己紹介</li>
          <li><strong>アクティビティ情報:</strong> 学習履歴、作成した単語帳、コメント</li>
          <li><strong>アクセスログ:</strong> IPアドレス、アクセス日時、ブラウザ情報</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第2条 個人情報の利用目的</h2>
        <p>収集した個人情報は以下の目的で使用します:</p>
        <ul style="margin-left:20px">
          <li>本サービスの提供・改善</li>
          <li>ユーザーサポートの実施</li>
          <li>不正行為の検知・防止</li>
          <li>サービス利用統計の作成（匿名化）</li>
          <li>重要なお知らせの配信</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第3条 情報の安全管理</h2>
        <p>
          パスワードはハッシュ化して保存されます。
          HTTPS通信により、データ送受信時の安全性を確保しています。
          ただし、インターネット上の通信に絶対の安全性はないことをご理解ください。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第4条 ビュー数とアクティビティ記録</h2>
        <p>
          本サービスは単語帳のビュー数を記録します。
          ログイン済みユーザーの場合、ユーザーIDで識別します。
          ゲストユーザーの場合、IPアドレス・ポート番号で識別します。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第5条 情報の第三者提供</h2>
        <p>
          本サービスは、ユーザーの同意を得ずに第三者に個人情報を提供しません。
          ただし、以下の場合は例外とします:
        </p>
        <ul style="margin-left:20px">
          <li>法律上の要求に基づく場合</li>
          <li>不正行為の調査・防止に必要と判断される場合</li>
          <li>ユーザーの生命・身体・財産の危険から保護する必要がある場合</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第6条 Cookie・トラッキング</h2>
        <p>
          本サービスはローカルストレージを利用して、
          ユーザー認証情報やテーマ設定を保存します。
          これは個人を特定できない形式です。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第7条 データの保有期間</h2>
        <p>
          ゲストユーザーのビュー履歴（IP+ポート）は30日後に自動削除されます。
          アカウント削除時は、ユーザーコンテンツを除いて個人情報は削除されます。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第8条 ユーザーの権利</h2>
        <p>ユーザーは以下の権利を有します:</p>
        <ul style="margin-left:20px">
          <li>個人情報の開示請求</li>
          <li>個人情報の修正・削除要求</li>
          <li>アカウントの削除</li>
        </ul>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第9条 お問合わせ</h2>
        <p>
          本ポリシーについてのご質問・ご不明な点がある場合は、
          お気軽にお問合わせください。
        </p>
        
        <h2 style="margin-top:32px; margin-bottom:16px; font-size:18px">第10条 ポリシーの変更</h2>
        <p>
          本ポリシーは予告なく変更される場合があります。
          変更時は本ページにて通知いたします。
        </p>
        
        <p style="margin-top:32px; text-align:center; color:var(--text-secondary); font-size:12px">
          ご質問・ご要望はいつでもお受けしております。
        </p>
      </div>
    </div>
  `;
}

// === フォロー機能 ===
window.toggleFollow = async (userId, btn) => {
  try {
    const userSnapshot = JSON.parse(localStorage.getItem('user'));
    if (!userSnapshot) {
      window.location.hash = '#/login';
      return;
    }

    const isFollowing = btn.textContent.trim() === 'フォロー中';
    if (isFollowing) {
      await fetchAPI(`/follows/${userId}`, { method: 'DELETE' });
      btn.textContent = 'フォローする';
      btn.style.background = 'var(--accent-color)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--accent-color)';
    } else {
      await fetchAPI(`/follows/${userId}`, { method: 'POST' });
      btn.textContent = 'フォロー中';
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-primary)';
      btn.style.borderColor = 'var(--border-color)';
    }
    // カウントの更新のためにページを再取得
    const hash = window.location.hash;
    if (hash.startsWith('#/user/')) {
      const username = hash.split('/')[2];
      await renderUserProfile(document.querySelector('.main'), username, localStorage.getItem('token'));
    } else if (hash === '#/profile') {
      await renderMyProfile(document.querySelector('.main'), localStorage.getItem('token'), userSnapshot);
    }
  } catch (err) {
    alert(err.message);
  }
};

window.viewFollowers = async (userId, username) => {
  try {
    const followers = await fetchAPI(`/follows/${userId}/followers`);
    showUserListModal(`@${username} のフォロワー`, followers);
  } catch (err) {
    alert(err.message);
  }
};

window.viewFollowing = async (userId, username) => {
  try {
    const following = await fetchAPI(`/follows/${userId}/following`);
    showUserListModal(`@${username} がフォロー中`, following);
  } catch (err) {
    alert(err.message);
  }
};

window.showUserListModal = (title, users) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 500px">
      <div class="modal-header">
        <h2 style="font-size:20px">${escapeHtml(title)}</h2>
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
      </div>
      <div class="user-list" style="max-height: 400px; overflow-y: auto; margin-top: 16px;">
        ${users.length === 0 ? '<div style="padding:16px; text-align:center; color:var(--text-secondary)">ユーザーがいません。</div>' : users.map(u => `
          <div class="user-list-item" onclick="window.location.hash='#/user/${escapeHtml(u.username)}'; this.closest('.modal-overlay').remove()" style="display:flex; align-items:center; gap:12px; padding:12px; cursor:pointer; border-bottom:1px solid var(--border-color)">
            <div class="avatar" style="width:40px; height:40px">
              ${safeAvatarUrl(u.avatar_url) ? `<img src="${safeAvatarUrl(u.avatar_url)}" alt="">` : escapeHtml(u.username.charAt(0).toUpperCase())}
            </div>
            <div style="flex:1">
              <div style="font-weight:bold">${escapeHtml(u.username)}</div>
              <div style="font-size:12px; color:var(--text-secondary)">@${escapeHtml(u.username)}</div>
              <div style="font-size:13px; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(u.bio || '')}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

// === 通報機能 ===
window.openReportModal = ({ user_id, wordbook_id }) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 400px">
      <div class="modal-header">
        <h2 style="font-size:20px">通報する</h2>
        <button onclick="this.closest('.modal-overlay').remove()"><span class="material-icons">close</span></button>
      </div>
      <p style="font-size:14px; color:var(--text-secondary); margin-bottom:16px">通報の理由を入力してください。</p>
      <textarea id="reportReason" placeholder="例: 不適切なコンテンツ、誹謗中傷など" style="height:100px; margin-bottom:16px"></textarea>
      <div id="reportError" class="error-msg" style="margin-bottom:12px"></div>
      <button class="btn-primary btn-wide" onclick="submitReport(this, {user_id: ${user_id ? user_id : 'null'}, wordbook_id: ${wordbook_id ? wordbook_id : 'null'}})">送信する</button>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.submitReport = async (btn, { user_id, wordbook_id }) => {
  const reason = document.getElementById('reportReason').value.trim();
  const errorDiv = document.getElementById('reportError');

  if (!reason) {
    errorDiv.textContent = '理由を入力してください';
    return;
  }

  btn.disabled = true;
  btn.textContent = '送信中...';

  try {
    await fetchAPI('/reports', {
      method: 'POST',
      body: JSON.stringify({
        reported_user_id: user_id,
        reported_wordbook_id: wordbook_id,
        reason
      })
    });
    alert('通報を送信しました。不適切なコンテンツの抑制にご協力いただきありがとうございます。');
    btn.closest('.modal-overlay').remove();
  } catch (err) {
    errorDiv.textContent = err.message;
    btn.disabled = false;
    btn.textContent = '送信する';
  }
};
