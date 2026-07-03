// ── ID 생성 ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36) }

// ── 그룹 커버 색상 팔레트 ────────────────────────────────────────────────────
const COVER_COLORS = [
  { color: '#B8D4E8', label: '블루'     },
  { color: '#F2C4CE', label: '핑크'     },
  { color: '#C5E8C0', label: '그린'     },
  { color: '#D4C5F0', label: '라벤더'   },
  { color: '#F5D5C0', label: '피치'     },
  { color: '#F5E6A3', label: '옐로'     },
  { color: '#B8E8D4', label: '민트'     },
  { color: '#E8C5D4', label: '모브'     },
  { color: '#C0D4F5', label: '코발트'   },
  { color: '#E8D4B8', label: '샌드'     },
]

// ── 멤버 고유 파스텔 색 ───────────────────────────────────────────────────────
const MEMBER_PALETTE = [
  '#B8D4E8', // 파랑
  '#F2C4CE', // 핑크
  '#C5E8C0', // 초록
  '#D4C5F0', // 보라
  '#F5D5C0', // 피치
  '#F5E6A3', // 노랑
  '#B8E8D4', // 민트
  '#E8C5D4', // 모브
  '#C0D4F5', // 코발트
  '#E8D4B8', // 샌드
]
// index = 그룹 내 멤버 순서 (0, 1, 2...) — 겹치지 않음
function avatarStyle(index, isMe) {
  const bg = MEMBER_PALETTE[index % MEMBER_PALETTE.length]
  return isMe
    ? `background:${bg};box-shadow:0 0 0 2px var(--blue-dk)`
    : `background:${bg}`
}

// ── localStorage DB ─────────────────────────────────────────────────────────
const DB = {
  getMe()       { return JSON.parse(localStorage.getItem('gd_me') || 'null') },
  setMe(p)      { localStorage.setItem('gd_me', JSON.stringify(p)) },

  getGroups()   { return JSON.parse(localStorage.getItem('gd_groups') || '[]') },
  _saveGroups(gs){ localStorage.setItem('gd_groups', JSON.stringify(gs)) },

  getGroup(id)  { return DB.getGroups().find(g => g.id === id) ?? null },
  saveGroup(g) {
    const gs = DB.getGroups()
    const i = gs.findIndex(x => x.id === g.id)
    if (i >= 0) gs[i] = g; else gs.unshift(g)
    DB._saveGroups(gs)
    if (DB.isCloudGroup(g.id)) cloudPush(g.id).catch(() => {})
  },
  deleteGroup(id) { DB._saveGroups(DB.getGroups().filter(g => g.id !== id)) },

  addQuote(groupId, quote) {
    const g = DB.getGroup(groupId); if (!g) return
    g.quotes.push(quote); DB.saveGroup(g)
  },
  deleteQuote(groupId, quoteId) {
    const g = DB.getGroup(groupId); if (!g) return
    g.quotes = g.quotes.filter(q => q.id !== quoteId); DB.saveGroup(g)
  },

  addQuestion(groupId, q) {
    const g = DB.getGroup(groupId); if (!g) return
    g.questions.push(q); DB.saveGroup(g)
  },

  addReply(groupId, quoteId, reply) {
    const g = DB.getGroup(groupId); if (!g) return
    const q = g.quotes.find(q => q.id === quoteId); if (!q) return
    if (!q.replies) q.replies = []
    q.replies.push(reply); DB.saveGroup(g)
  },
  deleteReply(groupId, quoteId, replyId) {
    const g = DB.getGroup(groupId); if (!g) return
    const q = g.quotes.find(q => q.id === quoteId); if (!q) return
    q.replies = (q.replies || []).filter(r => r.id !== replyId); DB.saveGroup(g)
  },

  setMemberPage(groupId, memberId, page) {
    const g = DB.getGroup(groupId); if (!g) return
    const m = g.members.find(m => m.id === memberId); if (!m) return
    m.currentPage = page ? Math.max(0, parseInt(page)) : 0
    DB.saveGroup(g)
  },
  setTotalPages(groupId, pages) {
    const g = DB.getGroup(groupId); if (!g) return
    g.totalPages = pages ? Math.max(1, parseInt(pages)) : null
    DB.saveGroup(g)
  },

  setMemberComplete(groupId, memberId, done, note) {
    const g = DB.getGroup(groupId); if (!g) return
    const m = g.members.find(m => m.id === memberId); if (!m) return
    m.hasCompleted   = done
    m.completedAt    = done ? new Date().toISOString() : null
    m.completionNote = done ? (note || null) : null
    if (g.members.every(m => m.hasCompleted)) g.status = 'completed'
    else g.status = 'reading'
    DB.saveGroup(g)
  },

  _settings()    { return JSON.parse(localStorage.getItem('gd_settings') || '{}') },
  _saveSettings(s){ localStorage.setItem('gd_settings', JSON.stringify(s)) },

  getApiKey()  { return DB._settings().anthropicKey ?? '' },
  setApiKey(k) { const s = DB._settings(); s.anthropicKey = k; DB._saveSettings(s) },

  getKakaoKey()  { return DB._settings().kakaoKey ?? '' },
  setKakaoKey(k) { const s = DB._settings(); s.kakaoKey = k; DB._saveSettings(s) },

  getSupabaseUrl()  { return DB._settings().supabaseUrl ?? '' },
  getSupabaseKey()  { return DB._settings().supabaseKey ?? '' },
  setSupabase(url, key) {
    const s = DB._settings(); s.supabaseUrl = url; s.supabaseKey = key; DB._saveSettings(s)
  },

  isCloudGroup(id) {
    return (JSON.parse(localStorage.getItem('gd_cloud') || '[]')).includes(id)
  },
  setCloudGroup(id, on) {
    const a = JSON.parse(localStorage.getItem('gd_cloud') || '[]')
    const i = a.indexOf(id)
    if (on && i < 0) a.push(id)
    if (!on && i >= 0) a.splice(i, 1)
    localStorage.setItem('gd_cloud', JSON.stringify(a))
  },

  getLastSeen(groupId) {
    return (JSON.parse(localStorage.getItem('gd_last_seen') || '{}'))[groupId] ?? null
  },
  setLastSeen(groupId) {
    const ls = JSON.parse(localStorage.getItem('gd_last_seen') || '{}')
    ls[groupId] = new Date().toISOString()
    localStorage.setItem('gd_last_seen', JSON.stringify(ls))
  },
  getNewCount(groupId) {
    const g  = DB.getGroup(groupId); if (!g) return 0
    const ts = DB.getLastSeen(groupId); if (!ts) return 0
    const myMember = g.members.find(m => m.isMe)
    let n = 0
    g.quotes.forEach(q => {
      if (q.memberId !== myMember?.id && q.createdAt > ts) n++
      ;(q.replies || []).forEach(r => { if (!r.isMe && r.createdAt > ts) n++ })
    })
    return n
  },

  getBookmarks()      { return JSON.parse(localStorage.getItem('gd_bookmarks') || '[]') },
  isBookmarked(qid)   { return DB.getBookmarks().includes(qid) },
  toggleBookmark(qid) {
    const bm = DB.getBookmarks()
    const i  = bm.indexOf(qid)
    if (i >= 0) bm.splice(i, 1); else bm.push(qid)
    localStorage.setItem('gd_bookmarks', JSON.stringify(bm))
    return i < 0 // true = 추가됨
  },
}

