import { readFileSync } from 'fs';

export interface FileContext {
    file: string;
    content: string;
}

export function collectFileContext(filePath: string): FileContext {
    return {
        file: filePath,
        content: readFileSync(filePath, 'utf-8'),
    };
}