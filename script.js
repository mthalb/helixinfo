// ── API CONFIG ─────────────────────────────────────────────
// FreeFireApi (siambhau) free tier — get your own key at:
// https://siambhau69.eu.cc/GetFreeApiKey
// Requests go through our own /api/* serverless routes, which hold the
// real upstream API key server-side. No key is ever sent to the browser.

const uidInput = document.getElementById('uid');
const regionSelect = document.getElementById('region');
const lookupBtn = document.getElementById('lookupBtn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const dossier = document.getElementById('dossier');

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

// Tries multiple icon sources in order until one loads a real (non-blank) image.
// 1) 0xMe/ff-resources -> BEST-GUESS path based on the ItemID2 README, NOT verified.
//    If it 404s for everything, it just falls straight through — costs one extra
//    failed request per image, nothing else breaks.
// 2) AKIRU-ICONS -> original source.
// 3) iconapi.wasmer.app -> original second fallback.
function loadEquipImage(imgEl, itemID, onUnavailable){
  imgEl.classList.remove('loaded');
  imgEl.removeAttribute('src');
  if(!itemID){ if(onUnavailable) onUnavailable(); return; }

  const urls = [
    `https://cdn.jsdelivr.net/gh/0xMe/ff-resources@main/pngs/300x300/${itemID}.png`,
    `https://cdn.jsdelivr.net/gh/I-SHOW-AKIRU200/AKIRU-ICONS@main/ICONS/${itemID}.png`,
    `https://iconapi.wasmer.app/${itemID}`
  ];
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

function setStatus(kind, text){
  statusEl.className = 'status show ' + kind;
  statusText.textContent = text;
}
function clearStatus(){
  statusEl.className = 'status';
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

async function lookupPlayer(){
  const uid = uidInput.value.trim();
  const region = (regionSelect.value || 'BD');

  if(!uid){ setStatus('error', 'Enter a UID first.'); return; }
  lookupBtn.disabled = true;
  dossier.classList.remove('show');
  setStatus('loading', 'Getting …');

  const url = `/api/lookup?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region.toLowerCase())}`;

  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    if(!res.ok || (data && data.error)){
      const msg = (data && data.error) ? data.error : `Request failed (${res.status}).`;
      setStatus('error', msg);
      lookupBtn.disabled = false;
      return;
    }
    if(!data){
      setStatus('error', 'Empty or unreadable response.');
      lookupBtn.disabled = false;
      return;
    }

    renderDossier(data);
    clearStatus();
  }catch(err){
    setStatus('error', 'Request blocked or network error.');
  }finally{
    lookupBtn.disabled = false;
  }
}

// ggwhitehawk /info response shape mapped onto the same grids.
function renderDossier(data){
  const acc = data.AccountInfo || {};
  const profile = data.AccountProfileInfo || {};
  const guild = data.GuildInfo || {};
  const social = data.socialinfo || {};
  const pet = data.petInfo || {};

  document.getElementById('playerName').textContent = acc.AccountName || 'Unknown Player';
  document.getElementById('playerRegion').textContent = acc.AccountRegion || regionSelect.value || 'AUTO';
  document.getElementById('playerSub').textContent = `UID ${acc.AccountId || uidInput.value} · Level ${acc.AccountLevel ?? '—'} · Season ${acc.AccountSeasonId ?? '—'}`;

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

function setGuildStatus(kind, text){
  guildStatusEl.className = 'status show ' + kind;
  guildStatusText.textContent = text;
}
function clearGuildStatus(){ guildStatusEl.className = 'status'; }

async function lookupGuild(){
  const id = guildIdInput.value.trim();
  const region = (guildRegionSelect.value || 'BD').toLowerCase();
  if(!id){ setGuildStatus('error', 'Enter a guild ID first.'); return; }

  guildLookupBtn.disabled = true;
  guildDossier.classList.remove('show');
  setGuildStatus('loading', 'Getting …');

  const url = `/api/guild?id=${encodeURIComponent(id)}&region=${encodeURIComponent(region)}`;
  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.success === false){
      setGuildStatus('error', (data && (data.error || data.message)) || `Request failed (${res.status}).`);
      return;
    }
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
    clearGuildStatus();
  }catch(err){
    setGuildStatus('error', 'Request blocked or network error.');
  }finally{
    guildLookupBtn.disabled = false;
  }
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

function setNickStatus(kind, text){
  nickStatusEl.className = 'status show ' + kind;
  nickStatusText.textContent = text;
}
function clearNickStatus(){ nickStatusEl.className = 'status'; }

async function lookupNickname(){
  const uid = nickUidInput.value.trim();
  const region = (nickRegionSelect.value || 'BD').toLowerCase();
  if(!uid){ setNickStatus('error', 'Enter a UID first.'); return; }

  nickLookupBtn.disabled = true;
  nickDossier.classList.remove('show');
  setNickStatus('loading', 'Getting …');

  const url = `/api/nickname?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}`;
  try{
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.success === false){
      setNickStatus('error', (data && (data.error || data.message)) || `Request failed (${res.status}).`);
      return;
    }
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
    clearNickStatus();
  }catch(err){
    setNickStatus('error', 'Request blocked or network error.');
  }finally{
    nickLookupBtn.disabled = false;
  }
}
nickLookupBtn.addEventListener('click', lookupNickname);
nickUidInput.addEventListener('keydown', e => { if(e.key === 'Enter') lookupNickname(); });
