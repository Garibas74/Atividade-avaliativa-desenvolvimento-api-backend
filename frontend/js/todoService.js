import { request } from './api.js';
export const getTodos = async () => (await request('/todos')).data;
export const createTodo = data => request('/todos', { method: 'POST', body: JSON.stringify(data) });
export const toggleTodo = (id, concluida) => request(`/todos/${id}`, { method: 'PUT', body: JSON.stringify({ concluida }) });
export const deleteTodo = id => request(`/todos/${id}`, { method: 'DELETE' });
export const getStats = () => request('/stats');
