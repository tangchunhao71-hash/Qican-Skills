import {posix} from 'node:path';

const contentChecks = [
  ['可能的凭证', /(?:gh[pousr]_|github_pat_|xox[baprs]-|AKIA|sk-(?:proj-)?)[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['可能的连接凭证', /\b(?:authorization\s*:\s*bearer\s+\S{12,}|(?:api[_-]?key|access[_-]?token|cookie|client[_-]?secret)\s*[:=]\s*["']?[^\s"'<>]{16,})/i],
  ['私人服务地址', /https?:\/\/(?:(?:[^/\s]+\.)?feishu\.cn\b|drive\.google\.com\b|docs\.google\.com\b|(?:[^/\s]+\.)?larksuite\.com\b|github\.com\/[^/\s]+\/ai-memory\b)|obsidian:\/\//i],
  ['本机个人路径', /\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\s]+|\/(?:Users|home)\/[^\s/"'`]+\//i],
  ['私人运行入口', /private-profile\.md|agy-longform\.mjs|longform-source-[r]ead|x-md-[p]aste/i],
];

const forbiddenPath = /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.(?:pem|key|pfx|log)|.*(?:private-profile|credentials|secrets).*?)(?:\/|$)/i;

export function checkPublicFiles(files) {
  for (const [rel, raw] of files) {
    if (posix.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(part => !part || part === '..' || part === '.') || forbiddenPath.test(rel)) {
      throw new Error(`不允许发布的路径 ${rel}`);
    }
    let content;
    try {
      content = new TextDecoder('utf-8', {fatal:true}).decode(raw);
    } catch {
      throw new Error(`只允许 UTF-8 文本 ${rel}`);
    }
    if (content.includes('\0') || raw.length > 1024 * 1024) throw new Error(`不允许的文件内容 ${rel}`);
    for (const [reason, pattern] of contentChecks) {
      if (pattern.test(content)) throw new Error(`${reason} \u00b7 ${rel}`);
    }
    if (!rel.endsWith('.md')) continue;
    const links = [...content.matchAll(/\]\(([^\s)]+)\)/g)].map(match => match[1]);
    const refs = [...content.matchAll(/`((?:\.\.\/cyber-qican\/)?references\/[\w.-]+\.md)`/g)].map(match => match[1]);
    for (const link of [...links, ...refs]) {
      const target = link.split('#')[0];
      if (!target || /^https?:\/\//i.test(target)) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(rel), target));
      if (target.startsWith('/') || !files.has(resolved)) throw new Error(`缺失或越界的相对引用 ${rel} → ${target}`);
    }
  }
}
