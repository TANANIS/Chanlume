(() => {
  'use strict';

  const canvas = document.querySelector('#stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  const DURATION = 42;
  const STORE_URL = 'https://chromewebstore.google.com/detail/agnnbehkdkdkflknblhkmgciaekngole?utm_source=item-share-cb';
  const icon = new Image();
  icon.src = '../../extension/icons/icon-128.png';

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const mix = (a, b, t) => a + (b - a) * clamp(t);
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const phase = (t, start, end) => smooth((t - start) / (end - start));
  const fadeWindow = (t, enter, hold, exit) => phase(t, enter[0], enter[1]) * (1 - phase(t, exit[0], exit[1])) * (t >= hold[0] && t <= hold[1] ? 1 : 1);

  function hexToRgb(hex) {
    const raw = hex.slice(1);
    const normalized = raw.length === 3 ? raw.split('').map(char => char + char).join('') : raw;
    const n = parseInt(normalized, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function colorMix(a, b, t, alpha = 1) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    return `rgba(${Math.round(mix(ca[0], cb[0], t))},${Math.round(mix(ca[1], cb[1], t))},${Math.round(mix(ca[2], cb[2], t))},${alpha})`;
  }

  function rr(x, y, w, h, r, fill, stroke = null, line = 1) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
  }

  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  }

  function text(value, x, y, size, color, weight = 500, align = 'left', family = '"Segoe UI", Arial, sans-serif') {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function alphaLayer(alpha, draw) {
    ctx.save(); ctx.globalAlpha = clamp(alpha); draw(); ctx.restore();
  }

  function drawLogo(x, y, size, withWord = true, light = true) {
    ctx.save();
    ctx.shadowColor = 'rgba(100,72,235,.36)'; ctx.shadowBlur = size * .42; ctx.shadowOffsetY = size * .1;
    if (icon.complete) ctx.drawImage(icon, x, y, size, size);
    else { rr(x, y, size, size, size * .28, '#7c5cff'); text('▶', x + size / 2, y + size * .68, size * .42, '#fff', 800, 'center'); }
    ctx.restore();
    if (withWord) text('Chanlume', x + size + 14, y + size * .68, size * .43, light ? '#ffffff' : '#141319', 750);
  }

  function backdrop(darkness = 0) {
    const dark = clamp(darkness);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, colorMix('#f8f8fb', '#0e0d12', dark));
    bg.addColorStop(1, colorMix('#efecf9', '#171323', dark));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(1060, 60, 0, 1060, 60, 520);
    glow.addColorStop(0, `rgba(124,92,255,${mix(.16, .28, dark)})`);
    glow.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  }

  function youtubeHeader(dark) {
    const bg = colorMix('#ffffff', '#0f0f0f', dark);
    const textColor = colorMix('#0f0f0f', '#f1f1f1', dark);
    const muted = colorMix('#606060', '#aaaaaa', dark);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 58);
    line(0, 58, W, 58, colorMix('#e7e7e7', '#272727', dark));
    line(21, 23, 38, 23, textColor, 2); line(21, 29, 38, 29, textColor, 2); line(21, 35, 38, 35, textColor, 2);
    rr(58, 17, 34, 24, 7, '#ff0033');
    ctx.beginPath(); ctx.moveTo(71, 23); ctx.lineTo(71, 35); ctx.lineTo(82, 29); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    text('YouTube', 100, 36, 20, textColor, 750);
    rr(346, 11, 470, 38, 20, colorMix('#f7f7f7', '#121212', dark), colorMix('#d5d5d5', '#3a3a3a', dark));
    text('搜尋', 372, 36, 14, muted, 400);
    ctx.beginPath(); ctx.arc(786, 28, 7, 0, Math.PI * 2); ctx.strokeStyle = muted; ctx.lineWidth = 1.7; ctx.stroke(); line(791, 33, 797, 38, muted, 1.7);
    for (let i = 0; i < 3; i++) rr(1120 + i * 42, 13, 32, 32, 16, colorMix('#f2f2f2', '#272727', dark));
    text('◦', 1136, 35, 22, muted, 700, 'center'); text('▦', 1178, 34, 16, muted, 500, 'center');
    rr(1204, 13, 32, 32, 16, '#7255e9'); text('T', 1220, 35, 13, '#fff', 750, 'center');
  }

  function navItem(y, iconText, label, active, dark, alpha = 1) {
    const tc = colorMix('#222222', '#efefef', dark);
    const muted = colorMix('#656565', '#a9a9a9', dark);
    alphaLayer(alpha, () => {
      if (active) rr(12, y - 23, 202, 42, 11, colorMix('#eeeafc', '#29243a', dark));
      text(iconText, 34, y + 1, 15, active ? '#8465ff' : muted, 650, 'center');
      text(label, 59, y + 2, 14, active ? tc : muted, active ? 650 : 500);
    });
  }

  function drawSidebar(t, dark, overrideProgress = null) {
    const bg = colorMix('#ffffff', '#0f0f0f', dark);
    const tc = colorMix('#161616', '#f0f0f0', dark);
    const muted = colorMix('#676767', '#a5a5a5', dark);
    ctx.fillStyle = bg; ctx.fillRect(0, 58, 226, H - 58);
    line(226, 58, 226, H, colorMix('#ececec', '#292929', dark));
    navItem(97, '⌂', '首頁', false, dark);
    navItem(143, '▣', '訂閱內容', false, dark);
    navItem(189, '▤', '媒體庫', false, dark);
    line(14, 218, 212, 218, colorMix('#e9e9e9', '#292929', dark));
    const expand = overrideProgress === null ? phase(t, 5.1, 6.2) : clamp(overrideProgress);
    text('Chanlume', 22, 252, 14, tc, 700);
    text('⌄', 198, 252, 16, muted, 600, 'center');
    text(expand < .5 ? '已折疊' : '群組', 22, 272, 10, muted, 500);
    if (expand > .01) {
      const h = 206 * ease(expand);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 278, 226, h); ctx.clip();
      navItem(305, '★', '全部頻道', false, dark, expand);
      navItem(347, '✦', '未分類', false, dark, expand);
      navItem(389, '▥', '學習', true, dark, expand);
      navItem(431, '♪', '放鬆', false, dark, expand);
      navItem(473, '◆', '科技', false, dark, expand);
      ctx.restore();
    }
    rr(17, 653, 192, 42, 12, colorMix('#f7f5ff', '#181622', dark), colorMix('#e5ddff', '#302a45', dark));
    text('●', 35, 679, 10, '#49c78c', 700, 'center');
    text('資料只留在這台裝置', 52, 679, 11, tc, 600);
  }

  const groups = [
    ['全部', 90], ['學習', 82], ['科技', 82], ['設計', 82], ['遊戲', 82], ['音樂', 82], ['稍後觀看', 112], ['未分類', 94]
  ];

  function drawToolbar(t, dark, selected = '學習', forceWrap = null) {
    const left = 250, top = 82, width = 1003;
    const wrap = forceWrap === null ? phase(t, 10.4, 11.6) : clamp(forceWrap);
    const height = 52 + 42 * ease(wrap);
    rr(left, top, width, height, 16, colorMix('#f2f2f2', '#202020', dark), colorMix('#dfdfdf', '#363636', dark));
    let x = left + 14, y = top + 10;
    groups.forEach(([label, w], i) => {
      if (i >= 6 && wrap > .05) {
        const p = ease(wrap);
        x = mix(left + 14 + groups.slice(0, i).reduce((a, g) => a + g[1] + 8, 0), left + 14 + (i - 6) * 110, p);
        y = mix(top + 10, top + 51, p);
      }
      const active = label === selected;
      rr(x, y, w, 32, 11, active ? '#6f50e9' : colorMix('#ffffff', '#2c2c2c', dark), active ? null : colorMix('#dddddd', '#414141', dark));
      text(label, x + w / 2, y + 21, 12, active ? '#fff' : colorMix('#222', '#eee', dark), active ? 700 : 550, 'center');
      x += w + 8;
    });
  }

  const cards = [
    { title: '設計系統，從零到一', channel: 'Studio Notes', group: '學習', hue: 265, mark: 'Aa' },
    { title: '一小時理解前端架構', channel: 'Code Atlas', group: '學習', hue: 222, mark: '</>' },
    { title: '週末桌遊開箱實況', channel: '慢慢玩', group: '放鬆', hue: 344, mark: '♟' },
    { title: 'AI 工具的實用工作流', channel: 'Future Daily', group: '科技', hue: 178, mark: '✦' },
    { title: '城市散步：雨夜篇', channel: '日常取景', group: '放鬆', hue: 32, mark: '◌' },
    { title: '把複雜知識說清楚', channel: 'Learning Lab', group: '學習', hue: 287, mark: '◎' }
  ];

  function drawCard(card, x, y, w, dark, alpha = 1, focus = 0) {
    const tc = colorMix('#161616', '#f2f2f2', dark);
    const muted = colorMix('#666666', '#aaaaaa', dark);
    alphaLayer(alpha, () => {
      ctx.save();
      if (focus > 0) { ctx.shadowColor = `rgba(124,92,255,${.32 * focus})`; ctx.shadowBlur = 24 * focus; }
      const grad = ctx.createLinearGradient(x, y, x + w, y + 146);
      grad.addColorStop(0, `hsl(${card.hue} 72% ${mix(82, 28, dark)}%)`);
      grad.addColorStop(1, `hsl(${(card.hue + 38) % 360} 66% ${mix(58, 17, dark)}%)`);
      rr(x, y, w, 146, 14, grad);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= .2; text(card.mark, x + w / 2, y + 92, 54, '#ffffff', 750, 'center'); ctx.restore();
      rr(x + w - 51, y + 113, 41, 23, 6, 'rgba(0,0,0,.72)');
      text(`${7 + (card.hue % 5)}:${card.hue % 2 ? '42' : '18'}`, x + w - 30, y + 129, 10, '#fff', 650, 'center');
      rr(x, y + 158, 34, 34, 17, `hsl(${card.hue} 58% 47%)`);
      text(card.channel.slice(0, 1), x + 17, y + 181, 12, '#fff', 750, 'center');
      text(card.title, x + 45, y + 173, 14, tc, 650);
      text(`${card.channel} · 2 天前`, x + 45, y + 192, 11, muted, 450);
      text('Chanlume 分類', x + 45, y + 214, 10, muted, 500);
      rr(x + 132, y + 198, 52, 22, 7, colorMix('#ede9ff', '#2d2742', dark));
      text(card.group, x + 158, y + 213, 10, colorMix('#6a4adb', '#c8bcff', dark), 700, 'center');
    });
  }

  function drawCards(t, dark, filter = false, focus = 0) {
    text(filter ? '學習中的新影片' : '最新訂閱內容', 250, 210, 23, colorMix('#111', '#f3f3f3', dark), 750);
    text(filter ? '只顯示已加入「學習」的頻道' : '來自你訂閱的頻道', 250, 232, 11, colorMix('#666', '#aaa', dark), 450);
    const visible = filter ? cards.filter(c => c.group === '學習') : cards;
    visible.slice(0, 3).forEach((card, i) => drawCard(card, 250 + i * 326, 255, 300, dark, 1, i === 0 ? focus : 0));
    if (!filter) cards.slice(3, 6).forEach((card, i) => drawCard(card, 250 + i * 326, 510, 300, dark, 1));
  }

  function caption(label, title, detail, progress = 1) {
    const p = ease(progress);
    alphaLayer(p, () => {
      const y = mix(695, 596, p);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12;
      rr(304, y, 672, 94, 22, 'rgba(17,15,24,.94)', 'rgba(255,255,255,.12)'); ctx.restore();
      rr(326, y + 18, 88, 24, 12, 'rgba(124,92,255,.2)');
      text(label, 370, y + 34, 10, '#b8aaff', 750, 'center');
      text(title, 432, y + 36, 19, '#ffffff', 730);
      text(detail, 326, y + 69, 12, '#b7b3c0', 450);
    });
  }

  function drawYouTubeScene(t, options = {}) {
    const dark = options.dark ?? 1;
    backdrop(dark);
    youtubeHeader(dark);
    drawSidebar(t, dark, options.sidebar);
    drawToolbar(t, dark, options.selected ?? '學習', options.wrap);
    drawCards(t, dark, options.filter ?? false, options.focus ?? 0);
    if (options.dim) { ctx.fillStyle = `rgba(4,3,8,${options.dim})`; ctx.fillRect(0, 58, W, H - 58); }
  }

  function drawPanel(progress, dark) {
    const p = ease(progress);
    const w = 386, x = mix(W + 10, W - w - 16, p), y = 72, h = 630;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 54; ctx.shadowOffsetX = -12;
    rr(x, y, w, h, 22, colorMix('#ffffff', '#151419', dark), colorMix('#dddddd', '#34323a', dark)); ctx.restore();
    drawLogo(x + 18, y + 18, 40, true, dark > .5);
    text('本機訂閱整理', x + 72, y + 51, 10, colorMix('#666', '#aaa', dark), 500);
    text('×', x + w - 28, y + 46, 22, colorMix('#555', '#aaa', dark), 400, 'center');
    rr(x + 16, y + 82, w - 32, 48, 14, colorMix('#f2efff', '#29243a', dark));
    text('我的群組', x + 42, y + 112, 13, colorMix('#5b3fd0', '#d7ceff', dark), 700);
    text('7 個群組', x + w - 42, y + 112, 11, colorMix('#666', '#aaa', dark), 500, 'right');
    text('群組', x + 24, y + 164, 10, colorMix('#777', '#999', dark), 750);
    [['★','全部頻道','48'],['▥','學習','12'],['♪','放鬆','9'],['◆','科技','8']].forEach((g, i) => {
      const yy = y + 194 + i * 58;
      if (i === 1) rr(x + 16, yy - 27, w - 32, 48, 13, colorMix('#f2efff', '#282239', dark));
      rr(x + 28, yy - 20, 34, 34, 10, i === 1 ? '#7456e9' : colorMix('#eeeeee', '#2a2930', dark));
      text(g[0], x + 45, yy + 3, 13, i === 1 ? '#fff' : colorMix('#555', '#bbb', dark), 650, 'center');
      text(g[1], x + 76, yy + 1, 13, colorMix('#222', '#eee', dark), 650);
      rr(x + w - 58, yy - 14, 32, 24, 12, colorMix('#eee', '#29282f', dark));
      text(g[2], x + w - 42, yy + 3, 10, colorMix('#666', '#aaa', dark), 600, 'center');
    });
    line(x + 18, y + 444, x + w - 18, y + 444, colorMix('#e8e8e8', '#313038', dark));
    text('減少干擾', x + 24, y + 477, 10, colorMix('#777', '#999', dark), 750);
    [['隱藏首頁推薦', true], ['隱藏影片右側欄', false]].forEach((s, i) => {
      const yy = y + 512 + i * 48;
      text(s[0], x + 24, yy, 12, colorMix('#333', '#ddd', dark), 550);
      rr(x + w - 65, yy - 18, 42, 24, 12, s[1] ? '#7c5cff' : colorMix('#ddd', '#34343a', dark));
      rr(x + w - (s[1] ? 42 : 60), yy - 15, 18, 18, 9, '#fff');
    });
    rr(x + 18, y + h - 64, w - 36, 44, 13, '#7455e9');
    text('開啟管理中心', x + w / 2, y + h - 36, 13, '#fff', 700, 'center');
  }

  function hero(t, outro = false) {
    backdrop(1);
    const p = ease(outro ? phase(t, 37.1, 38.2) : phase(t, 0, 1));
    alphaLayer(p, () => {
      const yShift = mix(24, 0, p);
      drawLogo(96, 82 + yShift, 54, true, true);
      rr(1000, 68, 170, 34, 17, 'rgba(124,92,255,.16)', 'rgba(176,158,255,.24)');
      text('版本 1.18.3', 1085, 90, 12, '#c7bbff', 700, 'center');
      text(outro ? '訂閱很多，也能井然有序。' : '把 YouTube 訂閱，', 96, 250 + yShift, outro ? 42 : 59, '#ffffff', 760);
      if (!outro) text('變成你的書架。', 96, 320 + yShift, 59, '#ffffff', 760);
      text(outro ? '免費安裝 Chanlume' : '分組、篩選、專注，一切留在本機。', 98, outro ? 334 : 374, outro ? 24 : 22, '#b8b3c4', 480);
      if (outro) {
        rr(96, 386, 300, 58, 17, '#7455e9');
        text('前往 Chrome 線上應用程式商店  →', 246, 422, 15, '#fff', 720, 'center');
        text(STORE_URL, 96, 480, 11, '#8d8799', 450);
      } else {
        ['建立群組', '快速篩選', '同步主題'].forEach((s, i) => {
          rr(98 + i * 136, 420, 122, 38, 19, 'rgba(255,255,255,.07)', 'rgba(255,255,255,.09)');
          text(s, 159 + i * 136, 445, 12, '#d9d4e1', 650, 'center');
        });
      }
      const cx = 970, cy = 368;
      for (let i = 0; i < 3; i++) {
        const yy = cy - 104 + i * 100;
        ctx.save(); ctx.translate(cx, yy); ctx.rotate((i - 1) * .075);
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
        rr(-176, -37, 352, 74, 22, i === 1 ? '#2b253a' : '#24212e', 'rgba(255,255,255,.1)'); ctx.restore();
        rr(cx - 152, yy - 22, 44, 44, 14, ['#7c5cff','#ff6b8a','#2cc7a1'][i]);
        text(['▥','♪','◆'][i], cx - 130, yy + 8, 18, '#fff', 700, 'center');
        text(['學習','放鬆','科技'][i], cx - 88, yy + 5, 17, '#eeeaf5', 700);
        rr(cx + 78, yy - 12, 58, 25, 13, 'rgba(255,255,255,.08)');
        text([12,9,8][i], cx + 107, yy + 5, 11, '#aaa3b3', 650, 'center');
      }
    });
  }

  function renderVideoAt(t) {
    t = clamp(t, 0, DURATION);
    if (t < 3.15) {
      hero(t, false);
    } else if (t < 10.2) {
      drawYouTubeScene(t, { dark: 1, sidebar: null, wrap: 0, selected: '全部' });
      caption('01', '側欄預設收合，需要時再展開', '群組清楚可見，也不和 YouTube 導覽搶空間。', phase(t, 3.35, 4.1) * (1 - phase(t, 9.2, 10.0)));
    } else if (t < 17.2) {
      const filterP = phase(t, 13.0, 14.0);
      drawYouTubeScene(t, { dark: 1, sidebar: 1, wrap: phase(t, 10.4, 11.6), selected: filterP > .5 ? '學習' : '全部', filter: filterP > .5 });
      caption('02', '群組太多，自動延伸第二行', '選一個群組，就只看現在想看的訂閱內容。', phase(t, 10.3, 11) * (1 - phase(t, 16.2, 17)));
    } else if (t < 24.1) {
      const focus = phase(t, 18.0, 19.2) * (1 - phase(t, 22.9, 23.7));
      drawYouTubeScene(t, { dark: 1, sidebar: 1, wrap: 1, selected: '學習', filter: true, focus });
      if (focus > .05) {
        alphaLayer(focus, () => {
          line(344, 472, 318, 530, '#a997ff', 2);
          rr(68, 506, 250, 74, 16, 'rgba(28,24,40,.96)', 'rgba(169,151,255,.34)');
          text('預覽就看得到分類', 88, 535, 15, '#fff', 700);
          text('不用再打開頻道確認。', 88, 559, 11, '#aaa4b2', 500);
        });
      }
      caption('03', '分類直接顯示在影片資訊下方', '已存入 Chanlume 的頻道才會顯示；沒有資料就保持乾淨。', phase(t, 17.2, 18.0) * (1 - phase(t, 23.1, 23.9)));
    } else if (t < 31.1) {
      const light = phase(t, 24.5, 26.2);
      const returnDark = phase(t, 29.0, 30.4);
      const dark = mix(1, 0, light) + returnDark;
      drawYouTubeScene(t, { dark: clamp(dark), sidebar: 1, wrap: 1, selected: '學習', filter: true });
      const sunAlpha = phase(t, 25, 26) * (1 - phase(t, 29, 30));
      alphaLayer(sunAlpha, () => { rr(1167, 90, 66, 32, 16, '#fff', '#ddd'); text('☀', 1183, 112, 15, '#ef9e20', 600, 'center'); text('淺色', 1208, 111, 10, '#555', 650, 'center'); });
      caption('04', 'Chanlume 跟著 YouTube 一起變色', '切換深色或淺色，不需要再設定一次。', phase(t, 24.2, 25) * (1 - phase(t, 30.1, 30.9)));
    } else if (t < 37.25) {
      const p = phase(t, 31.3, 32.5);
      drawYouTubeScene(t, { dark: 1, sidebar: 1, wrap: 1, selected: '學習', filter: true, dim: .42 * p });
      drawPanel(p, 1);
      caption('05', '在 YouTube 裡完成整理', '資料存在本機；不會替你取消或改動 YouTube 訂閱。', phase(t, 31.2, 32) * (1 - phase(t, 36.3, 37)));
    } else {
      hero(t, true);
    }
  }

  function renderGifAt(t) {
    const gt = ((t % 9) + 9) % 9;
    const dark = gt < 6.5 ? 1 : 1 - phase(gt, 6.5, 7.8);
    const sidebar = phase(gt, .75, 2.0);
    const wrap = phase(gt, 2.0, 3.2);
    const filter = gt >= 3.8;
    const focus = phase(gt, 4.2, 5.2) * (1 - phase(gt, 6.2, 6.8));
    drawYouTubeScene(gt, { dark, sidebar, wrap, selected: filter ? '學習' : '全部', filter, focus });
    alphaLayer(1 - phase(gt, 8.1, 9), () => {
      rr(30, 628, 438, 62, 18, 'rgba(18,16,25,.94)', 'rgba(255,255,255,.1)');
      drawLogo(48, 640, 38, true, true);
      text(gt < 2 ? '展開你的訂閱書架' : gt < 4 ? '群組自動換行' : gt < 6.5 ? '預覽就看得到分類' : '跟著 YouTube 切換主題', 208, 667, 14, '#d8d3df', 650);
    });
    alphaLayer(phase(gt, 8.1, 8.7), () => {
      ctx.fillStyle = 'rgba(17,14,25,.92)'; ctx.fillRect(0, 0, W, H);
      drawLogo(448, 296, 58, true, true);
      text('你的 YouTube 訂閱書架', 640, 406, 22, '#c9c2d2', 550, 'center');
    });
  }

  function renderPoster() {
    backdrop(1);
    hero(2.2, false);
    rr(95, 512, 472, 56, 17, '#7455e9');
    text('群組 · 篩選 · 專注 · 本機優先', 331, 548, 16, '#fff', 700, 'center');
  }

  function addAmbientAudio(duration) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioCtx({ sampleRate: 48000 });
    const dest = audio.createMediaStreamDestination();
    const master = audio.createGain();
    master.gain.value = .045;
    master.connect(dest);
    const now = audio.currentTime + .08;
    const chords = [[220,277.18,329.63],[196,246.94,293.66],[174.61,220,261.63],[207.65,261.63,311.13]];
    for (let s = 0; s < duration; s += 6) {
      const chord = chords[Math.floor(s / 6) % chords.length];
      chord.forEach((freq, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const filter = audio.createBiquadFilter();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        filter.type = 'lowpass'; filter.frequency.value = 920;
        gain.gain.setValueAtTime(.0001, now + s);
        gain.gain.exponentialRampToValueAtTime(i === 0 ? .5 : .22, now + s + .7);
        gain.gain.setValueAtTime(i === 0 ? .5 : .22, now + Math.min(s + 4.7, duration));
        gain.gain.exponentialRampToValueAtTime(.0001, now + Math.min(s + 6, duration));
        osc.connect(filter); filter.connect(gain); gain.connect(master);
        osc.start(now + s); osc.stop(now + Math.min(s + 6.05, duration + .05));
      });
    }
    [3.2,10.2,17.2,24.1,31.1,37.3].forEach((s, idx) => {
      [0, .09].forEach((offset, j) => {
        const osc = audio.createOscillator(); const gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = 620 + idx * 25 + j * 180;
        gain.gain.setValueAtTime(.0001, now + s + offset);
        gain.gain.exponentialRampToValueAtTime(.16, now + s + offset + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, now + s + offset + .35);
        osc.connect(gain); gain.connect(master); osc.start(now + s + offset); osc.stop(now + s + offset + .38);
      });
    });
    audio.resume();
    return { audio, stream: dest.stream };
  }

  async function startRecording(options = {}) {
    await document.fonts.ready;
    if (!icon.complete) await new Promise(resolve => { icon.onload = resolve; icon.onerror = resolve; });
    const duration = Number.isFinite(options.duration) ? Math.max(.5, options.duration) : DURATION;
    const filename = options.filename || 'Chanlume-1.18.3-intro.mp4';
    const fps = 30;
    const videoStream = canvas.captureStream(0);
    const videoTrack = videoStream.getVideoTracks()[0];
    const recordDuration = duration + .5;
    const ambient = addAmbientAudio(recordDuration + .4);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...ambient.stream.getAudioTracks()]);
    const preferred = 'video/mp4;codecs=avc1.4D401F,mp4a.40.2';
    const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : 'video/mp4';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.__recordingDone = true;
      setTimeout(() => ambient.audio.close(), 250);
    };
    renderVideoAt(0);
    recorder.start(1000);
    const started = performance.now();
    const totalFrames = Math.round(recordDuration * fps);
    let frameIndex = 0;
    function frame() {
      const target = started + frameIndex * (1000 / fps);
      const wait = target - performance.now();
      if (wait > 1) { setTimeout(frame, wait); return; }
      renderVideoAt(Math.min(frameIndex / fps, duration, DURATION));
      videoTrack.requestFrame();
      frameIndex += 1;
      if (frameIndex <= totalFrames) setTimeout(frame, 0);
      else setTimeout(() => recorder.stop(), 160);
    }
    frame();
    return { mimeType, duration, fps, frameCount: totalFrames + 1 };
  }

  const bytes = (...values) => new Uint8Array(values);
  const be16 = value => bytes((value >>> 8) & 255, value & 255);
  const be24 = value => bytes((value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  const be32 = value => bytes((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  const ascii = value => new Uint8Array([...value].map(char => char.charCodeAt(0)));
  const zeros = count => new Uint8Array(count);
  function join(...parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  const box = (type, ...payload) => {
    const body = join(...payload);
    return join(be32(body.length + 8), ascii(type), body);
  };
  const fullBox = (type, version, flags, ...payload) => box(type, bytes(version), be24(flags), ...payload);
  const matrix = () => join(
    be32(0x00010000), be32(0), be32(0),
    be32(0), be32(0x00010000), be32(0),
    be32(0), be32(0), be32(0x40000000)
  );

  function makeMp4(samples, avcConfig, width, height, fps, durationSeconds) {
    const movieTimescale = 1000;
    const mediaTimescale = 90000;
    const sampleDelta = Math.round(mediaTimescale / fps);
    const movieDuration = Math.round(durationSeconds * movieTimescale);
    const mediaDuration = samples.length * sampleDelta;
    const sizes = join(...samples.map(sample => be32(sample.data.length)));
    const syncSamples = samples.map((sample, index) => sample.key ? index + 1 : 0).filter(Boolean);
    const ftyp = box('ftyp', ascii('isom'), be32(512), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));

    const mvhd = fullBox('mvhd', 0, 0,
      be32(0), be32(0), be32(movieTimescale), be32(movieDuration),
      be32(0x00010000), be16(0x0100), zeros(10), matrix(), zeros(24), be32(2)
    );
    const tkhd = fullBox('tkhd', 0, 7,
      be32(0), be32(0), be32(1), be32(0), be32(movieDuration), zeros(8),
      be16(0), be16(0), be16(0), be16(0), matrix(), be32(width << 16), be32(height << 16)
    );
    const mdhd = fullBox('mdhd', 0, 0,
      be32(0), be32(0), be32(mediaTimescale), be32(mediaDuration), be16(0x55c4), be16(0)
    );
    const hdlr = fullBox('hdlr', 0, 0,
      be32(0), ascii('vide'), zeros(12), ascii('VideoHandler\0')
    );
    const vmhd = fullBox('vmhd', 0, 1, be16(0), be16(0), be16(0), be16(0));
    const url = fullBox('url ', 0, 1);
    const dref = fullBox('dref', 0, 0, be32(1), url);
    const dinf = box('dinf', dref);

    const compressor = new Uint8Array(32);
    const compressorName = ascii('Chanlume H.264');
    compressor[0] = compressorName.length;
    compressor.set(compressorName, 1);
    const avc1 = box('avc1',
      zeros(6), be16(1), be16(0), be16(0), zeros(12),
      be16(width), be16(height), be32(0x00480000), be32(0x00480000),
      be32(0), be16(1), compressor, be16(0x0018), be16(0xffff),
      box('avcC', avcConfig)
    );
    const stsd = fullBox('stsd', 0, 0, be32(1), avc1);
    const stts = fullBox('stts', 0, 0, be32(1), be32(samples.length), be32(sampleDelta));
    const stsc = fullBox('stsc', 0, 0, be32(1), be32(1), be32(samples.length), be32(1));
    const stsz = fullBox('stsz', 0, 0, be32(0), be32(samples.length), sizes);
    const stss = fullBox('stss', 0, 0, be32(syncSamples.length), ...syncSamples.map(be32));

    function buildMoov(chunkOffset) {
      const stco = fullBox('stco', 0, 0, be32(1), be32(chunkOffset));
      const stbl = box('stbl', stsd, stts, stss, stsc, stsz, stco);
      const minf = box('minf', vmhd, dinf, stbl);
      const mdia = box('mdia', mdhd, hdlr, minf);
      const trak = box('trak', tkhd, mdia);
      return box('moov', mvhd, trak);
    }

    let moov = buildMoov(0);
    moov = buildMoov(ftyp.length + moov.length + 8);
    const media = join(...samples.map(sample => sample.data));
    return join(ftyp, moov, box('mdat', media));
  }

  async function encodeMp4(options = {}) {
    await document.fonts.ready;
    if (!icon.complete) await new Promise(resolve => { icon.onload = resolve; icon.onerror = resolve; });
    const duration = Number.isFinite(options.duration) ? Math.max(.5, options.duration) : DURATION;
    const filename = options.filename || 'Chanlume-1.18.3-intro.mp4';
    const fps = Number.isFinite(options.fps) ? options.fps : 30;
    const frameCount = Math.round(duration * fps);
    const frameDuration = Math.round(1_000_000 / fps);
    const samples = [];
    let avcConfig = null;
    const config = {
      codec: 'avc1.4d001f', width: W, height: H, bitrate: 6_000_000, framerate: fps,
      latencyMode: 'realtime', hardwareAcceleration: 'no-preference', avc: { format: 'avc' }
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) throw new Error('H.264 WebCodecs encoder is unavailable');
    const encoder = new VideoEncoder({
      output(chunk, metadata) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' });
        if (!avcConfig && metadata?.decoderConfig?.description) avcConfig = new Uint8Array(metadata.decoderConfig.description);
      },
      error(error) { throw error; }
    });
    encoder.configure(config);
    for (let i = 0; i < frameCount; i++) {
      renderVideoAt(Math.min(i / fps, duration, DURATION));
      const bitmap = await createImageBitmap(canvas);
      const frame = new VideoFrame(bitmap, { timestamp: i * frameDuration, duration: frameDuration });
      encoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();
      bitmap.close();
      if (encoder.encodeQueueSize > 8) await new Promise(resolve => setTimeout(resolve, 0));
      if (i % 90 === 0) window.__encodeProgress = i / frameCount;
    }
    await encoder.flush();
    encoder.close();
    if (!avcConfig || !samples.length) throw new Error('H.264 encoder produced no samples');
    samples.sort((a, b) => a.timestamp - b.timestamp);
    const file = makeMp4(samples, avcConfig, W, H, fps, duration);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([file], { type: 'video/mp4' }));
    link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    window.__encodeProgress = 1;
    return { mimeType: 'video/mp4;codecs=avc1.4D401F', duration, fps, frameCount, samples: samples.length, bytes: file.length };
  }

  window.renderVideoAt = renderVideoAt;
  window.renderGifAt = renderGifAt;
  window.renderPoster = renderPoster;
  window.startRecording = startRecording;
  window.encodeMp4 = encodeMp4;
  window.promoSpec = { duration: DURATION, width: W, height: H, storeUrl: STORE_URL };
  Promise.all([document.fonts.ready, new Promise(resolve => {
    if (icon.complete) resolve(); else { icon.onload = resolve; icon.onerror = resolve; }
  })]).then(() => { renderVideoAt(0); window.__ready = true; });
})();
