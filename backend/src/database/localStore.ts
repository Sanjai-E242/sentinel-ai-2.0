import fs from 'fs';
import path from 'path';

/**
 * Ensures and returns the directory for local JSON persistence.
 * Checks whether process.cwd() is the repository root or backend folder.
 */
export function getLocalDataDir(): string {
  const cwd = process.cwd();
  const dir = cwd.endsWith('backend') ? path.join(cwd, 'data') : path.join(cwd, 'backend', 'data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignored
    }
  }
  return dir;
}
