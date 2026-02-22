const API_BASE = '/api';

// ルーター関数
const router = async () => {
  const hash = window.location.hash || '#/';
  const appDiv = document.getElementById('app');
  appDiv.innerHTML = ''; // クリア

  // 認証の確認
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // 未ログイン時のアクセス制限
  if (!token && hash !== '#/login' && hash !== '#/register') {
    renderLanding(appDiv);
    return;
  }

  // 画面描画
  if (hash === '#/login') {
    renderLogin(appDiv);
  } else if (hash === '#/register') {
    renderRegister(appDiv);
  } else if (hash === '#/') {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderHomeFeed(layout.querySelector('.main'), token);
  } else if (hash.startsWith('#/wordbook/')) {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    const id = hash.split('/')[2];
    await renderWordbookDetail(layout.querySelector('.main'), id, token, user);
  } else if (hash === '#/profile') {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderProfileEdit(layout.querySelector('.main'), token, user);
  } else if (hash === '#/history') {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    await renderHistory(layout.querySelector('.main'));
  } else if (hash.startsWith('#/user/')) {
    const layout = createLayout(user);
    appDiv.appendChild(layout);
    const username = hash.split('/')[2];
    await renderUserProfile(layout.querySelector('.main'), username, token);
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
})();

// === レイアウト (サイドバー含む) ===
function createLayout(user) {
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
        <a href="#/profile" class="nav-link"><span class="material-icons">person</span> プロフィール</a>
      </div>
      <button class="btn-primary btn-wide sidebar-btn" onclick="openCreateModal()">単語帳を作成</button>
      
      <div class="user-menu" onclick="window.location.hash='#/profile'">
        <div class="avatar">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : user.username.charAt(0).toUpperCase()}
        </div>
        <div class="user-info">
          <div class="user-name">${user.username}</div>
          <div class="user-handle">@${user.username}</div>
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
        <h3 style="margin-bottom: 12px">おすすめ</h3>
        <p style="color: var(--text-secondary); font-size: 14px;">単語帳を作って、みんなと共有しましょう！学習を習慣化する第一歩です。</p>
      </div>
    </div>
  `;
  return container;
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
async function renderHomeFeed(container) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const q = urlParams.get('q');

  let headerTitle = q ? `検索結果: ${q}` : 'ホーム';
  container.innerHTML = `
    <div class="header">
      <h2>${headerTitle}</h2>
      ${q ? '<a href="#/" style="font-size:14px">クリア</a>' : ''}
    </div>
    <div id="feedList"></div>
  `;

  try {
    const url = q ? `/wordbooks?q=${encodeURIComponent(q)}` : '/wordbooks';
    const wordbooks = await fetchAPI(url);
    const feedList = document.getElementById('feedList');

    if (wordbooks.length === 0) {
      feedList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">まだ単語帳がありません。最初の単語帳を作成しましょう！</div>`;
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

      card.innerHTML = `
        <div class="card-header">
          <div class="avatar" style="width:24px;height:24px;font-size:12px" onclick="event.stopPropagation(); window.location.hash='#/user/${wb.username}'">
            ${wb.avatar_url ? `<img src="${wb.avatar_url}" alt="">` : wb.username.charAt(0).toUpperCase()}
          </div>
          <span class="card-author" onclick="event.stopPropagation(); window.location.hash='#/user/${wb.username}'">${wb.username}</span>
          <span>·</span>
          <span>${d}</span>
          ${completionBadge}
        </div>
        <h3 class="card-title">${wb.title}</h3>
        ${wb.description ? `<p class="card-desc">${wb.description}</p>` : ''}
      `;
      feedList.appendChild(card);
    });
  } catch (err) {
    container.innerHTML += `<div class="error-msg" style="padding:16px">${err.message}</div>`;
  }
}

