import * as THREE from 'three';
import { createStage } from './stage.mjs';
import { createRobot } from './model.mjs';
import { MOTIONS, applyMotion } from './motion.mjs';
import { SKINS, createSkinController } from './skins.mjs';
import { createClassroom } from './classroom.mjs';
import { reply, SUGGESTIONS } from './bolt-chat.mjs';
import { SONGS, createSongPlayer, lyricLine } from './bolt-songs.mjs';
import { ICONS } from './bolt-icons.mjs';

// Kid-facing robot classroom. One tap = one thing happens: the robot moves, says a short English line (read aloud
// when the browser can) and writes it on the board. Chat and songs run in the page; nothing is sent anywhere.
const ACTIONS = [
  { key: 'wave',  icon: 'handWaving',       vi: 'Vẫy tay',    en: 'Hello!',            say: 'Xin chào bạn!',         look: 'happy',     tone: 'why-sun' },
  { key: 'jump',  icon: 'personArmsSpread', vi: 'Nhảy lên',   en: 'Jump!',             say: 'Nhảy thật cao nào!',    look: 'surprised', tone: 'why-sky' },
  { key: 'dance', icon: 'musicNotes',       vi: 'Nhún nhảy',  en: "Let's dance!",      say: 'Cùng nhảy nào!',        look: 'happy',     tone: 'why-coral' },
  { key: 'walk',  icon: 'personSimpleWalk', vi: 'Đi bộ',      en: "Let's walk!",       say: 'Đi dạo thôi!',          look: 'curious',   tone: 'why-mint' },
  { key: 'run',   icon: 'personSimpleRun',  vi: 'Chạy',       en: 'Run, run, run!',    say: 'Chạy thật nhanh!',      look: 'surprised', tone: 'why-violet' },
  { key: 'talk',  icon: 'chatCircleDots',   vi: 'Nói chuyện', en: 'Nice to meet you!', say: 'Rất vui được gặp bạn!', look: 'curious',   tone: 'why-teal' }
];
const OUTFITS = ['bdu', 'original', 'assistant', 'mecha'];
const ACTION_SECONDS = 3;

const $ = id => document.getElementById(id);
const icon = name => { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = ICONS[name]; return s; };
const el = (tag, props = {}, ...children) => { const n = Object.assign(document.createElement(tag), props); n.append(...children); return n; };
document.querySelectorAll('[data-icon]').forEach(s => { s.innerHTML = ICONS[s.dataset.icon]; });
const logo = document.querySelector('.logo-img');
const logoFallback = () => logo.replaceWith(el('span', { className: 'brand-bolt', textContent: 'Bolt' }));
if (logo.complete && !logo.naturalWidth) logoFallback(); else logo.addEventListener('error', logoFallback);

const bubble = $('robot-bubble');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = n => { const t = THREE.MathUtils.clamp(n, 0, 1); return t * t * (3 - 2 * t); };
function show(en, vi) {
  bubble.replaceChildren(el('b', { textContent: en }), el('span', { textContent: vi }));
  if (!reducedMotion) { bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
}

// Speech: English line, then the Vietnamese one when the device has a Vietnamese voice.
const canSpeak = 'speechSynthesis' in window;
let soundOn = true, speaking = false;
const soundBtn = $('robot-sound');
function setSound(on) {
  soundOn = on; soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.querySelector('.ico').innerHTML = ICONS[on ? 'speakerHigh' : 'speakerSlash'];
  soundBtn.querySelector('.nav-sound-label').textContent = on ? 'Âm thanh: bật' : 'Âm thanh: tắt';
  soundBtn.setAttribute('aria-label', on ? 'Tắt âm thanh' : 'Bật âm thanh');
  if (!on) { canSpeak && speechSynthesis.cancel(); songs.stop(); }
}
function speak(en, vi) {
  if (!soundOn || !canSpeak) return;
  speechSynthesis.cancel();
  const lines = [[en, 'en-US']];
  if (vi && speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith('vi'))) lines.push([vi, 'vi-VN']);
  lines.forEach(([text, lang], i) => {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = .92; u.pitch = lang === 'en-US' ? 1.3 : 1.1;
    if (i === 0) u.onstart = () => { speaking = true; };
    if (i === lines.length - 1) u.onend = u.onerror = () => { speaking = false; };
    speechSynthesis.speak(u);
  });
}
const songs = createSongPlayer();

