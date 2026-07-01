import { join } from 'node:path';
import { FileQuizRepository, seedDemoSessions } from '../dist/data/repository.mjs';

const file = join(process.cwd(), 'data', 'dev-db.json');
const repo = new FileQuizRepository(file);
seedDemoSessions(repo);
console.log('Seeded demo sessions into ' + file);
console.log('demo-free-session and demo-paid-session are ready.');
