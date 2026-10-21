import { request } from './api.js';
import { getTodos, createTodo, toggleTodo, deleteTodo, getStats } from './todoService.js';
const el = id => document.getElementById(id);
let registering = false;
let generation = 0;
function message(text = '') { el('message').textContent = text; }
function logout() {
    generation++;
    sessionStorage.removeItem('token');
    el('workspace').hidden = true;
    el('auth').hidden = false;
    el('todoList').replaceChildren();
    el('todoForm').reset(); el('authForm').reset();
    el('userName').textContent = ''; message();
}
async function run(button, action) {
    button.disabled = true; message();
    try { await action(); } catch (error) { message(error.message); }
    finally { button.disabled = false; }
}
async function refresh() {
    const current = generation;
    const todos = await getTodos();
    if (current !== generation) return;
    el('todoList').replaceChildren();
    if (!todos.length) {
        const empty = document.createElement('li');
        empty.textContent = 'Nenhuma tarefa ainda. Adicione sua primeira tarefa!';
        el('todoList').append(empty);
    }
    for (const todo of todos) {
        const li = document.createElement('li');
        const content = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = todo.titulo;
        if (todo.concluida) title.className = 'completed';
        content.append(title);
        if (todo.descricao) {
            const description = document.createElement('p');
            description.className = 'hint'; description.textContent = todo.descricao;
            content.append(description);
        }
        const actions = document.createElement('div'); actions.className = 'actions';
        for (const [label, className, callback] of [
            [todo.concluida ? 'Reabrir' : 'Concluir', 'btn-complete', () => toggleTodo(todo.id, !todo.concluida)],
            ['Excluir', 'btn-delete', () => deleteTodo(todo.id)]
        ]) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = className; button.textContent = label;
            button.setAttribute('aria-label', `${label}: ${todo.titulo}`);
            button.addEventListener('click', () => run(button, async () => { await callback(); await refresh(); }));
            actions.append(button);
        }
        li.append(content, actions); el('todoList').append(li);
    }
    try {
        const stats = await getStats();
        if (current !== generation) return;
        el('total').textContent = stats.total; el('completed').textContent = stats.concluidas; el('pending').textContent = stats.pendentes;
    } catch (error) {
        if (current !== generation) return;
        for (const id of ['total', 'completed', 'pending']) el(id).textContent = '—';
        message(error.message);
    }
}
async function showWorkspace(user) {
    el('auth').hidden = true; el('workspace').hidden = false;
    el('userName').textContent = `Olá, ${user.nome}`;
    await refresh();
}
el('authToggle').addEventListener('click', () => {
    registering = !registering;
    el('nameLabel').hidden = !registering; el('name').required = registering;
    el('authTitle').textContent = registering ? 'Criar conta' : 'Entrar';
    el('authSubmit').textContent = registering ? 'Cadastrar' : 'Entrar';
    el('authToggle').textContent = registering ? 'Já tenho conta' : 'Criar uma conta';
    el('password').autocomplete = registering ? 'new-password' : 'current-password'; message();
});
el('authForm').addEventListener('submit', event => {
    event.preventDefault();
    run(el('authSubmit'), async () => {
        const data = { email: el('email').value, senha: el('password').value };
        if (registering) data.nome = el('name').value;
        const result = await request(`/auth/${registering ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(data) });
        sessionStorage.setItem('token', result.token); el('authForm').reset();
        await showWorkspace(result.usuario);
    });
});
el('todoForm').addEventListener('submit', event => {
    event.preventDefault();
    run(event.submitter, async () => {
        await createTodo({ titulo: el('title').value, descricao: el('description').value });
        el('todoForm').reset(); await refresh();
    });
});
el('logout').addEventListener('click', logout);
window.addEventListener('session-expired', () => { logout(); message('Sua sessão expirou. Entre novamente.'); });
if (sessionStorage.getItem('token')) {
    try { await showWorkspace(await request('/auth/me')); }
    catch (error) { logout(); message(error.message); }
}