// ── Supabase 클라우드 동기화 ──────────────────────────────────────────────────
let _sbClient = null

function _paramFromURL(name) {
  return new URLSearchParams(location.search).get(name) || null
}

async function _getSB() {
  if (_sbClient) return _sbClient
  const url = DB.getSupabaseUrl() || _paramFromURL('sburl')
  const key = DB.getSupabaseKey() || _paramFromURL('sbkey')
  if (!url || !key) return null
  if (!window.supabase) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }
  _sbClient = window.supabase.createClient(url, key)
  return _sbClient
}

async function cloudPush(groupId) {
  const sb = await _getSB(); if (!sb) return false
  const g = DB.getGroup(groupId); if (!g) return false
  const { error } = await sb.from('gd_groups')
    .upsert({ id: groupId, data: g, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return !error
}

async function cloudPull(groupId) {
  const sb = await _getSB(); if (!sb) return null
  const { data, error } = await sb.from('gd_groups').select('data').eq('id', groupId).single()
  if (error || !data) return null
  const g = data.data
  // 현재 기기의 사용자에 맞게 isMe 재계산
  const me = DB.getMe()
  if (me && g.members) {
    g.members = g.members.map(m => ({
      ...m,
      isMe: me.userId ? m.userId === me.userId : m.name === me.name
    }))
  }
  const gs = DB.getGroups().filter(x => x.id !== g.id)
  gs.unshift(g); DB._saveGroups(gs)
  return g
}

let _realtimeCh = null
async function cloudSubscribe(groupId, onChange) {
  const sb = await _getSB(); if (!sb) return
  _realtimeCh = sb.channel('grp-' + groupId)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'gd_groups', filter: `id=eq.${groupId}`
    }, payload => {
      if (!payload.new?.data) return
      const g = payload.new.data
      const gs = DB.getGroups().filter(x => x.id !== g.id)
      gs.unshift(g); DB._saveGroups(gs)
      onChange()
    })
    .subscribe()
}
function cloudUnsubscribe() {
  if (_realtimeCh) { _realtimeCh.unsubscribe(); _realtimeCh = null }
}

