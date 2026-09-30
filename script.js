// ── API CONFIG ─────────────────────────────────────────────

const uidInput = document.getElementById('uid');
const regionSelect = document.getElementById('region');
const lookupBtn = document.getElementById('lookupBtn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const dossier = document.getElementById('dossier');

// ── ICON APIS (tried in order; next one is used if the image is missing or blank) ──
const ICON_APIS = [
  id => `https://cdn.jsdelivr.net/gh/ShahGCreator/icon@main/PNG/${id}.png`,
  id => `https://cdn.jsdelivr.net/gh/0xMe/ff-resources@main/pngs/300x300/${id}.png`
];

function isBlankImage(img){
  try{
    const w = 16, h = 16;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, sumSq = 0, alphaSum = 0;
    const n = w * h;
    for(let i = 0; i < data.length; i += 4){
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += lum;
      sumSq += lum * lum;
      alphaSum += data[i + 3];
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return alphaSum > 0 && mean < 12 && variance < 40;
  }catch(e){
    return false;
  }
}

function loadEquipImage(imgEl, itemID, onUnavailable){
  imgEl.classList.remove('loaded');
  imgEl.removeAttribute('src');
  if(!itemID){ if(onUnavailable) onUnavailable(); return; }

  const urls = ICON_APIS.map(fn => fn(itemID));
  let i = 0;

  function tryNext(){
    if(i >= urls.length){ if(onUnavailable) onUnavailable(); return; }
    const url = urls[i++];
    const test = new Image();
    test.crossOrigin = 'anonymous';
    test.onload = function(){
      if(test.naturalWidth < 10 || test.naturalHeight < 10){ tryNext(); return; }
      if(isBlankImage(test)){ tryNext(); return; }
      imgEl.src = url;
      imgEl.classList.add('loaded');
    };
    test.onerror = tryNext;
    test.src = url;
  }
  tryNext();
}

function equipImageStat(label, itemID){
  const stat = document.createElement('div');
  stat.className = 'stat equip-stat';

  const k = document.createElement('div');
  k.className = 'k';
  k.textContent = label;

  const thumb = document.createElement('div');
  thumb.className = 'equip-thumb';

  const img = document.createElement('img');
  img.alt = label;
  img.crossOrigin = 'anonymous'; // needed so html2canvas can capture it

  const fallback = document.createElement('div');
  fallback.className = 'equip-thumb-fallback';
  fallback.textContent = '…';
  fallback.title = itemID ? `ID ${itemID}` : '';

  thumb.appendChild(img);
  thumb.appendChild(fallback);
  stat.appendChild(k);
  stat.appendChild(thumb);

  loadEquipImage(img, itemID, () => { fallback.textContent = 'Unavailable'; });
  return stat;
}

function fillGrid(gridEl, entries, append){
  if(!append) gridEl.innerHTML = '';
  entries.forEach(([k, v, accent]) => {
    if(v === undefined || v === null || v === '') return;
    const stat = document.createElement('div');
    stat.className = 'stat';
    stat.innerHTML = `<div class="k">${k}</div><div class="v${accent ? ' accent' : ''}">${v}</div>`;
    gridEl.appendChild(stat);
  });
}

function fmtTimestamp(ts){
  if(!ts) return null;
  const n = Number(ts) * 1000;
  if(Number.isNaN(n)) return ts;
  const d = new Date(n);
  return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

// ── Shared UID validation (8–12 digits) ──
function isValidUid(uid){
  return /^[0-9]{8,12}$/.test(uid);
}
function wireDigitsOnly(input, maxLen){
  input.setAttribute('maxlength', String(maxLen));
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
    input.classList.remove('invalid');
  });
}

// ── Shared result cache (3 minutes) ──
const CACHE_TTL_MS = 3 * 60 * 1000;
const resultCache = new Map(); // key "type:id:region" -> { data, at }

function cacheKey(type, id, region){ return `${type}:${id}:${region || ''}`; }
function getCached(type, id, region){
  const hit = resultCache.get(cacheKey(type, id, region));
  if(!hit) return null;
  if(Date.now() - hit.at > CACHE_TTL_MS){
    resultCache.delete(cacheKey(type, id, region));
    return null;
  }
  return hit.data;
}
function setCached(type, id, region, data){
  resultCache.set(cacheKey(type, id, region), { data, at: Date.now() });
}

// ── Shared cooldown: one 3s lock across all lookup buttons, so spam-
// clicking any tool can't be used to hammer the API. ──
const COOLDOWN_MS = 3000;
let cooldownUntil = 0;
let cooldownTimer = null;
const ALL_LOOKUP_BUTTONS = () => [lookupBtn, guildLookupBtn, nickLookupBtn].filter(Boolean);
const ALL_STATUS_SETTERS = [];

function startCooldown(activeSetStatus){
  cooldownUntil = Date.now() + COOLDOWN_MS;
  ALL_LOOKUP_BUTTONS().forEach(b => b.disabled = true);
  tickCooldown(activeSetStatus);
}
function tickCooldown(activeSetStatus){
  const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
  if(remaining <= 0){
    ALL_LOOKUP_BUTTONS().forEach(b => b.disabled = false);
    clearTimeout(cooldownTimer);
    return;
  }
  activeSetStatus('cooldown', `Please wait ${remaining}s before searching again…`);
  cooldownTimer = setTimeout(() => tickCooldown(activeSetStatus), 250);
}

// ── Generic status helper with optional retry button ──
function makeStatusHelpers(el, textEl){
  function setStatus(kind, text, opts){
    el.className = 'status show ' + kind;
    textEl.textContent = text;
    const existingRetry = el.querySelector('.retry-btn');
    if(existingRetry) existingRetry.remove();
    if(opts && opts.retry){
      const btn = document.createElement('button');
      btn.className = 'retry-btn';
      btn.textContent = 'Retry';
      btn.addEventListener('click', opts.retry);
      el.appendChild(btn);
    }
  }
  function clearStatus(){ el.className = 'status'; }
  return { setStatus, clearStatus };
}

const { setStatus, clearStatus } = makeStatusHelpers(statusEl, statusText);
wireDigitsOnly(uidInput, 12);

async function lookupPlayer(){
  if(Date.now() < cooldownUntil) return;

  const uid = uidInput.value.trim();
  const region = (regionSelect.value || 'BD');

  if(!isValidUid(uid)){
    uidInput.classList.add('invalid');
    setStatus('error', 'UID must be 8–12 digits.');
    return;
  }

  lookupBtn.disabled = true;
  dossier.classList.remove('show');

  const cached = getCached('player', uid, region);
  if(cached){
    renderDossier(cached, uid);
    setStatus('cached', 'Loaded from cache (recently searched).');
    startCooldown(setStatus);
    return;
  }

  setStatus('loading', 'Getting …');

  const url = `/api/lookup?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region.toLowerCase())}`;

  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    if(!res.ok || (data && data.error)){
      const msg = (data && data.error) ? data.error : `Request failed (${res.status}).`;
      setStatus('error', msg, { retry: () => { clearStatus(); lookupPlayer(); } });
      lookupBtn.disabled = false;
      return;
    }
    if(!data){
      setStatus('error', 'Empty or unreadable response.', { retry: () => { clearStatus(); lookupPlayer(); } });
      lookupBtn.disabled = false;
      return;
    }

    setCached('player', uid, region, data);
    renderDossier(data, uid);
    clearStatus();
    startCooldown(setStatus);
  }catch(err){
    setStatus('error', 'Request blocked or network error.', { retry: () => { clearStatus(); lookupPlayer(); } });
    lookupBtn.disabled = false;
  }
}

