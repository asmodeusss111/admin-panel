'use strict';

// ── GitHub Storage ────────────────────────────────────────────────────────────
class GitHubStorage {
  constructor({ token, owner, repo, file = 'data.json' }) {
    this.token = token;
    this.owner = owner;
    this.repo  = repo;
    this.file  = file;
    this._sha  = null;
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async load() {
    const r = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.file}`,
      { headers: this._headers() }
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const json = await r.json();
    this._sha = json.sha;
    return JSON.parse(atob(json.content.replace(/\s/g, '')));
  }

  async save(data) {
    data.lastUpdated = new Date().toISOString();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const r = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.file}`,
      {
        method: 'PUT',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `data: update ${new Date().toISOString().slice(0, 10)}`,
          content,
          sha: this._sha,
        }),
      }
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const json = await r.json();
    this._sha = json.content.sha;
    return data;
  }

  // Creates data.json if it doesn't exist yet
  async init() {
    try {
      return await this.load();
    } catch (e) {
      if (e.message.includes('404')) {
        const empty = { projects: [], orders: [], lastUpdated: new Date().toISOString() };
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(empty, null, 2))));
        const r = await fetch(
          `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.file}`,
          {
            method: 'PUT',
            headers: { ...this._headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'init: create data.json', content }),
          }
        );
        if (!r.ok) throw new Error(`GitHub ${r.status}`);
        const json = await r.json();
        this._sha = json.content.sha;
        return empty;
      }
      throw e;
    }
  }
}

// ── Config (localStorage) ─────────────────────────────────────────────────────
function getConfig() {
  return {
    token: localStorage.getItem('adm_token') || '',
    owner: localStorage.getItem('adm_owner') || '',
    repo:  localStorage.getItem('adm_repo')  || '',
  };
}
function setConfig({ token, owner, repo }) {
  localStorage.setItem('adm_token', token);
  localStorage.setItem('adm_owner', owner);
  localStorage.setItem('adm_repo',  repo);
}
function isConfigured() {
  const c = getConfig();
  return !!(c.token && c.owner && c.repo);
}

let _storage = null;
function getStorage() {
  if (!_storage) _storage = new GitHubStorage(getConfig());
  return _storage;
}
function resetStorage() { _storage = null; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString('ru');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / 86400000);
}