// === マイプロフィール編集 ===
async function renderProfileEdit(container, token, user) {
  container.innerHTML = `
    <div class="header">
      <h2>プロフィールを編集</h2>
    </div>
    <div style="padding: 24px;">
      <form id="profileForm" style="display:flex; flex-direction:column; gap:16px;">
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
          <textarea id="bio" placeholder="自分の情報を入力..." style="height:100px;">${user.bio || ''}</textarea>
        </div>
        <div>
          <label style="color:var(--text-secondary);font-size:14px">テーマ設定</label>
          <select id="theme" style="width:100%; padding:10px; border-radius:4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color)">
            <option value="system" ${user.theme === 'system' ? 'selected' : ''}>システム設定に従う</option>
            <option value="light" ${user.theme === 'light' ? 'selected' : ''}>ライト</option>
            <option value="dark" ${user.theme === 'dark' ? 'selected' : ''}>ダーク</option>
          </select>
        </div>
        <div style="margin-top:24px; padding-top:24px; border-top:1px solid var(--border-color)">
          <h3 style="margin-bottom:16px">パスワード変更</h3>
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
        <div id="profileError" class="error-msg"></div>
        <div id="profileSuccess" style="color:#00ba7c; font-size:14px; margin-top:8px"></div>
      </form>
    </div>
  `;

  document.getElementById('profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const avatar_url = e.target.avatar_url.value;
    const bio = e.target.bio.value;
    const theme = e.target.theme.value;
    const currentPassword = e.target.currentPassword.value;
    const newPassword = e.target.newPassword.value;

    const payload = { username, avatar_url, bio, theme };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const updatedUser = await fetchAPI('/users/me', {
        method: 'PUT', body: JSON.stringify(payload)
      });
      localStorage.setItem('user', JSON.stringify(updatedUser)); // update local storage
      applyTheme(updatedUser.theme); // 即座にテーマを反映
      document.getElementById('profileError').textContent = '';
      document.getElementById('profileSuccess').textContent = 'プロフィールを更新しました。';
      setTimeout(() => {
        router(); // レイアウトの再描画（アバター反映のため）
        window.location.hash = '#/';
      }, 1500);
    } catch (err) {
      document.getElementById('profileSuccess').textContent = '';
      document.getElementById('profileError').textContent = err.message;
    }
  };
}

