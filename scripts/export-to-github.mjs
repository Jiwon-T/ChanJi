// 작업 폴더(chanji)에서 GitHub에 올릴 파일만 골라 내보내기 폴더로 복사합니다.
//   npm run export                → ../chanji-github 로 내보내기
//   npm run export -- <폴더 경로>  → 원하는 폴더로 내보내기
//   npm run export -- --force     → 내보내기 폴더에서 직접 고친 파일이 있어도 덮어쓰기
//
// 내보내기 폴더에서 직접 고친 파일(예: 다른 도구가 바꾼 아이콘)이 있으면 덮어쓰지 않고 멈춥니다.
// 그 변경을 작업 폴더에 먼저 반영해야 다음 내보내기에서도 유지됩니다.
//
// 내보내기 폴더가 git 저장소(클론)라면 .git 은 건드리지 않으므로 그대로 commit / push 할 수 있습니다.
// 아니라면 폴더 안의 내용을 GitHub 웹의 "Add file → Upload files"에 끌어다 놓으면 됩니다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const target = path.resolve(root, args.find((a) => !a.startsWith('--')) ?? '../chanji-github');
const MARKER = '.chanji-export';

// 저장소에 넣지 않을 것들 (작업 공간 전용 / 개인 정보 / 설치·빌드 결과물)
const EXCLUDE_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.claude',
  'invitation-photos',
  '.DS_Store',
]);

function excluded(name) {
  if (EXCLUDE_NAMES.has(name)) return true;
  if (name.endsWith('.log')) return true;
  if (name.startsWith('.env') && name !== '.env.example') return true;
  return false;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// 안전장치: 작업 폴더 자신이나 그 안/위쪽 폴더로는 내보내지 않음
const rel = path.relative(root, target);
if (!rel || !rel.startsWith('..') || path.relative(target, root).split(path.sep)[0] !== '..') {
  fail(`내보내기 폴더는 작업 폴더 바깥의 별도 폴더여야 해요: ${target}`);
}

// 폴더 안 파일들의 내용 지문(해시) 목록. .git 과 표시 파일은 제외
function fingerprints(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === MARKER) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) fingerprints(p, base, out);
    else if (entry.isFile()) {
      const key = path.relative(base, p).split(path.sep).join('/');
      out[key] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
    }
  }
  return out;
}

// 안전장치: 처음 보는 폴더(내보내기 표시도, git 저장소도 아닌데 비어 있지 않음)는 지우지 않음
if (fs.existsSync(target)) {
  const entries = fs.readdirSync(target);
  const known = entries.includes(MARKER) || entries.includes('.git');
  if (entries.length > 0 && !known) {
    fail(`${target} 에 다른 파일이 있어요. 빈 폴더나 GitHub 저장소 클론을 지정해 주세요.`);
  }

  // 안전장치: 지난 내보내기 이후 내보내기 폴더에서 직접 고친 파일이 있으면 덮어쓰지 않고 멈춤
  // (예: 다른 도구가 chanji-github 의 아이콘만 바꾼 경우 → 작업 폴더로 먼저 옮겨야 함)
  if (!FORCE && entries.includes(MARKER)) {
    let saved = null;
    try { saved = JSON.parse(fs.readFileSync(path.join(target, MARKER), 'utf8')).files; } catch { /* 예전 형식 표시 파일 */ }
    if (saved) {
      const now = fingerprints(target);
      const changed = Object.keys(now).filter((f) => saved[f] !== now[f]);
      const removed = Object.keys(saved).filter((f) => !(f in now));
      if (changed.length || removed.length) {
        const list = [...changed.map((f) => `  - ${f}${f in saved ? ' (수정됨)' : ' (새 파일)'}`), ...removed.map((f) => `  - ${f} (삭제됨)`)];
        fail(
          `${target} 에서 직접 바뀐 파일이 있어서 덮어쓰지 않았어요:\n${list.join('\n')}\n\n` +
          `  이 변경을 살리려면 해당 파일을 작업 폴더(chanji)에 먼저 똑같이 반영한 뒤 다시 내보내세요.\n` +
          `  버려도 되는 변경이라면: npm run export -- --force`
        );
      }
    }
  }
  // 이전 내보내기 내용 정리 (.git 은 유지)
  for (const name of entries) {
    if (name === '.git') continue;
    fs.rmSync(path.join(target, name), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(target, { recursive: true });
}

let count = 0;
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excluded(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
}
copyDir(root, target);
// 표시 파일: 다음 내보내기 때 이 폴더에서 직접 바뀐 파일을 찾아내기 위해 지문을 함께 저장
fs.writeFileSync(
  path.join(target, MARKER),
  JSON.stringify({
    note: '이 폴더는 chanji 작업 폴더에서 npm run export 로 만들어졌어요. 직접 고치지 말고 작업 폴더에서 고친 뒤 다시 내보내세요.',
    files: fingerprints(target),
  }, null, 1) + '\n'
);

const isRepo = fs.existsSync(path.join(target, '.git'));
console.log(`\n✔ 파일 ${count}개를 내보냈어요 → ${target}`);
console.log(
  isRepo
    ? '  git 저장소예요. 이 폴더에서 변경 사항을 확인하고 commit / push 하세요.\n'
    : '  이 폴더 안의 내용을 GitHub 웹 "Add file → Upload files"에 끌어다 놓으세요.\n'
);