function renderDossier(data, uidForDisplay){
  const acc = data.AccountInfo || {};
  const profile = data.AccountProfileInfo || {};
  const guild = data.GuildInfo || {};
  const social = data.socialinfo || {};
  const pet = data.petInfo || {};

  document.getElementById('playerName').textContent = acc.AccountName || 'Unknown Player';
  document.getElementById('playerRegion').textContent = acc.AccountRegion || regionSelect.value || 'AUTO';
  document.getElementById('playerSub').textContent = `UID ${acc.AccountId || uidForDisplay || uidInput.value} · Level ${acc.AccountLevel ?? '—'} · Season ${acc.AccountSeasonId ?? '—'}`;

  // Populate the banner card: level badge, and the avatar/banner images
  // (resolved the same way as the Equipped Items thumbnails below).
  const levelBadge = document.getElementById('playerLevelBadge');
  levelBadge.textContent = acc.AccountLevel != null ? `Lv ${acc.AccountLevel}` : '';
  const bannerImg = document.getElementById('dossierBannerImg');
  const avatarImg = document.getElementById('dossierAvatarImg');
  loadEquipImage(bannerImg, acc.AccountBannerId, () => {});
  loadEquipImage(avatarImg, acc.AccountAvatarId, () => {});

  fillGrid(document.getElementById('gridAccount'), [
    ['Level', acc.AccountLevel],
    ['EXP', acc.AccountEXP?.toLocaleString?.() ?? acc.AccountEXP],
    ['Likes', acc.AccountLikes?.toLocaleString?.() ?? acc.AccountLikes, true],
    ['Region', acc.AccountRegion],
    ['Created', acc.AccountCreateTime],
    ['Last Login', acc.AccountLastLogin],
    ['Title', acc.Title],
  ]);

  fillGrid(document.getElementById('gridProfile'), [
    ['BR Rank Points', acc.BrRankPoint, true],
    ['BR Max Rank', acc.BrMaxRank],
    ['CS Rank Points', acc.CsRankPoint, true],
    ['CS Max Rank', acc.CsMaxRank],
  ]);

  const guildGrid = document.getElementById('gridGuild');
  if(guild.GuildID){
    fillGrid(guildGrid, [
      ['Guild Name', guild.GuildName],
      ['Guild Level', guild.GuildLevel],
      ['Guild ID', guild.GuildID],
      ['Members', guild.GuildMember ? `${guild.GuildMember}/${guild.GuildCapacity}` : null],
    ]);
    document.getElementById('secGuild').style.display = '';
  }else{
    document.getElementById('secGuild').style.display = 'none';
  }

  const gridEquip = document.getElementById('gridEquip');
  gridEquip.innerHTML = '';
  if(acc.AccountAvatarId) gridEquip.appendChild(equipImageStat('Avatar', acc.AccountAvatarId));
  if(acc.AccountBannerId) gridEquip.appendChild(equipImageStat('Banner', acc.AccountBannerId));
  if(pet.skinId) gridEquip.appendChild(equipImageStat('Pet', pet.skinId));

  const gridLoadout = document.getElementById('gridLoadout');
  gridLoadout.innerHTML = '';
  (acc.EquippedWeapon || []).forEach((id, i) => {
    if(id) gridLoadout.appendChild(equipImageStat(acc.EquippedWeapon.length > 1 ? `Weapon ${i + 1}` : 'Weapon', id));
  });
  (profile.EquippedOutfit || []).forEach((id, i) => {
    if(id) gridLoadout.appendChild(equipImageStat(`Outfit ${i + 1}`, id));
  });
  document.getElementById('secLoadout').style.display = gridLoadout.children.length ? '' : 'none';

  fillGrid(document.getElementById('gridSocial'), [
    ['Account ID', acc.AccountId],
    ['Language', (social.AccountLanguage || '').replace('Language_', '')],
    ['Prefer Mode', (social.AccountPreferMode || '').replace('Prefermode_', '')],
    ['Signature', social.AccountSignature],
    ['Pet Name', pet.name],
    ['Pet Level', pet.level],
  ]);

  dossier.classList.add('show');
}

