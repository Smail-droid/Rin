import { describe, it, expect } from 'bun:test';
import { path_join } from '../path';

describe('path_join', () => {
    it('should join simple paths', () => {
        expect(path_join('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should handle leading slashes', () => {
        expect(path_join('/a', 'b')).toBe('/a/b');
    });

    it('should handle trailing slashes', () => {
        expect(path_join('a/', 'b/')).toBe('a/b');
    });

    it('should handle empty strings', () => {
        expect(path_join('', 'a', '')).toBe('a');
    });

    it('should handle relative paths with dots', () => {
        expect(path_join('a', './b')).toBe('a/b');
    });

    it('should handle parent directory references', () => {
        expect(path_join('a/b', '../c')).toBe('a/c');
    });

    it('should handle multiple slashes', () => {
        expect(path_join('a//b', 'c')).toBe('a/b/c');
    });

    it('should return root for absolute path with all parent references', () => {
        expect(path_join('/a/b', '..', '..')).toBe('/');
    });

    it('should handle single path', () => {
        expect(path_join('single')).toBe('single');
    });

    it('should return dot for empty paths', () => {
        expect(path_join('')).toBe('.');
    });
});