// === 単語帳作成モーダル ===
window.openCreateModal = () => {
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
      <div id="createError" class="error-msg"></div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.submitWordbook = async (btn) => {
  const container = btn.closest('.modal-overlay');
  const title = container.querySelector('#wb-title').value;
  const description = container.querySelector('#wb-desc').value;

  try {
    const wb = await fetchAPI('/wordbooks', {
      method: 'POST', body: JSON.stringify({ title, description })
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
    const isOwner = wb.user_id === user.id;
    const words = await fetchAPI(`/wordbooks/${wbId}/words`);

    let html = `
      <div class="header" style="justify-content:flex-start; gap:24px">
        <button onclick="history.back()"><span class="material-icons">arrow_back</span></button>
        <h2>単語帳</h2>
      </div>
      <div style="padding: 16px; border-bottom: 1px solid var(--border-color);">
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px">
          <div class="avatar" style="width:48px;height:48px;cursor:pointer" onclick="window.location.hash='#/user/${wb.username}'">
            ${wb.avatar_url ? `<img src="${wb.avatar_url}" alt="">` : wb.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style="font-size:24px;">${wb.title}</h1>
            <p style="color:var(--text-secondary); cursor:pointer" onclick="window.location.hash='#/user/${wb.username}'">作成者: @${wb.username}</p>
          </div>
        </div>
        <p style="margin-bottom:16px; white-space:pre-wrap">${wb.description || ''}</p>
        ${wb.bio ? `<div style="padding:8px 12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:16px; font-size:13px; color:var(--text-secondary)">
          <div style="font-weight:bold; margin-bottom:4px">作成者の自己紹介:</div>
          <div>${wb.bio}</div>
        </div>` : ''}
        <div style="display:flex; gap:12px; margin-bottom:8px; align-items:center; flex-wrap:wrap">
          ${words.length > 0 ? `<button class="btn-primary" onclick='startStudy(${wb.id}, ${JSON.stringify(words).replace(/'/g, "&#39;")})'><span class="material-icons" style="vertical-align:middle;margin-right:8px">school</span>学習を始める</button>` : ''}
          <button class="btn-primary" style="background:transparent; border:1px solid var(--accent-color); color:var(--accent-color)" onclick="startMistakeStudy(${wb.id})"><span class="material-icons" style="vertical-align:middle;margin-right:8px">replay</span>間違えた単語を復習</button>
          
          <button id="toggleCompleteBtn" class="btn-primary" style="background:${wb.is_completed ? '#00ba7c' : 'transparent'}; border:1px solid ${wb.is_completed ? '#00ba7c' : 'var(--border-color)'}; color:${wb.is_completed ? 'white' : 'var(--text-secondary)'}">
            <span class="material-icons" style="vertical-align:middle;margin-right:8px">${wb.is_completed ? 'check_circle' : 'radio_button_unchecked'}</span>
            ${wb.is_completed ? '完了済み' : '完了にする'}
          </button>

          ${isOwner ? `<button class="btn-primary" style="background:transparent; border:1px solid var(--error-color); color:var(--error-color); margin-left:auto" onclick="deleteWordbook(${wb.id})">削除</button>` : ''}
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
      
      <div class="word-list" id="wordList"></div>
      
      <div style="border-top:1px solid var(--border-color); margin-top:16px; padding-top:16px">
        <h3 style="padding:0 16px; margin-bottom:16px;">コメント</h3>
        <form class="add-form" id="addCommentForm" style="border:none">
          <input type="text" id="newComment" placeholder="コメントを投稿..." required>
          <button type="submit" class="btn-primary" style="padding:8px 16px">返信</button>
        </form>
        <div id="commentList"></div>
      </div>
    `;
    container.innerHTML = html;

    // 単語一覧の描画
    const wl = document.getElementById('wordList');
    words.forEach(w => {
      wl.innerHTML += `
        <div class="word-item">
          <div>
            <div class="word">${w.word}</div>
            <div class="meaning">${w.meaning}</div>
          </div>
          ${isOwner ? `<button class="delete-btn" onclick="deleteWord(${wbId}, ${w.id})"><span class="material-icons">delete</span></button>` : ''}
        </div>
      `;
    });

    // コメント一覧の描画
    const comments = await fetchAPI(`/wordbooks/${wbId}/comments`);
    const cl = document.getElementById('commentList');
    comments.forEach(c => {
      const isCmdOwner = c.user_id === user.id;
      cl.innerHTML += `
        <div style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between">
          <div>
            <span style="font-weight:bold">${c.username}</span>
            <p style="margin-top:4px">${c.comment}</p>
          </div>
          ${isCmdOwner ? `<button class="delete-btn" onclick="deleteComment(${wbId}, ${c.id})"><span class="material-icons">delete</span></button>` : ''}
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

    document.getElementById('addCommentForm').onsubmit = async (e) => {
      e.preventDefault();
      const comment = e.target.newComment.value;
      try {
        await fetchAPI(`/wordbooks/${wbId}/comments`, { method: 'POST', body: JSON.stringify({ comment }) });
        renderWordbookDetail(container, wbId, token, user);
      } catch (err) { alert(err.message); }
    };

    // 完了トグルイベント
    document.getElementById('toggleCompleteBtn').onclick = async () => {
      try {
        if (wb.is_completed) {
          await fetchAPI(`/completions/${wbId}`, { method: 'DELETE' });
        } else {
          await fetchAPI(`/completions/${wbId}`, { method: 'POST' });
        }
        renderWordbookDetail(container, wbId, token, user);
      } catch (err) { alert(err.message); }
    };

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
    router(); // 再描画
  } catch (err) { alert(err.message); }
};
// === 学習履歴画面 ===
async function renderHistory(container) {
  container.innerHTML = `
    <div class="header" style="flex-direction:column; align-items:flex-start;">
      <h2>学習履歴</h2>
      <label style="margin-top:12px; display:flex; align-items:center; gap:8px; cursor:pointer;" id="filterMistakesLabel">
        <input type="checkbox" id="filterMistakesCheck" style="accent-color:var(--accent-color)">
        <span style="color:var(--text-secondary); font-size:14px">間違えた単語がある単語帳のみ表示</span>
      </label>
    </div>
    <div id="historyList"></div>
  `;

  try {
    const history = await fetchAPI('/study/history');
    const list = document.getElementById('historyList');

    if (history.length === 0) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">まだ学習履歴がありません。</div>`;
      return;
    }

    let allHistory = history;

    const renderList = (filterEnabled) => {
      list.innerHTML = '';
      const displayData = filterEnabled
        ? allHistory.filter(h => Number(h.mistakes_count) > 0)
        : allHistory;

      if (displayData.length === 0) {
        list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-secondary)">表示できる履歴がありません。</div>`;
        return;
      }

      displayData.forEach(h => {
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
    };

    // 初回描画
    renderList(false);

    // フィルタ切り替えイベント
    const checkbox = document.getElementById('filterMistakesCheck');
    checkbox.addEventListener('change', (e) => {
      renderList(e.target.checked);
    });

  } catch (err) {
    container.innerHTML += `<div class="error-msg" style="padding:16px">${err.message}</div>`;
  }
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

// === 学習機能 (Study Mode) ===
window.startStudy = (wbId, words, isReview = false) => {
  if (!words || words.length === 0) return;

  // ラウンド状態
  let currentWords = [...words]; // 今回の周回で解く単語
  let roundWrongs = [];          // 今回の周回で間違えた単語をプール
  let currentIndex = 0;          // 現在の周回内でのインデックス
  let isFlipped = false;

  const modal = document.createElement('div');
  modal.className = 'study-modal';

  const renderCard = () => {
    // 全問終了チェック
    if (currentIndex >= currentWords.length) {
      // APIへ結果送信 (非同期で投げておく)
      const wrongIds = roundWrongs.map(w => w.id || w.word_id);
      fetchAPI('/study/finish', {
        method: 'POST',
        body: JSON.stringify({ wordbookId: wbId, wrongWordIds: wrongIds })
      }).catch(err => console.error('学習記録の保存に失敗:', err));

      if (roundWrongs.length === 0) {
        // 完全クリア
        modal.innerHTML = `
            <div class="study-header">
              <h2 style="font-size:24px">クリア！</h2>
              <button onclick="this.closest('.study-modal').remove()"><span class="material-icons" style="font-size:32px">close</span></button>
            </div>
            <div class="study-body">
              <span class="material-icons" style="font-size:80px; color:#00ba7c; margin-bottom:16px">celebration</span>
              <h1 style="margin-bottom:24px">すべての単語をマスターしました！</h1>
              <button class="btn-primary" onclick="this.closest('.study-modal').remove()">一覧へ戻る</button>
            </div>
          `;
      } else {
        // 間違えた問題がある場合、次のラウンドへ
        modal.innerHTML = `
            <div class="study-header">
              <h2 style="font-size:24px">ラウンド終了</h2>
              <button onclick="this.closest('.study-modal').remove()"><span class="material-icons" style="font-size:32px">close</span></button>
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
          <button onclick="this.closest('.study-modal').remove()"><span class="material-icons">close</span></button>
        </div>
        <div class="study-body">
          <div class="study-progress">${currentIndex + 1} / ${currentWords.length}</div>
          
          <div class="flashcard-container" id="fcContainer">
            <div class="flashcard" id="fcInner">
              <div class="flashcard-face flashcard-front">${w.word}</div>
              <div class="flashcard-face flashcard-back">${w.meaning}</div>
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
      renderCard();
    };
    modal.querySelector('#btnWrong').onclick = () => {
      roundWrongs.push(w);
      currentIndex++;
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

    container.innerHTML = `
      <div class="header" style="justify-content:flex-start; gap:24px">
        <button onclick="history.back()"><span class="material-icons">arrow_back</span></button>
        <h2>${user.username}</h2>
      </div>
      
      <div class="profile-header">
        <div class="profile-banner"></div>
        <div class="profile-avatar-container">
          <div class="avatar">
            ${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : user.username.charAt(0).toUpperCase()}
          </div>
        </div>
        <div class="profile-name">${user.username}</div>
        <div class="profile-handle">@${user.username}</div>
        <div class="profile-bio">${user.bio || '自己紹介はまだありません。'}</div>
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
            <span class="card-author">${user.username}</span>
            <span>·</span>
            <span>${d}</span>
          </div>
          <h3 class="card-title">${wb.title}</h3>
          ${wb.description ? `<p class="card-desc">${wb.description}</p>` : ''}
        `;
        list.appendChild(card);
      });
    }

  } catch (err) {
    container.innerHTML = `<div class="error-msg" style="padding:32px">${err.message}</div>`;
  }
}
