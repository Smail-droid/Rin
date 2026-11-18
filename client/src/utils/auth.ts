const TOKEN_KEY = 'rin_auth_token';

// In-memory fallback for environments without localStorage (e.g., tests)
let memoryToken: string | null = null;
let cachedStorageAvailability: boolean | null = null;

function isLocalStorageAvailable(): boolean {
    if (typeof localStorage === 'undefined') {
        return false;
    }
    if (cachedStorageAvailability !== null) {
        return cachedStorageAvailability;
    }
    try {
        localStorage.setItem('__test__', 'test');
        localStorage.removeItem('__test__');
        cachedStorageAvailability = true;
        return true;
    } catch {
        cachedStorageAvailability = false;
        return false;
    }
}

export function getAuthToken(): string | null {
    if (isLocalStorageAvailable()) {
        return localStorage.getItem(TOKEN_KEY);
    }
    return memoryToken;
}

export function setAuthToken(token: string): void {
    if (isLocalStorageAvailable()) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        memoryToken = token;
    }
}

export function removeAuthToken(): void {
    if (isLocalStorageAvailable()) {
        localStorage.removeItem(TOKEN_KEY);
    } else {
        memoryToken = null;
    }
}

export function headersWithAuth(): Record<string, string> {
    const headers: Record<string, string> = {};

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}
