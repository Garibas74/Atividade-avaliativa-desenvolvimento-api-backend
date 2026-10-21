export async function request(path, options = {}) {
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    });
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
        throw new Error(result.erro || 'Não foi possível concluir a operação');
    }
    return result;
}