// ── 프로필 체크 / 리다이렉트 ─────────────────────────────────────────────────
function requireProfile() {
  if (!DB.getMe()) { location.href = 'auth.html'; return null }
  return DB.getMe()
}

// ── 유틸 ────────────────────────────────────────────────────────────────────
function param(k) { return new URLSearchParams(location.search).get(k) }

function fmtDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function daysLeft(d) { return Math.ceil((new Date(d) - Date.now()) / 86400000) }
function minDate(n=7) { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0] }

function toast(msg, dur=2500) {
  let el = document.getElementById('toast')
  if (!el) { el=document.createElement('div'); el.id='toast'; document.body.appendChild(el) }
  el.textContent = msg; el.classList.add('show')
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), dur)
}

async function copyText(text) { await navigator.clipboard.writeText(text); toast('복사됐어요 ✓') }

// ── 네비게이션 ────────────────────────────────────────────────────────────────
function renderNav(active) {
  const me = DB.getMe()
  const nav = document.querySelector('.nav-inner')
  if (!nav) return
  nav.innerHTML = `
    <a href="dashboard.html" class="nav-logo">교환독서</a>
    <a href="dashboard.html" class="nav-link ${active==='dashboard'?'active':''}">내 그룹</a>
    <a href="explore.html"   class="nav-link ${active==='explore'?'active':''}">탐색</a>
    <a href="stats.html"     class="nav-link ${active==='stats'?'active':''}">통계</a>
    <a href="settings.html"  class="nav-link ${active==='settings'?'active':''}">설정</a>
    ${me ? `<div class="nav-avatar">${me.name[0]}</div>` : ''}
  `
}

// ── 책 표지 HTML ─────────────────────────────────────────────────────────────
function bookCoverHTML(url, title, sz='md') {
  const [w,h] = sz==='sm'?[44,62]:sz==='lg'?[80,112]:[60,84]
  const dim = `width:${w}px;height:${h}px`
  const ph  = `<div class="book-cover-placeholder" style="${dim};flex-shrink:0">📖</div>`
  if (!url) return ph
  return `<div style="position:relative;${dim};flex-shrink:0">
    <div class="book-cover-placeholder" style="position:absolute;top:0;left:0;${dim}">📖</div>
    <img src="${url}" alt="" class="book-cover" style="${dim};position:relative;z-index:1"
      referrerpolicy="no-referrer" onerror="this.style.display='none'">
  </div>`
}

// ── 샘플 책 데이터 ────────────────────────────────────────────────────────────
const SAMPLE_BOOKS = [
  { title: '자몽살구클럽', author: '한로로', cover_url: null, isbn: null, publisher: null, published_year: null },
  { title: '채식주의자', author: '한강', cover_url: 'https://covers.openlibrary.org/b/isbn/9788936434120-M.jpg', isbn: '9788936434120', publisher: '창비', published_year: 2007 },
  { title: '82년생 김지영', author: '조남주', cover_url: 'https://covers.openlibrary.org/b/isbn/9788954651135-M.jpg', isbn: '9788954651135', publisher: '민음사', published_year: 2016 },
  { title: '아몬드', author: '손원평', cover_url: 'https://covers.openlibrary.org/b/isbn/9788954651882-M.jpg', isbn: '9788954651882', publisher: '창비', published_year: 2017 },
  { title: '파친코', author: '이민진', cover_url: 'https://covers.openlibrary.org/b/isbn/9791191056624-M.jpg', isbn: '9791191056624', publisher: '문학사상', published_year: 2017 },
  { title: '데미안', author: '헤르만 헤세', cover_url: 'https://covers.openlibrary.org/b/isbn/9788937460449-M.jpg', isbn: '9788937460449', publisher: '민음사', published_year: 1919 },
  { title: '어린 왕자', author: '생텍쥐페리', cover_url: 'https://covers.openlibrary.org/b/isbn/9788937460524-M.jpg', isbn: '9788937460524', publisher: '민음사', published_year: 1943 },
  { title: '1984', author: '조지 오웰', cover_url: 'https://covers.openlibrary.org/b/isbn/9788937460777-M.jpg', isbn: '9788937460777', publisher: '민음사', published_year: 1949 },
  { title: '나미야 잡화점의 기적', author: '히가시노 게이고', cover_url: null, isbn: null, publisher: '현대문학', published_year: 2012 },
  { title: '불편한 편의점', author: '김호연', cover_url: null, isbn: null, publisher: '나무옆의자', published_year: 2021 },
  { title: '달러구트 꿈 백화점', author: '이미예', cover_url: null, isbn: null, publisher: '팩토리나인', published_year: 2020 },
  { title: '소년이 온다', author: '한강', cover_url: null, isbn: null, publisher: '창비', published_year: 2014 },
  { title: '있지도 않은 기사', author: '이탈로 칼비노', cover_url: null, isbn: null, publisher: '민음사', published_year: 1959 },
  { title: '노르웨이의 숲', author: '무라카미 하루키', cover_url: null, isbn: null, publisher: '민음사', published_year: 1987 },
  { title: '해리 포터와 마법사의 돌', author: 'J.K. 롤링', cover_url: null, isbn: null, publisher: '문학수첩', published_year: 1997 },
]

