// Public-domain children's songs: Twinkle Twinkle Little Star (Jane Taylor, 1806), the ABC song (same traditional
// melody) and Row, Row, Row Your Boat (1852). Each entry is [syllable, MIDI note, length in beats]; a leading '-'
// joins the syllable to the one before it (Twin-kle).
export const lyricLine = line => line.reduce((s, [w]) => w.startsWith('-') ? s + w.slice(1) : s + (s ? ' ' : '') + w, '');
const TWINKLE_A = [['Twin',60,1],['-kle',60,1],['twin',67,1],['-kle',67,1],['lit',69,1],['-tle',69,1],['star',67,2]];
const TWINKLE_B = [['How',65,1],['I',65,1],['won',64,1],['-der',64,1],['what',62,1],['you',62,1],['are',60,2]];
export const SONGS = [
  { id: 'twinkle', title: 'Twinkle Twinkle', vi: 'Ngôi sao lấp lánh', icon: 'star', tone: 'why-sun', beat: .5, lines: [
    TWINKLE_A, TWINKLE_B,
    [['Up',67,1],['a',67,1],['-bove',65,1],['the',65,1],['world',64,1],['so',64,1],['high',62,2]],
    [['Like',67,1],['a',67,1],['dia',65,1],['-mond',65,1],['in',64,1],['the',64,1],['sky',62,2]],
    TWINKLE_A, TWINKLE_B
  ] },
  { id: 'abc', title: 'ABC Song', vi: 'Bài hát chữ cái', icon: 'textAa', tone: 'why-coral', beat: .5, lines: [
    [['A',60,1],['B',60,1],['C',67,1],['D',67,1],['E',69,1],['F',69,1],['G',67,2]],
    [['H',65,1],['I',65,1],['J',64,1],['K',64,1],['L',62,.5],['M',62,.5],['N',62,.5],['O',62,.5],['P',60,2]],
    [['Q',67,1],['R',67,1],['S',65,2],['T',64,1],['U',64,1],['V',62,2]],
    [['W',67,2],['X',65,2],['Y',64,1],['and',64,1],['Z',62,2]],
    [['Now',60,1],['I',60,1],['know',67,1],['my',67,1],['A',69,1],['B',69,1],["C's",67,2]],
    [['Next',65,1],['time',65,1],["won't",64,1],['you',64,1],['sing',62,1],['with',62,1],['me',60,2]]
  ] },
  { id: 'boat', title: 'Row Your Boat', vi: 'Chèo thuyền', icon: 'sailboat', tone: 'why-sky', beat: .24, lines: [
    [['Row,',60,3],['row,',60,3],['row',60,2],['your',62,1],['boat',64,3]],
    [['gent',64,2],['-ly',62,1],['down',64,2],['the',65,1],['stream',67,6]],
    [['Mer',72,1],['-ri',72,1],['-ly',72,1],['mer',67,1],['-ri',67,1],['-ly',67,1],['mer',64,1],['-ri',64,1],['-ly',64,1],['mer',60,1],['-ri',60,1],['-ly',60,1]],
    [['life',67,2],['is',65,1],['but',64,2],['a',62,1],['dream',60,6]]
  ] }
];

// Plays a song as a soft music-box melody with Web Audio and reports each word as it is sung.
export function createSongPlayer() {
  let audio, timers = [], voices = [];
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    for (const v of voices) { try { v.stop(); } catch {} }
    voices = [];
  }
  function note(at, midi, seconds) {
    const f = 440 * 2 ** ((midi - 69) / 12), out = audio.createGain();
    out.gain.setValueAtTime(0, at); out.gain.linearRampToValueAtTime(.28, at + .015);
    out.gain.exponentialRampToValueAtTime(.001, at + Math.min(1.4, seconds * 1.6 + .25));
    out.connect(audio.destination);
    for (const [type, mult, level] of [['sine', 1, 1], ['triangle', 2, .18], ['sine', 3, .06]]) {
      const osc = audio.createOscillator(), g = audio.createGain();
      osc.type = type; osc.frequency.value = f * mult; g.gain.value = level;
      osc.connect(g).connect(out); osc.start(at); osc.stop(at + 1.8); voices.push(osc);
    }
  }
  function play(song, { onWord = () => {}, onEnd = () => {} } = {}) {
    stop();
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const start = audio.currentTime + .15; let t = 0;
    song.lines.forEach((line, li) => line.forEach(([word, midi, beats], wi) => {
      const seconds = beats * song.beat;
      note(start + t, midi, seconds);
      timers.push(setTimeout(() => onWord(li, wi, seconds), (t + .15) * 1000));
      t += seconds;
    }));
    timers.push(setTimeout(() => { voices = []; onEnd(); }, (t + .6) * 1000));
    return t;
  }
  return { play, stop, get supported() { return !!(window.AudioContext || window.webkitAudioContext); } };
}
