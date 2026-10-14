// 작업 폴더(chanji)에서 GitHub에 올릴 파일만 골라 내보내기 폴더로 복사합니다.
//   npm run export                → ../chanji-github 로 내보내기
//   npm run export -- <폴더 경로>  → 원하는 폴더로 내보내기
//
// 내보내기 폴더가 git 저장소(클론)라면 .git 은 건드리지 않으므로 그대로 commit / push 할 수 있습니다.
// 아니라면 폴더 안의 내용을 GitHub 웹의 "Add file → Upload files"에 끌어다 놓으면 됩니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(root, process.argv[2] ?? '../chanji-github');
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

// 안전장치: 처음 보는 폴더(내보내기 표시도, git 저장소도 아닌데 비어 있지 않음)는 지우지 않음
if (fs.existsSync(target)) {
  const entries = fs.readdirSync(target);
  const known = entries.includes(MARKER) || entries.includes('.git');
  if (entries.length > 0 && !known) {
    fail(`${target} 에 다른 파일이 있어요. 빈 폴더나 GitHub 저장소 클론을 지정해 주세요.`);
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
fs.writeFileSync(path.join(target, MARKER), '이 폴더는 chanji 작업 폴더에서 npm run export 로 만들어졌어요. 직접 고치지 말고 작업 폴더에서 고친 뒤 다시 내보내세요.\n');

const isRepo = fs.existsSync(path.join(target, '.git'));
console.log(`\n✔ 파일 ${count}개를 내보냈어요 → ${target}`);
console.log(
  isRepo
    ? '  git 저장소예요. 이 폴더에서 변경 사항을 확인하고 commit / push 하세요.\n'
    : '  이 폴더 안의 내용을 GitHub 웹 "Add file → Upload files"에 끌어다 놓으세요.\n'
);