try {
  const { renderer, scene, camera, controls } = createStage($('robot-stage'), { label: 'Phòng học 3D với robot Bolt. Kéo sang trái hoặc phải để xoay.' });
  const room = createClassroom(); scene.add(room.root);
  document.fonts?.ready.then(() => room.redraw());
  const rig = createRobot(); scene.add(rig.root);
  const skins = createSkinController(rig);
  // Look into the room from the doorway; one-finger drag turns left/right only, the wheel and vertical swipes scroll the page.
  controls.enableZoom = false; controls.enablePan = false;
  controls.minAzimuthAngle = -.5; controls.maxAzimuthAngle = .5;
  // Portrait screens widen the field of view (stage.mjs), so the camera steps closer to keep the robot large.
  const frame = () => {
    const portrait = camera.aspect < 1, azimuth = controls.getAzimuthalAngle?.() || 0, d = portrait ? .92 : 1.36;
    controls.target.set(0, portrait ? .24 : .27, -.1);
    camera.position.set(Math.sin(azimuth) * d, portrait ? .33 : .36, -.1 + Math.cos(azimuth) * d);
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.update();
    controls.minPolarAngle = controls.maxPolarAngle = controls.getPolarAngle();
  };
  new ResizeObserver(() => requestAnimationFrame(frame)).observe($('robot-stage'));
  renderer.domElement.style.touchAction = 'pan-y';

  let motion = 'idle', time = 0, until = 0, look = 'happy', deploy = 1, singing = null;
  const pressOnly = (buttons, key, attr) => buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === key)));

  // Actions
  const actionButtons = ACTIONS.map(a => {
    const b = el('button', { type: 'button', className: `why-card ${a.tone} robot-action` }, icon(a.icon), el('strong', { textContent: a.vi }), el('small', { textContent: a.en }));
    b.dataset.action = a.key; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `${a.vi} (${a.en})`);
    b.onclick = () => { act(a.key); show(a.en, a.say); room.setBoard({ title: a.en, sub: a.say }); speak(a.en); };
    return b;
  });
  $('robot-actions').replaceChildren(...actionButtons.map(b => el('li', {}, b)));
  function act(key) {
    stopSong();
    const a = ACTIONS.find(x => x.key === key);
    motion = key; time = 0; look = a.look;
    until = Math.max(MOTIONS.find(m => m.key === key).duration, ACTION_SECONDS);
    pressOnly(actionButtons, key, 'action');
  }

  // Songs
  const songButtons = SONGS.map(s => {
    const b = el('button', { type: 'button', className: `why-card ${s.tone} song` }, icon(s.icon), el('strong', { textContent: s.title }), el('small', { textContent: s.vi }));
    b.dataset.song = s.id; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => (singing === s.id ? stopSong(true) : sing(s.id));
    return b;
  });
  $('song-list').replaceChildren(...songButtons);
  function sing(id) {
    const song = SONGS.find(s => s.id === id);
    stopSong(); canSpeak && speechSynthesis.cancel();
    singing = id; motion = 'dance'; time = 0; until = Infinity; look = 'happy';
    pressOnly(songButtons, id, 'song'); pressOnly(actionButtons, '', 'action');
    songButtons.find(b => b.dataset.song === id).querySelector('small').textContent = 'Chạm để dừng';
    show(song.title, `Cùng hát: ${song.vi}`);
    if (!soundOn || !songs.supported) { room.setBoard({ title: song.title, sub: 'Bật âm thanh để nghe robot hát' }); return; }
    songs.play(song, {
      onWord: (li, wi) => {
        const words = song.lines[li].map(w => w[0]);
        room.setBoard({ words, active: wi, sub: song.vi });
        if (wi === 0) show(lyricLine(song.lines[li]), song.vi);
      },
      onEnd: () => { stopSong(); show('Yay! Great singing!', 'Bé hát hay quá!'); room.setBoard({ title: 'Great job!', sub: 'Giỏi lắm!' }); }
    });
  }
  function stopSong(said) {
    if (!singing) return;
    const song = SONGS.find(s => s.id === singing);
    songButtons.find(b => b.dataset.song === singing).querySelector('small').textContent = song.vi;
    singing = null; songs.stop(); motion = 'idle'; time = 0;
    pressOnly(songButtons, '', 'song');
    if (said) { show('See you next song!', 'Lần sau hát tiếp nhé!'); room.setBoard({ title: 'Bravo!', sub: 'Hát hay lắm' }); }
  }

  // Outfits
  const outfitButtons = OUTFITS.map(id => SKINS.find(s => s.id === id)).map(skin => {
    const dots = el('i', {}, ...skin.swatches.map(c => { const d = el('span'); d.style.setProperty('--swatch', c); return d; }));
    dots.setAttribute('aria-hidden', 'true');
    const b = el('button', { type: 'button', className: 'chip robot-outfit' }, dots, skin.label);
    b.dataset.skin = skin.id; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { wear(skin.id); show('Looking good!', `Mình mặc ${skin.label} rồi nè!`); speak('Looking good!'); };
    return b;
  });
  $('robot-outfits').replaceChildren(...outfitButtons);
  function wear(id) {
    const skin = skins.apply(id);
    deploy = skin.design && !reducedMotion ? 0 : 1;
    pressOnly(outfitButtons, id, 'skin');
  }
  wear(OUTFITS[0]);

  // Chat
  const log = $('chat-log'), input = $('chat-input');
  function addMessage(who, text, sub) {
    const p = el('p', {}, who === 'bot' ? el('b', { textContent: text }) : text);
    if (sub) p.append(el('small', { textContent: sub }));
    const li = el('li', { className: `chat-msg ${who}` }, ...(who === 'bot' ? [icon('robot'), p] : [p]));
    log.append(li); while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function talk(text) {
    const said = text.trim().slice(0, 80); if (!said) return;
    addMessage('kid', said);
    const r = reply(said);
    setTimeout(() => {
      addMessage('bot', r.en, r.vi); show(r.en, r.vi);
      if (r.song) { sing(r.song); return; }
      room.setBoard(r.board || { title: r.en, sub: r.vi });
      if (r.action) act(r.action);
      speak(r.en, r.vi);
    }, 350);
  }
  $('chat-chips').replaceChildren(...SUGGESTIONS.map(s => {
    const b = el('button', { type: 'button', className: 'chip chat-chip' }, icon(s.icon), s.text);
    b.onclick = () => talk(s.text); return b;
  }));
  $('chat-form').onsubmit = e => { e.preventDefault(); talk(input.value); input.value = ''; };
  addMessage('bot', "Hello! I'm Bolt!", 'Xin chào! Bé chạm vào gợi ý hoặc gõ tin nhắn để nói chuyện với mình nhé.');

  if (canSpeak) { soundBtn.onclick = () => setSound(!soundOn); setSound(true); }
  else { soundBtn.onclick = () => setSound(!soundOn); setSound(songs.supported); }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), .05);
    deploy = Math.min(1, deploy + dt / 1.25);
    if (!document.hidden) time += dt;
    if (motion !== 'idle' && time >= until) { motion = 'idle'; time = 0; look = 'happy'; pressOnly(actionButtons, '', 'action'); }
    skins.setContext({ armor: 0, deploy: smooth(deploy), expression: look });
    applyMotion(rig, motion, time, { blinkEnabled: true, mouthEnabled: motion === 'talk' || speaking || !!singing });
    controls.update(dt); renderer.render(scene, camera);
  });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); show('Oops!', 'Tải lại trang để chơi tiếp nhé.'); });
  window.boltRoom = { rig, act, sing, stopSong, talk, wear, get state() { return { motion, time, singing, skin: skins.current.id }; } };
} catch (error) {
  console.error(error);
  $('robot-stage').replaceChildren(el('p', { className: 'robot-error', textContent: 'Trình duyệt chưa bật đồ họa 3D (WebGL). Bé nhờ bố mẹ mở bằng trình duyệt khác nhé.' }));
  bubble.hidden = true;
}