lookupBtn.addEventListener('click', lookupPlayer);
uidInput.addEventListener('keydown', e => { if(e.key === 'Enter') lookupPlayer(); });

// ── Tab switching ──
const toolTabs = document.querySelectorAll('.tool-tab');
const toolPanels = {
  player: document.getElementById('panelPlayer'),
  guild: document.getElementById('panelGuild'),
  nickname: document.getElementById('panelNickname'),
};
toolTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    toolTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.values(toolPanels).forEach(p => p.style.display = 'none');
    toolPanels[tab.dataset.tool].style.display = '';
  });
});

// ── Guild Lookup ──
const guildIdInput = document.getElementById('guildId');
const guildRegionSelect = document.getElementById('guildRegion');
const guildLookupBtn = document.getElementById('guildLookupBtn');
const guildStatusEl = document.getElementById('guildStatus');
const guildStatusText = document.getElementById('guildStatusText');
const guildDossier = document.getElementById('guildDossier');
const { setStatus: setGuildStatus, clearStatus: clearGuildStatus } = makeStatusHelpers(guildStatusEl, guildStatusText);

async function lookupGuild(){
  if(Date.now() < cooldownUntil) return;

  const id = guildIdInput.value.trim();
  const region = (guildRegionSelect.value || 'BD').toLowerCase();
  if(!id){ setGuildStatus('error', 'Enter a guild ID first.'); return; }

  guildLookupBtn.disabled = true;
  guildDossier.classList.remove('show');

  const cached = getCached('guild', id, region);
  if(cached){
    paintGuild(cached, id, region);
    setGuildStatus('cached', 'Loaded from cache (recently searched).');
    startCooldown(setGuildStatus);
    return;
  }

  setGuildStatus('loading', 'Getting …');

  const url = `/api/guild?id=${encodeURIComponent(id)}&region=${encodeURIComponent(region)}`;
  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.success === false){
      setGuildStatus('error', (data && (data.error || data.message)) || `Request failed (${res.status}).`, { retry: () => { clearGuildStatus(); lookupGuild(); } });
      return;
    }
    setCached('guild', id, region, data);
    paintGuild(data, id, region);
    clearGuildStatus();
    startCooldown(setGuildStatus);
  }catch(err){
    setGuildStatus('error', 'Request blocked or network error.', { retry: () => { clearGuildStatus(); lookupGuild(); } });
  }finally{
    guildLookupBtn.disabled = false;
  }
}

