// Robot Bolt's replies. Runs entirely in the page from keyword rules: nothing a child types is sent or stored.
// A reply is { en, vi, action?, song?, board? }; en is read aloud, vi is shown under it.
const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
const has = (text, words) => words.some(w => new RegExp(`(^| )${w}( |$)`).test(text));

const COLORS = [
  { en: 'red', vi: 'đỏ', hex: '#E31C3D' }, { en: 'yellow', vi: 'vàng', hex: '#FFB800' }, { en: 'blue', vi: 'xanh dương', hex: '#1BA3E0' },
  { en: 'green', vi: 'xanh lá', hex: '#00B894' }, { en: 'purple', vi: 'tím', hex: '#7B5CFF' }, { en: 'orange', vi: 'cam', hex: '#FF7A1A' }, { en: 'pink', vi: 'hồng', hex: '#FF5FA2' }
];
const ANIMALS = [
  { en: 'cat', vi: 'con mèo', sound: 'meow', viSound: 'meo meo' }, { en: 'dog', vi: 'con chó', sound: 'woof', viSound: 'gâu gâu' },
  { en: 'duck', vi: 'con vịt', sound: 'quack', viSound: 'cạp cạp' }, { en: 'cow', vi: 'con bò', sound: 'moo', viSound: 'ò ò' },
  { en: 'lion', vi: 'sư tử', sound: 'roar', viSound: 'gừ gừ' }
];
let colorTurn = 0, animalTurn = 0;

export const SUGGESTIONS = [
  { text: 'Hello!', icon: 'handWaving' }, { text: 'Bạn tên gì?', icon: 'robot' }, { text: 'Màu gì đây?', icon: 'palette' },
  { text: 'Đếm số nhé', icon: 'numberCircleFive' }, { text: 'Con vật', icon: 'cat' }, { text: 'Hát một bài', icon: 'musicNotes' },
  { text: 'Tạm biệt', icon: 'handHeart' }
];

export function reply(raw) {
  const text = fold(raw);
  if (!text) return { en: 'Say something to me!', vi: 'Bé nói gì với mình đi nào!' };
  const name = raw.match(/(?:my name is|tên (?:con|em|mình|tớ|tôi|bé) là|(?:con|em|mình|tớ|tôi|bé) tên là)\s+([\p{L}]{2,20})/iu);
  if (name) {
    const n = name[1][0].toUpperCase() + name[1].slice(1);
    return { en: `Nice to meet you, ${n}!`, vi: `Rất vui được gặp ${n}!`, action: 'wave', board: { title: `Hi, ${n}!`, sub: 'Rất vui được gặp bạn' } };
  }
  if (has(text, ['hat', 'sing', 'song', 'bai hat', 'ca hat'])) return { en: "Let's sing together!", vi: 'Cùng hát với mình nhé!', song: 'twinkle' };
  if (has(text, ['abc', 'chu cai', 'alphabet'])) return { en: "Let's sing the ABC song!", vi: 'Cùng hát bài chữ cái nào!', song: 'abc' };
  if (has(text, ['thuyen', 'boat', 'row'])) return { en: 'Row, row, row your boat!', vi: 'Cùng chèo thuyền nào!', song: 'boat' };
  if (has(text, ['tam biet', 'bye', 'goodbye', 'see you', 'bai bai'])) return { en: 'Goodbye! See you soon!', vi: 'Tạm biệt, hẹn gặp lại bạn nhé!', action: 'wave', board: { title: 'Goodbye!', sub: 'Tạm biệt' } };
  if (has(text, ['cam on', 'thank you', 'thanks', 'thank'])) return { en: "You're welcome!", vi: 'Không có gì đâu bạn!', action: 'wave', board: { title: "You're welcome!", sub: 'Không có gì' } };
  if (has(text, ['ten gi', 'ten ban', 'ten la gi', 'your name', 'who are you', 'ban la ai'])) return { en: 'My name is Bolt!', vi: 'Mình tên là Bolt, robot của Viện Ngoại ngữ Bolt!', action: 'wave', board: { title: 'My name is Bolt', sub: 'Mình tên là Bolt' } };
  if (has(text, ['may tuoi', 'how old', 'bao nhieu tuoi'])) return { en: 'I am one year old!', vi: 'Mình được 1 tuổi rồi!', action: 'jump', board: { title: 'I am one!', sub: 'Mình 1 tuổi' } };
  if (has(text, ['khoe khong', 'how are you', 'co khoe'])) return { en: "I'm great, thank you! And you?", vi: 'Mình khỏe lắm, cảm ơn bạn! Còn bạn thì sao?', action: 'dance', board: { title: "I'm great!", sub: 'Mình khỏe lắm' } };
  if (has(text, ['mau', 'color', 'colour'])) {
    const c = COLORS[colorTurn++ % COLORS.length];
    return { en: `This is ${c.en}!`, vi: `Đây là màu ${c.vi}: ${c.en}!`, action: 'talk', board: { title: c.en.toUpperCase(), sub: `màu ${c.vi}`, color: c.hex } };
  }
  if (has(text, ['dem', 'count', 'so', 'number', 'numbers'])) return { en: 'One, two, three, four, five!', vi: 'Cùng đếm đến 5 nào!', action: 'jump', board: { title: '1 2 3 4 5', sub: 'one · two · three · four · five' } };
  if (has(text, ['con vat', 'animal', 'animals', ...ANIMALS.flatMap(a => [a.en, fold(a.vi)])])) {
    const a = ANIMALS.find(x => has(text, [x.en, fold(x.vi)])) || ANIMALS[animalTurn++ % ANIMALS.length];
    return { en: `The ${a.en} says ${a.sound}!`, vi: `${a.vi[0].toUpperCase() + a.vi.slice(1)} kêu ${a.viSound}!`, action: 'talk', board: { title: a.en.toUpperCase(), sub: `${a.vi} · ${a.sound}!` } };
  }
  if (has(text, ['nhay mua', 'nhun nhay', 'dance', 'mua'])) return { en: "Let's dance!", vi: 'Cùng nhún nhảy nào!', action: 'dance', board: { title: 'Dance!', sub: 'Nhún nhảy' } };
  if (has(text, ['nhay', 'jump'])) return { en: 'Jump, jump, jump!', vi: 'Nhảy thật cao nào!', action: 'jump', board: { title: 'Jump!', sub: 'Nhảy lên' } };
  if (has(text, ['chay', 'run'])) return { en: 'Run, run, run!', vi: 'Chạy thật nhanh!', action: 'run', board: { title: 'Run!', sub: 'Chạy' } };
  if (has(text, ['di bo', 'walk', 'di dao'])) return { en: "Let's walk!", vi: 'Đi dạo thôi!', action: 'walk', board: { title: 'Walk!', sub: 'Đi bộ' } };
  if (has(text, ['hello', 'hi', 'xin chao', 'chao', 'chao ban', 'hey'])) return { en: "Hello! I'm Bolt!", vi: 'Xin chào! Mình là robot Bolt!', action: 'wave', board: { title: 'Hello!', sub: 'Xin chào' } };
  if (has(text, ['thich', 'like', 'love', 'yeu'])) return { en: 'I like learning English with you!', vi: 'Mình thích học tiếng Anh cùng bạn!', action: 'dance', board: { title: 'I like you!', sub: 'Mình thích bạn' } };
  return { en: "Let's learn together!", vi: 'Bạn thử chạm một gợi ý bên dưới nhé!', action: 'talk' };
}