function searchSampleBooks(q) {
  const kw = q.toLowerCase()
  return SAMPLE_BOOKS.filter(b =>
    b.title.toLowerCase().includes(kw) || b.author.toLowerCase().includes(kw)
  )
}

// ── 카카오 책 검색 ───────────────────────────────────────────────────────────
async function searchBooks(q) {
  const local    = searchSampleBooks(q)
  const kakaoKey = DB.getKakaoKey()
  let remote = []

  if (kakaoKey) {
    try {
      const r = await fetch(
        `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(q)}&size=12`,
        { headers: { Authorization: `KakaoAK ${kakaoKey}` }, signal: AbortSignal.timeout(5000) }
      )
      const d = await r.json()
      remote = (d.documents || []).map(b => {
        const isbn13 = b.isbn?.trim().split(' ').find(s => s.length === 13) || null
        // http:// → https:// 강제 변환, 없으면 Open Library ISBN 폴백
        let cover = b.thumbnail ? b.thumbnail.replace('http://', 'https://') : null
        if (!cover && isbn13) cover = `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`
        return {
          title:          b.title,
          author:         b.authors?.[0] ?? '작자 미상',
          cover_url:      cover,
          isbn:           isbn13,
          publisher:      b.publisher || null,
          published_year: b.datetime ? new Date(b.datetime).getFullYear() : null,
        }
      })
    } catch(_) {}
  } else {
    // 카카오 키 없으면 Google Books 폴백
    try {
      const r = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books`,
        { signal: AbortSignal.timeout(5000) }
      )
      const d = await r.json()
      remote = (d.items || []).map(item => {
        const info  = item.volumeInfo
        const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
        return {
          title:          info.title ?? '제목 없음',
          author:         info.authors?.[0] ?? '작자 미상',
          cover_url:      thumb ? thumb.replace('http://', 'https://') : null,
          isbn:           info.industryIdentifiers?.find(x => x.type === 'ISBN_13')?.identifier ?? null,
          publisher:      info.publisher ?? null,
          published_year: info.publishedDate ? parseInt(info.publishedDate) : null,
        }
      })
    } catch(_) {}
  }

  const titles = new Set(local.map(b => b.title))
  const merged = [...local, ...remote.filter(b => !titles.has(b.title))]
  return merged.slice(0, 12)
}

// ── AI 질문 생성 (Anthropic 직접 호출) ───────────────────────────────────────
async function generateAIQuestions(groupId, bookTitle, bookAuthor) {
  const key = DB.getApiKey()
  if (!key) return false
  const g = DB.getGroup(groupId)
  if (!g) return false

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `당신은 독서 토론 진행자입니다. 다음 책에 대한 깊이 있는 토론 질문 6개를 생성해주세요.

책 제목: ${bookTitle}
저자: ${bookAuthor}

요구사항: 책의 핵심 주제 관련, 개인 경험과 연결, 해석과 감상을 묻는 질문, 한국어, 간결한 한 문장
JSON으로만 응답: {"questions":["질문1","질문2","질문3","질문4","질문5","질문6"]}`
      }]
    })
  })

  if (!res.ok) return false
  const data = await res.json()
  const { questions } = JSON.parse(data.content[0].text)
  questions.forEach(content => DB.addQuestion(groupId, { id: uid(), content, isAI: true, createdAt: new Date().toISOString() }))
  return true
}

// ── 내보내기 / 가져오기 ────────────────────────────────────────────────────────
function exportGroup(groupId) {
  const g = DB.getGroup(groupId)
  if (!g) return
  const json = JSON.stringify(g, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${g.name}-교환독서.json`
  a.click()
}

function importGroup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const g = JSON.parse(e.target.result)
        if (!g.id || !g.name || !g.book) throw new Error('올바른 그룹 파일이 아닙니다.')
        DB.saveGroup(g)
        resolve(g)
      } catch(ex) { reject(ex) }
    }
    reader.readAsText(file)
  })
}