function paintGuild(data, id, region){
  const g = (data.GuildInfoResponse && data.GuildInfoResponse.GuildInfo) || {};
  document.getElementById('guildName').textContent = g.GuildName || 'Unknown Guild';
  document.getElementById('guildRegionOut').textContent = g.GuildRegion || region.toUpperCase();
  document.getElementById('guildSub').textContent = `Guild ID ${g.GuildId || id} · Level ${g.GuildLevel ?? '—'}`;
  fillGrid(document.getElementById('gridGuildLookup'), [
    ['Members', g.GuildCurrentMembers != null ? `${g.GuildCurrentMembers}/${g.GuildCapacity}` : null],
    ['Level', g.GuildLevel],
    ['Leader UID', g.GuildLeaderUID],
    ['Activity Points', g.GuildActivityPoint, true],
    ['Weekly Activity', g.GuildWeeklyActivityPoint, true],
    ['Slogan', g.GuildSlogan],
    ['Created', g.GuildCreateTime ? fmtTimestamp(g.GuildCreateTime) : null],
  ]);
  guildDossier.classList.add('show');
}

guildLookupBtn.addEventListener('click', lookupGuild);
guildIdInput.addEventListener('keydown', e => { if(e.key === 'Enter') lookupGuild(); });

// ── Nickname Lookup ──
const nickUidInput = document.getElementById('nickUid');
const nickRegionSelect = document.getElementById('nickRegion');
const nickLookupBtn = document.getElementById('nickLookupBtn');
const nickStatusEl = document.getElementById('nickStatus');
const nickStatusText = document.getElementById('nickStatusText');
const nickDossier = document.getElementById('nickDossier');
const { setStatus: setNickStatus, clearStatus: clearNickStatus } = makeStatusHelpers(nickStatusEl, nickStatusText);
wireDigitsOnly(nickUidInput, 12);

