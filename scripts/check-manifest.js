const fs = require('fs');
const manifest = fs.readFileSync('manifest.yml', 'utf8');
const scopes = manifest.split(/\r?\n/).filter((line) => /^    - (storage:|read:)/.test(line)).map((line) => line.trim().slice(2));
const expected = ['storage:app','read:page:confluence','read:user:confluence','read:group:confluence','read:content.permission:confluence','read:content-details:confluence'];
if (JSON.stringify(scopes) !== JSON.stringify(expected)) throw new Error(`Scope snapshot mismatch: ${JSON.stringify(scopes)}`);
if (process.argv.includes('--zero-webtrigger') && /webtrigger/i.test(manifest)) throw new Error('webtrigger is forbidden');
console.log('Manifest guards passed');