async function lookupNickname(){
  if(Date.now() < cooldownUntil) return;

  const uid = nickUidInput.value.trim();
  const region = (nickRegionSelect.value || 'BD').toLowerCase();

  if(!isValidUid(uid)){
    nickUidInput.classList.add('invalid');
    setNickStatus('error', 'UID must be 8–12 digits.');
    return;
  }

  nickLookupBtn.disabled = true;
  nickDossier.classList.remove('show');

  const cached = getCached('nickname', uid, region);
  if(cached){
    paintNickname(cached, uid, region);
    setNickStatus('cached', 'Loaded from cache (recently searched).');
    startCooldown(setNickStatus);
    return;
  }

  setNickStatus('loading', 'Getting …');

  const url = `/api/nickname?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}`;
  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.success === false){
      setNickStatus('error', (data && (data.error || data.message)) || `Request failed (${res.status}).`, { retry: () => { clearNickStatus(); lookupNickname(); } });
      return;
    }
    setCached('nickname', uid, region, data);
    paintNickname(data, uid, region);
    clearNickStatus();
    startCooldown(setNickStatus);
  }catch(err){
    setNickStatus('error', 'Request blocked or network error.', { retry: () => { clearNickStatus(); lookupNickname(); } });
  }finally{
    nickLookupBtn.disabled = false;
  }
}

function paintNickname(data, uid, region){
  document.getElementById('nickName').textContent = data.nickname || 'Unknown Player';
  document.getElementById('nickRegionOut').textContent = (data.region || region).toUpperCase();
  document.getElementById('nickSub').textContent = `UID ${data.player_id || uid} · Level ${data.level ?? '—'}`;
  fillGrid(document.getElementById('gridNickname'), [
    ['Nickname', data.nickname],
    ['Level', data.level],
    ['Likes', data.likes?.toLocaleString?.() ?? data.likes, true],
    ['Region', (data.region || region).toUpperCase()],
  ]);
  nickDossier.classList.add('show');
}

nickLookupBtn.addEventListener('click', lookupNickname);
nickUidInput.addEventListener('keydown', e => { if(e.key === 'Enter') lookupNickname(); });

// ── Download / Share dossier as an image with a QR code back to the site ──
// Requires html2canvas + qrcodejs (loaded via <script> tags in index.html)

function ensureShareCanvasWrap(){
  let wrap = document.getElementById('shareCanvasWrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'shareCanvasWrap';
    wrap.style.cssText = 'position:fixed;left:-99999px;top:0;';
    document.body.appendChild(wrap);
  }
  return wrap;
}

function buildQrDataUrl(text){
  return new Promise((resolve) => {
    const wrap = ensureShareCanvasWrap();
    wrap.innerHTML = '';
    // eslint-disable-next-line no-undef
    new QRCode(wrap, { text, width: 96, height: 96, colorDark: '#120A04', colorLight: '#FFF6E9' });
    setTimeout(() => {
      const img = wrap.querySelector('img');
      const canvas = wrap.querySelector('canvas');
      const dataUrl = img ? img.src : (canvas ? canvas.toDataURL() : '');
      resolve(dataUrl);
    }, 60);
  });
}

// Finds the already-loaded avatar/banner <img> inside a dossier's Equipped
// Items grid (matched by its label), so the share card can reuse the same
// resolved image URL instead of re-fetching it.
function getEquipImgSrc(dossierEl, label){
  const stats = dossierEl.querySelectorAll('.equip-stat');
  for(const stat of stats){
    const k = stat.querySelector('.k');
    const img = stat.querySelector('img.loaded');
    if(k && img && k.textContent.trim() === label) return img.src;
  }
  return null;
}

// Builds a compact in-game-style player card (banner background, avatar,
// name, level, UID) to use as the share image's header, in place of the
// plain text header. Only meaningful for the player dossier, which has
// avatar/banner data; other dossiers keep their normal header.
function buildPlayerCardHeader(dossierEl){
  const name = dossierEl.querySelector('#playerName')?.textContent || 'Unknown Player';
  const region = dossierEl.querySelector('#playerRegion')?.textContent || '';
  const subText = dossierEl.querySelector('#playerSub')?.textContent || '';
  const levelMatch = subText.match(/Level\s+([0-9]+)/i);
  const level = levelMatch ? levelMatch[1] : null;
  const uidMatch = subText.match(/UID\s+([0-9]+)/i);
  const uid = uidMatch ? uidMatch[1] : '';
  const guildNameEl = document.getElementById('gridGuild')?.querySelector('.stat .v');
  const guildName = document.getElementById('secGuild')?.style.display !== 'none' ? (guildNameEl?.textContent || '') : '';

  const bannerUrl = getEquipImgSrc(dossierEl, 'Banner');
  const avatarUrl = getEquipImgSrc(dossierEl, 'Avatar');

  const card = document.createElement('div');
  card.style.cssText = 'position:relative;width:100%;height:180px;border-radius:4px;overflow:hidden;margin-bottom:24px;background:linear-gradient(165deg,#1F1409,#2A1B0C);border:1px solid #4A2E13;';

  if(bannerUrl){
    const bg = document.createElement('img');
    bg.src = bannerUrl;
    bg.crossOrigin = 'anonymous';
    bg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    card.appendChild(bg);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:linear-gradient(180deg, rgba(18,10,4,0.15) 0%, rgba(18,10,4,0.85) 100%);';
  card.appendChild(overlay);

  if(level){
    const badge = document.createElement('div');
    badge.textContent = `Lv ${level}`;
    badge.style.cssText = 'position:absolute;top:12px;right:12px;background:#FFD400;color:#120A04;font-family:Rajdhani,sans-serif;font-weight:800;font-size:13px;letter-spacing:0.04em;padding:4px 12px;border-radius:3px;';
    card.appendChild(badge);
  }

  if(region){
    const regionBadge = document.createElement('div');
    regionBadge.textContent = region;
    regionBadge.style.cssText = 'position:absolute;top:12px;left:12px;background:rgba(255,122,24,0.9);color:#120A04;font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:11px;letter-spacing:0.06em;padding:3px 9px;border-radius:3px;';
    card.appendChild(regionBadge);
  }

  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'position:absolute;left:16px;bottom:14px;right:16px;display:flex;align-items:center;gap:12px;';

  if(avatarUrl){
    const avatar = document.createElement('img');
    avatar.src = avatarUrl;
    avatar.crossOrigin = 'anonymous';
    avatar.style.cssText = 'width:56px;height:56px;border-radius:50%;border:2px solid #FFD400;object-fit:cover;background:#1A0F06;flex-shrink:0;';
    infoRow.appendChild(avatar);
  }

  const textCol = document.createElement('div');
  textCol.innerHTML = `
    <div style="font-family:Rajdhani,sans-serif;font-weight:800;font-size:21px;color:#FFF6E9;line-height:1.2;">${name}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#D9AF80;margin-top:2px;">UID ${uid}${guildName ? ' · ' + guildName : ''}</div>
  `;
  infoRow.appendChild(textCol);
  card.appendChild(infoRow);

  return card;
}

async function renderShareImage(dossierEl){
  const siteUrl = window.location.origin + window.location.pathname;
  const qrDataUrl = await buildQrDataUrl(siteUrl);

  const clone = dossierEl.cloneNode(true);
  clone.classList.add('show');
  clone.querySelector('.dossier-actions')?.remove();

  // For the player dossier, swap the plain text header for a compact
  // in-game-style card (banner + avatar + name + level).
  if(dossierEl.id === 'dossier'){
    const card = buildPlayerCardHeader(dossierEl);
    clone.querySelector('.dossier-head')?.remove();
    clone.querySelector('.dossier-sub')?.remove();
    clone.insertBefore(card, clone.firstChild);
  }

  // The dossier's sections fade in via a CSS animation when they first
  // appear (opacity:0 -> 1). The clone starts that animation fresh, and
  // html2canvas would otherwise capture it mid-fade (often at opacity:0,
  // i.e. a blank image). Force everything fully visible and static.
  clone.style.animation = 'none';
  clone.style.opacity = '1';
  clone.querySelectorAll('.section').forEach(sec => {
    sec.style.animation = 'none';
    sec.style.opacity = '1';
    sec.style.transform = 'none';
  });

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid #4A2E13;';
  footer.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#D9AF80;line-height:1.5;">
      FREEFIRE INFO — HELIX TANVIR<br>${siteUrl}
    </div>
    <img src="${qrDataUrl}" width="72" height="72" style="border-radius:2px;">
  `;
  clone.appendChild(footer);

  const container = document.createElement('div');
  container.style.cssText = 'width:880px;padding:28px;background:#1F1409;font-family:\'IBM Plex Mono\',monospace;color:#FFF6E9;';
  container.appendChild(clone);

  const wrap = ensureShareCanvasWrap();
  wrap.innerHTML = '';
  wrap.appendChild(container);

  // Give the browser a couple of frames to finish layout, and wait for
  // any equip-item images in the clone to finish loading, so the capture
  // isn't taken mid-paint.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
    setTimeout(res, 1500); // safety timeout so one slow/broken image can't block the whole capture
  })));

  // eslint-disable-next-line no-undef
  const canvas = await html2canvas(container, { backgroundColor: '#1F1409', scale: 2, useCORS: true });
  wrap.innerHTML = '';
  return canvas;
}

function wireDossierActions(dossierEl, filenamePrefix, idValueFn){
  const actions = document.createElement('div');
  actions.className = 'dossier-actions';
  actions.innerHTML = `
    <button class="ghost dl-btn">⬇ Download as Image</button>
    <button class="ghost share-btn">↗ Share</button>
  `;
  dossierEl.appendChild(actions);

  const dlBtn = actions.querySelector('.dl-btn');
  const shareBtn = actions.querySelector('.share-btn');

  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    try{
      const canvas = await renderShareImage(dossierEl);
      const link = document.createElement('a');
      link.download = `${filenamePrefix}-${idValueFn() || 'result'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }catch(e){
      console.error(e);
    }finally{
      dlBtn.disabled = false;
    }
  });

  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    try{
      const canvas = await renderShareImage(dossierEl);
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `${filenamePrefix}-${idValueFn() || 'result'}.png`, { type: 'image/png' });
        if(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
          await navigator.share({
            files: [file],
            title: 'FF Intel Lookup',
            text: `Check out this Free Fire lookup — ${window.location.origin}${window.location.pathname}`
          });
        }else{
          const link = document.createElement('a');
          link.download = file.name;
          link.href = URL.createObjectURL(blob);
          link.click();
        }
        shareBtn.disabled = false;
      }, 'image/png');
    }catch(e){
      console.error(e);
      shareBtn.disabled = false;
    }
  });
}

// Add download/share controls to all three dossiers.
wireDossierActions(dossier, 'ff-info', () => uidInput.value);
wireDossierActions(guildDossier, 'ff-guild', () => guildIdInput.value);
wireDossierActions(nickDossier, 'ff-nick', () => nickUidInput.value);
