// ==UserScript==
// @name         DMM Studio - panel de biblioteca para Debrid Media Manager
// @namespace    https://debridmediamanager.com/
// @version      1.1.0
// @description  Interfaz nueva para Debrid Media Manager y Real-Debrid: cuenta, biblioteca con filtros, cache instantanea, enlaces de descarga y fichas de TMDB con posters. Reutiliza la sesion y las cookies que ya tienes en el navegador.
// @author       Buffy
// @match        https://debridmediamanager.com/*
// @match        https://www.debridmediamanager.com/*
// @match        https://real-debrid.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// @connect      api.real-debrid.com
// @connect      app.real-debrid.com
// @connect      debridmediamanager.com
// @connect      api.themoviedb.org
// @connect      image.tmdb.org
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var VERSION = '1.1.0';
  var DEMO = !!window.DMM_STUDIO_DEMO;
  var HAS_GM = typeof GM_xmlhttpRequest === 'function';
  var RD_API = 'https://api.real-debrid.com/rest/1.0';
  var RD_OAUTH = 'https://app.real-debrid.com/oauth/v2/token';
  var DMM_API = 'https://debridmediamanager.com/api';
  var PREFIX = 'dmmStudio:';

  var CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
:host, .panel, button, input, select, textarea {
  font-family: ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.mono { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace; }

/* ---------- lanzador ---------- */
.launcher {
  position: fixed; right: 22px; bottom: 22px; z-index: 2147483000;
  width: 58px; height: 58px; padding: 0; border-radius: 19px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(150deg, #232838, #0c0f16 70%);
  color: #e9edf7; cursor: pointer; display: grid; place-items: center;
  box-shadow: 0 20px 45px -16px rgba(2,6,15,.9), inset 0 1px 0 rgba(255,255,255,.09);
  transition: transform .38s cubic-bezier(.22,1,.36,1), box-shadow .3s ease;
  isolation: isolate;
}
.launcher > .glow {
  position: absolute; inset: -3px; border-radius: 22px; z-index: -1;
  background: conic-gradient(from 150deg, #8b5cf6, #22d3ee, #34d399, #f472b6, #8b5cf6);
  filter: blur(11px); opacity: .45; transition: opacity .3s ease;
}
.launcher:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 26px 60px -18px rgba(2,6,15,.95); }
.launcher:hover > .glow { opacity: .75; }
.launcher:active { transform: scale(.97); }
.launcher svg { width: 26px; height: 26px; }
.launcher .ring { position: absolute; inset: 0; border-radius: inherit; border: 1px solid rgba(255,255,255,.06); pointer-events: none; }

/* ---------- capa ---------- */
.overlay {
  position: fixed; inset: 0; z-index: 2147483001; display: grid; place-items: center;
  padding: 26px; background: rgba(4,6,11,.58); -webkit-backdrop-filter: blur(14px) saturate(120%);
  backdrop-filter: blur(14px) saturate(120%);
  opacity: 0; pointer-events: none; transition: opacity .26s ease;
}
.overlay.open { opacity: 1; pointer-events: auto; }
.panel {
  width: min(1160px, 100%); height: min(812px, 92vh);
  display: grid; grid-template-columns: 264px minmax(0,1fr); overflow: hidden;
  border-radius: 26px; border: 1px solid rgba(255,255,255,.1);
  background:
    radial-gradient(1100px 520px at 8% -12%, rgba(139,92,246,.20), transparent 62%),
    radial-gradient(820px 460px at 104% -6%, rgba(34,211,238,.14), transparent 58%),
    linear-gradient(180deg, #0d1018, #080a10 65%);
  box-shadow: 0 60px 130px -40px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.07);
  transform: translateY(16px) scale(.985); opacity: .6;
  transition: transform .36s cubic-bezier(.22,1,.36,1), opacity .3s ease;
  color: #e8ecf6;
}
.overlay.open .panel { transform: none; opacity: 1; }

/* ---------- barra lateral ---------- */
.rail {
  display: flex; flex-direction: column; gap: 18px; padding: 22px 18px;
  border-right: 1px solid rgba(255,255,255,.06);
  background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.008));
  min-height: 0;
}
.brand { display: flex; align-items: center; gap: 10px; padding: 0 4px; }
.brand-mark {
  width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center;
  background: linear-gradient(140deg, #8b5cf6, #22d3ee); color: #06080d; font-weight: 800;
  font-size: 15px; letter-spacing: -.02em; box-shadow: 0 8px 22px -8px rgba(139,92,246,.85);
}
.brand-name { font-size: 14.5px; font-weight: 650; letter-spacing: -.01em; }
.brand-sub { font-size: 10.5px; letter-spacing: .13em; text-transform: uppercase; color: #7d879c; }

.account {
  display: flex; align-items: center; gap: 11px; padding: 12px;
  border-radius: 16px; border: 1px solid rgba(255,255,255,.075);
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
}
.avatar {
  width: 40px; height: 40px; border-radius: 13px; flex: none; overflow: hidden;
  display: grid; place-items: center; font-weight: 700; font-size: 16px; color: #080b11;
  background: linear-gradient(140deg, #a78bfa, #22d3ee); box-shadow: inset 0 0 0 1px rgba(255,255,255,.25);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.account-info { min-width: 0; }
.account-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.account-mail { font-size: 11px; color: #8791a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px;
  font-size: 10.5px; font-weight: 650; letter-spacing: .03em;
  background: rgba(52,211,153,.13); color: #6ee7b7; border: 1px solid rgba(52,211,153,.28);
}
.pill.free { background: rgba(251,191,36,.12); color: #fcd34d; border-color: rgba(251,191,36,.3); }
.pill.off { background: rgba(248,113,113,.12); color: #fca5a5; border-color: rgba(248,113,113,.3); }

.rail-nav { display: flex; flex-direction: column; gap: 4px; }
.navbtn {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
  border-radius: 12px; border: 1px solid transparent; background: transparent;
  color: #a4adc0; font-size: 13px; font-weight: 550; cursor: pointer; text-align: left;
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}
.navbtn svg { width: 17px; height: 17px; opacity: .85; }
.navbtn:hover { background: rgba(255,255,255,.05); color: #e8ecf6; }
.navbtn.active {
  color: #f2f5fb; border-color: rgba(139,92,246,.36);
  background: linear-gradient(100deg, rgba(139,92,246,.24), rgba(34,211,238,.09));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07);
}
.navbtn .count { margin-left: auto; font-size: 11px; color: #8d97ab; font-variant-numeric: tabular-nums; }

.rail-foot { margin-top: auto; padding: 0 4px; display: grid; gap: 8px; }
.status-line { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #8791a6; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 9px rgba(52,211,153,.9); flex: none; }
.dot.warn { background: #fbbf24; box-shadow: 0 0 9px rgba(251,191,36,.85); }
.dot.bad { background: #f87171; box-shadow: 0 0 9px rgba(248,113,113,.85); }
.version { font-size: 10.5px; color: #5d6678; letter-spacing: .04em; }

/* ---------- zona principal ---------- */
.main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.topbar { display: flex; align-items: center; gap: 10px; padding: 20px 22px 12px; }
.search {
  flex: 1; display: flex; align-items: center; gap: 9px; padding: 0 14px; height: 42px;
  border-radius: 13px; border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.035); transition: border-color .2s ease, background .2s ease;
}
.search:focus-within { border-color: rgba(139,92,246,.55); background: rgba(139,92,246,.07); }
.search svg { width: 16px; height: 16px; color: #7d879c; flex: none; }
.search input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #e8ecf6;
  font-size: 13.5px; padding: 0;
}
.search input::placeholder { color: #6b7488; }
.iconbtn {
  width: 42px; height: 42px; padding: 0; flex: none; display: grid; place-items: center;
  border-radius: 13px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035);
  color: #b9c1d2; cursor: pointer; transition: background .18s, color .18s, transform .18s;
}
.iconbtn svg { width: 17px; height: 17px; }
.iconbtn:hover { background: rgba(255,255,255,.09); color: #fff; }
.iconbtn:active { transform: scale(.95); }
.iconbtn.spinning svg { animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.content { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 22px 24px; scrollbar-width: thin; }
.content::-webkit-scrollbar { width: 10px; }
.content::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
.content::-webkit-scrollbar-track { background: transparent; }

.title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin: 6px 0 16px; }
h2.title { margin: 0; font-size: 22px; font-weight: 680; letter-spacing: -.025em; }
p.subtitle { margin: 4px 0 0; font-size: 12.5px; color: #8791a6; }

/* ---------- métricas ---------- */
.stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
.stat {
  position: relative; overflow: hidden; padding: 13px 15px; border-radius: 16px;
  border: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012));
}
.stat::after {
  content: ''; position: absolute; width: 120px; height: 120px; right: -46px; top: -58px; border-radius: 50%;
  background: radial-gradient(circle, rgba(139,92,246,.45), transparent 68%); opacity: .55;
}
.stat:nth-child(2)::after { background: radial-gradient(circle, rgba(34,211,238,.42), transparent 68%); }
.stat:nth-child(3)::after { background: radial-gradient(circle, rgba(52,211,153,.4), transparent 68%); }
.stat:nth-child(4)::after { background: radial-gradient(circle, rgba(244,114,182,.36), transparent 68%); }
.stat .k { font-size: 10.5px; letter-spacing: .11em; text-transform: uppercase; color: #838da1; }
.stat .v { margin-top: 5px; font-size: 21px; font-weight: 660; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.stat .hint { margin-top: 2px; font-size: 11px; color: #6f7889; }

/* ---------- barra de herramientas ---------- */
.toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 13px; }
.chipbtn {
  padding: 7px 12px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 560;
  border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); color: #a6afc2;
  transition: color .16s, background .16s, border-color .16s;
}
.chipbtn:hover { color: #e8ecf6; background: rgba(255,255,255,.07); }
.chipbtn.active {
  color: #fff; border-color: transparent;
  background: linear-gradient(100deg, #7c3aed, #0ea5e9);
  box-shadow: 0 8px 22px -12px rgba(124,58,237,.95);
}
.spacer { flex: 1; }
select.select {
  height: 34px; padding: 0 10px; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04); color: #c8cedd; font-size: 12px;
  outline: 0;
}
select.select option { background: #12151d; color: #e8ecf6; }

/* ---------- lista ---------- */
.list { display: grid; gap: 9px; }
.row {
  border-radius: 15px; border: 1px solid rgba(255,255,255,.065);
  background: rgba(255,255,255,.024); padding: 12px 14px;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.row:hover { border-color: rgba(139,92,246,.35); background: rgba(139,92,246,.06); }
.row-head { display: flex; align-items: flex-start; gap: 12px; }
.row-main { min-width: 0; flex: 1; }
.row-title { display: flex; gap: 8px; align-items: flex-start; }
.row-title h3 {
  margin: 0; font-size: 13.5px; font-weight: 570; line-height: 1.4; color: #eef1f8; letter-spacing: -.005em;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;
}
.statusdot { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex: none; background: #64748b; }
.statusdot.ok { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,.9); }
.statusdot.busy { background: #22d3ee; box-shadow: 0 0 8px rgba(34,211,238,.9); animation: pulse 1.6s ease-in-out infinite; }
.statusdot.warn { background: #fbbf24; box-shadow: 0 0 8px rgba(251,191,36,.9); }
.statusdot.bad { background: #f87171; box-shadow: 0 0 8px rgba(248,113,113,.9); }
@keyframes pulse { 50% { opacity: .3; } }
.row-meta { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-top: 6px; font-size: 11.5px; color: #8791a6; }
.row-meta .sep { opacity: .35; }
.row-meta .hash { color: #6f7889; }
.progress { height: 5px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; margin-top: 9px; }
.progress > i {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, #8b5cf6, #22d3ee);
  box-shadow: 0 0 14px rgba(34,211,238,.55); transition: width .5s cubic-bezier(.22,1,.36,1);
}
.row-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex: none; }

.badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px;
  font-size: 10.5px; font-weight: 650; letter-spacing: .02em; white-space: nowrap; border: 1px solid transparent;
}
.badge.ok { background: rgba(52,211,153,.13); color: #6ee7b7; border-color: rgba(52,211,153,.25); }
.badge.busy { background: rgba(34,211,238,.13); color: #67e8f9; border-color: rgba(34,211,238,.25); }
.badge.idle { background: rgba(148,163,184,.13); color: #cbd5e1; border-color: rgba(148,163,184,.24); }
.badge.warn { background: rgba(251,191,36,.13); color: #fcd34d; border-color: rgba(251,191,36,.26); }
.badge.bad { background: rgba(248,113,113,.13); color: #fca5a5; border-color: rgba(248,113,113,.26); }

.row-actions { display: flex; gap: 6px; }
.act {
  padding: 5px 9px; border-radius: 9px; cursor: pointer; font-size: 11px; font-weight: 560;
  border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04); color: #b6bfd1;
  transition: background .16s, color .16s, border-color .16s;
}
.act:hover { background: rgba(139,92,246,.2); color: #fff; border-color: rgba(139,92,246,.45); }
.act.danger:hover { background: rgba(248,113,113,.18); color: #fecaca; border-color: rgba(248,113,113,.45); }
.act[disabled] { opacity: .45; pointer-events: none; }

.detail { margin-top: 11px; padding-top: 11px; border-top: 1px dashed rgba(255,255,255,.09); display: grid; gap: 7px; }
.file {
  display: flex; align-items: center; gap: 9px; font-size: 11.5px; color: #aeb7c9;
  padding: 5px 8px; border-radius: 9px; background: rgba(255,255,255,.025);
}
.file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: #7d879c; font-variant-numeric: tabular-nums; }
.linkline {
  display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 10px;
  background: rgba(34,211,238,.06); border: 1px solid rgba(34,211,238,.18);
  font-size: 11.5px; color: #a5f3fc; overflow: hidden;
}
.linkline span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.linkline a { color: #67e8f9; text-decoration: none; font-weight: 600; }
.detail-note { font-size: 11px; color: #7d879c; }
.loading-line { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #8791a6; }
.spinner {
  width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(255,255,255,.18);
  border-top-color: #22d3ee; animation: spin .8s linear infinite;
}

/* ---------- estados vacíos y esqueletos ---------- */
.empty { display: grid; place-items: center; text-align: center; gap: 6px; padding: 54px 20px; }
.empty-icon {
  width: 54px; height: 54px; border-radius: 17px; display: grid; place-items: center; margin-bottom: 6px;
  background: linear-gradient(150deg, rgba(139,92,246,.22), rgba(34,211,238,.14));
  border: 1px solid rgba(255,255,255,.08); color: #c4b5fd;
}
.empty-icon svg { width: 24px; height: 24px; }
.empty h3 { margin: 0; font-size: 15px; font-weight: 620; color: #e8ecf6; }
.empty p { margin: 0; font-size: 12.5px; color: #8791a6; max-width: 420px; line-height: 1.5; }
.skel { height: 62px; border-radius: 15px; border: 1px solid rgba(255,255,255,.05); background:
  linear-gradient(100deg, rgba(255,255,255,.03) 20%, rgba(255,255,255,.085) 40%, rgba(255,255,255,.03) 60%);
  background-size: 240% 100%; animation: shimmer 1.5s infinite linear; }
@keyframes shimmer { to { background-position: -240% 0; } }

/* ---------- formularios ---------- */
.card {
  border-radius: 17px; border: 1px solid rgba(255,255,255,.075);
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012));
  padding: 16px; margin-bottom: 12px;
}
.card h3 { margin: 0 0 4px; font-size: 13.5px; font-weight: 620; }
.card p { margin: 0 0 12px; font-size: 12px; color: #8791a6; line-height: 1.5; }
textarea.field, input.field {
  width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,.1);
  background: rgba(0,0,0,.28); color: #e8ecf6; font-size: 12.5px; padding: 11px 12px; outline: 0;
  resize: vertical; line-height: 1.5;
}
textarea.field { min-height: 104px; }
textarea.field:focus, input.field:focus { border-color: rgba(139,92,246,.6); box-shadow: 0 0 0 3px rgba(139,92,246,.14); }
textarea.field::placeholder, input.field::placeholder { color: #656e80; }
.form-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 11px; align-items: center; }
.btn {
  padding: 9px 14px; border-radius: 11px; cursor: pointer; font-size: 12.5px; font-weight: 600;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #d7dcea;
  transition: transform .16s, background .16s, box-shadow .16s;
}
.btn:hover { background: rgba(255,255,255,.1); }
.btn:active { transform: scale(.98); }
.btn.primary {
  border-color: transparent; color: #080b11;
  background: linear-gradient(100deg, #a78bfa, #22d3ee);
  box-shadow: 0 12px 28px -14px rgba(103,232,249,.85);
}
.btn.primary:hover { filter: brightness(1.06); }
.btn.ghost { background: transparent; }
.btn.danger { color: #fca5a5; border-color: rgba(248,113,113,.35); background: rgba(248,113,113,.08); }
.btn[disabled] { opacity: .5; pointer-events: none; }
.hint { font-size: 11px; color: #7d879c; line-height: 1.5; }
.kv { display: grid; gap: 8px; }
.kvrow { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; padding: 7px 0; border-bottom: 1px dashed rgba(255,255,255,.07); }
.kvrow:last-child { border-bottom: 0; }
.kvrow .k { color: #8791a6; }
.kvrow .v { color: #dfe5f1; font-weight: 550; text-align: right; overflow: hidden; text-overflow: ellipsis; max-width: 62%; }

/* ---------- avisos ---------- */
.toasts { position: fixed; right: 24px; bottom: 96px; z-index: 2147483002; display: grid; gap: 9px; justify-items: end; pointer-events: none; }
.toast {
  display: flex; align-items: center; gap: 9px; max-width: 380px; padding: 11px 14px; border-radius: 13px;
  border: 1px solid rgba(255,255,255,.12); background: rgba(14,18,26,.96); color: #e8ecf6;
  font-size: 12.5px; box-shadow: 0 22px 50px -22px rgba(0,0,0,.95);
  animation: toastin .32s cubic-bezier(.22,1,.36,1); border-left: 3px solid #22d3ee;
}
.toast.ok { border-left-color: #34d399; }
.toast.bad { border-left-color: #f87171; }
.toast.warn { border-left-color: #fbbf24; }
@keyframes toastin { from { opacity: 0; transform: translateY(10px) scale(.97); } }

/* ---------- TMDB ---------- */
.row-inner { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
.thumb {
  width: 44px; height: 66px; flex: none; border-radius: 9px; overflow: hidden;
  background: #12151d center/cover no-repeat; border: 1px solid rgba(255,255,255,.09);
  display: grid; place-items: center; font-size: 11px; font-weight: 700; letter-spacing: .04em;
  color: rgba(255,255,255,.62); text-transform: uppercase; box-shadow: 0 6px 16px -10px rgba(0,0,0,.9);
}
.thumb.ph { text-shadow: 0 1px 2px rgba(0,0,0,.5); }
.tmdb-chip { color: #fcd34d; font-weight: 650; }
.tmdb-card {
  display: grid; grid-template-columns: 76px minmax(0,1fr); gap: 13px; margin-top: 11px; padding: 12px;
  border-radius: 13px; border: 1px solid rgba(139,92,246,.22);
  background: linear-gradient(115deg, rgba(139,92,246,.13), rgba(34,211,238,.06));
}
.tmdb-poster {
  width: 76px; height: 114px; border-radius: 9px; background: #12151d center/cover no-repeat;
  border: 1px solid rgba(255,255,255,.08); display: grid; place-items: center;
  font-size: 10.5px; font-weight: 650; color: #8b93a5; letter-spacing: .08em;
}
.tmdb-title { font-size: 13.5px; font-weight: 640; color: #f2f5fb; letter-spacing: -.01em; }
.tmdb-title span { color: #8791a6; font-weight: 500; }
.tmdb-sub { margin-top: 4px; font-size: 11.5px; color: #9aa4b8; }
.tmdb-sub b { color: #fcd34d; font-weight: 650; }
.tmdb-overview {
  margin: 8px 0 0; font-size: 11.8px; line-height: 1.55; color: #a9b2c4;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.tmdb-link { display: inline-block; margin-top: 8px; font-size: 11.5px; font-weight: 620; color: #67e8f9; text-decoration: none; }
.tmdb-link:hover { text-decoration: underline; }
.notice {
  display: flex; align-items: center; gap: 11px; padding: 11px 13px; margin-bottom: 14px; border-radius: 14px;
  border: 1px solid rgba(34,211,238,.22); background: linear-gradient(100deg, rgba(34,211,238,.1), rgba(139,92,246,.08));
  font-size: 12px; color: #a9b2c4;
}
.notice > svg { width: 18px; height: 18px; color: #67e8f9; flex: none; }
.notice > div { flex: 1; min-width: 0; line-height: 1.45; }
.notice b { display: block; font-size: 12.5px; font-weight: 620; color: #e8ecf6; }

@media (max-width: 880px) {
  .overlay { padding: 0; }
  .panel { grid-template-columns: minmax(0,1fr); height: 100%; border-radius: 0; border: 0; }
  .rail { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 14px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.07); }
  .rail .brand, .rail-foot, .stats .hint { display: none; }
  .account { padding: 8px 10px; }
  .account-info { flex: 1; }
  .avatar { width: 34px; height: 34px; border-radius: 11px; font-size: 14px; }
  .rail-nav { flex-direction: row; gap: 6px; }
  .navbtn { flex: 1; justify-content: center; gap: 7px; padding: 8px 6px; font-size: 12px; }
  .navbtn svg { width: 15px; height: 15px; }
  .navbtn .count { display: none; }
  .stats { grid-template-columns: repeat(2, minmax(0,1fr)); margin-bottom: 14px; }
  .content { padding: 4px 14px 20px; }
  .topbar { padding: 12px 14px 8px; }
  .row-head { flex-direction: column; gap: 10px; }
  .thumb { width: 38px; height: 57px; }
  .tmdb-card { grid-template-columns: 64px minmax(0,1fr); }
  .tmdb-poster { width: 64px; height: 96px; }
  .notice { flex-wrap: wrap; }
  .notice .btn { width: 100%; }
  .row-side { flex-direction: row; align-items: center; justify-content: space-between; width: 100%; }
  .row-actions { flex-wrap: wrap; justify-content: flex-end; }
  .title-row h2.title { font-size: 19px; }
}
`;

  /* ================= utilidades ================= */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtBytes(bytes) {
    var n = Number(bytes) || 0;
    if (n <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    var v = n / Math.pow(1024, i);
    var text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return text.replace('.', ',') + ' ' + units[i];
  }

  function fmtNum(n) { return new Intl.NumberFormat('es-ES').format(Number(n) || 0); }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  function fmtAgo(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (!t) return '';
    var diff = Math.max(0, Date.now() - t) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
    if (diff < 2592000) return 'hace ' + Math.floor(diff / 86400) + ' d';
    var months = Math.floor(diff / 2592000);
    if (months < 12) return 'hace ' + months + ' mes' + (months === 1 ? '' : 'es');
    return 'hace ' + Math.floor(months / 12) + ' a';
  }

  function premiumDays(seconds) { return Math.max(0, Math.round((Number(seconds) || 0) / 86400)); }

  /* ================= almacenamiento ================= */
  function sget(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        var v = GM_getValue(PREFIX + key, null);
        return v === null || v === undefined ? fallback : v;
      }
      var raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function sset(key, value) {
    try {
      if (typeof GM_setValue === 'function') { GM_setValue(PREFIX + key, value); return; }
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) { /* sin persistencia */ }
  }

  function sdel(key) {
    try {
      if (typeof GM_deleteValue === 'function') { GM_deleteValue(PREFIX + key); return; }
      localStorage.removeItem(PREFIX + key);
    } catch (e) { /* nada */ }
  }

  /* ================= sesion de DMM ================= */
  function readDmmValue(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { return raw; }
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed.value === 'string') return parsed.value;
      return null;
    } catch (e) { return null; }
  }

  function readDmmToken() {
    try {
      var raw = localStorage.getItem('rd:accessToken');
      if (!raw) return null;
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
      if (typeof parsed === 'string') return { value: parsed, expiry: null };
      if (parsed && typeof parsed.value === 'string') {
        return { value: parsed.value, expiry: typeof parsed.expiry === 'number' ? parsed.expiry : null };
      }
      return null;
    } catch (e) { return null; }
  }

  function writeDmmToken(token, expiresInSecs) {
    try {
      var payload = JSON.stringify({ value: token, expiry: Date.now() + (Number(expiresInSecs) || 3600) * 1000 });
      localStorage.setItem('rd:accessToken', payload);
      try {
        window.dispatchEvent(new StorageEvent('storage', { key: 'rd:accessToken', newValue: payload }));
        window.dispatchEvent(new CustomEvent('local-storage', { detail: { key: 'rd:accessToken' } }));
      } catch (e) { /* eventos no disponibles */ }
    } catch (e) { /* sin permiso */ }
  }

  /* ================= cookies ================= */
  function parseNetscape(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line) return;
      if (line.charAt(0) === '#') {
        if (line.indexOf('#HttpOnly_') !== 0) return;
        line = line.slice(11);
      }
      var parts = line.split('\t');
      if (parts.length < 7) return;
      out.push({
        domain: parts[0], path: parts[2], secure: parts[3] === 'TRUE',
        expiry: Number(parts[4]) || 0, name: parts[5], value: parts.slice(6).join('\t')
      });
    });
    return out;
  }

  function importedCookies(suffix) {
    var list = sget('cookies', []);
    if (!Array.isArray(list)) return [];
    var now = Math.floor(Date.now() / 1000);
    return list.filter(function (c) {
      if (!c || !c.name) return false;
      if (c.expiry && c.expiry < now) return false;
      var domain = String(c.domain || '').replace(/^\./, '');
      return !suffix || domain === suffix || domain.slice(-suffix.length - 1) === '.' + suffix;
    });
  }

  function cookieHeaderFor(suffix) {
    var parts = [];
    var seen = {};
    importedCookies(suffix).forEach(function (c) {
      if (seen[c.name]) return;
      seen[c.name] = true;
      parts.push(c.name + '=' + c.value);
    });
    try {
      var host = location.hostname;
      if (!suffix || host === suffix || host.slice(-suffix.length - 1) === '.' + suffix) {
        document.cookie.split(/;\s*/).forEach(function (pair) {
          if (!pair) return;
          var name = pair.split('=')[0];
          if (!name || seen[name]) return;
          seen[name] = true;
          parts.push(pair);
        });
      }
    } catch (e) { /* cookies bloqueadas */ }
    return parts.join('; ');
  }

  function hasCookie(name, suffix) {
    return cookieHeaderFor(suffix).split(/;\s*/).some(function (pair) {
      return pair.split('=')[0] === name;
    });
  }

  /* ================= peticiones ================= */
  function sessionErr(message) {
    var err = new Error(message || 'Sin sesión de Real-Debrid');
    err.session = true;
    return err;
  }

  var RD_ERRORS = {
    2: 'Falta un parámetro obligatorio.',
    3: 'Parámetro no válido.',
    8: 'El token de Real-Debrid no es válido o caducó.',
    9: 'La cuenta no tiene permiso para esa acción.',
    10: 'Ese torrent ya está en tu cuenta.',
    11: 'Archivo no encontrado.',
    12: 'El torrent ya está descargado.',
    13: 'El torrent se está descargando.',
    14: 'El torrent está en espera.',
    15: 'Límite de descargas alcanzado.',
    16: 'El torrent está en cola.',
    17: 'El torrent está en cola.',
    18: 'El torrent es demasiado grande.',
    19: 'El archivo no está disponible para descargar.',
    20: 'Magnet no válido.',
    21: 'Falta el archivo.',
    22: 'Hash no válido.',
    23: 'Magnet no válido.',
    24: 'El archivo ya existe.',
    35: 'Límite de descargas simultáneas alcanzado.',
    36: 'El torrent es demasiado grande para una cuenta gratuita.',
    37: 'El torrent no se puede descargar.'
  };

  function httpError(status, body) {
    var code = body && typeof body === 'object' ? Number(body.error_code) : 0;
    var raw = body && typeof body === 'object' && body.error ? String(body.error) : '';
    var msg = RD_ERRORS[code] || raw || ('Error HTTP ' + status);
    if (status === 429) msg = 'Demasiadas peticiones seguidas (429). Espera unos segundos.';
    var err = new Error(msg);
    err.status = status;
    err.code = code;
    if (status === 401) {
      err.session = true;
      err.message = 'El token de Real-Debrid caducó. Vuelve a iniciar sesión en DMM.';
    }
    return err;
  }

  function request(url, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    var headers = opts.headers || {};
    var data = opts.data == null ? null : opts.data;
    var timeout = opts.timeout || 25000;

    if (HAS_GM) {
      return new Promise(function (resolve, reject) {
        GM_xmlhttpRequest({
          method: method, url: url, headers: headers, data: data, timeout: timeout,
          onload: function (res) {
            var parsed = null;
            try { parsed = res.responseText ? JSON.parse(res.responseText) : null; } catch (e) { parsed = res.responseText; }
            if (res.status >= 200 && res.status < 300) {
              var total = null;
              var match = String(res.responseHeaders || '').match(/^x-total-count:\s*(\d+)/im);
              if (match) total = Number(match[1]);
              resolve({ status: res.status, data: parsed, total: total });
            } else {
              reject(httpError(res.status, parsed));
            }
          },
          onerror: function () { reject(new Error('No se pudo conectar con el servidor')); },
          ontimeout: function () { reject(new Error('La petición tardó demasiado')); }
        });
      });
    }

    return fetch(url, { method: method, headers: headers, body: data, credentials: 'include' }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = text; }
        if (res.ok) {
          var total = res.headers.get('x-total-count');
          return { status: res.status, data: parsed, total: total ? Number(total) : null };
        }
        throw httpError(res.status, parsed);
      });
    });
  }

  /* ================= Real-Debrid ================= */
  var tokenMemo = null;
  var lastCall = 0;

  function gate() {
    var now = Date.now();
    var wait = Math.max(0, lastCall + 260 - now);
    lastCall = now + wait;
    return wait ? new Promise(function (resolve) { setTimeout(resolve, wait); }) : Promise.resolve();
  }

  async function refreshToken() {
    var clientId = readDmmValue('rd:clientId');
    var clientSecret = readDmmValue('rd:clientSecret');
    var refresh = readDmmValue('rd:refreshToken');
    if (!clientId || !clientSecret || !refresh) return null;
    try {
      var body = new URLSearchParams({
        client_id: clientId, client_secret: clientSecret, code: refresh,
        grant_type: 'http://oauth.net/grant_type/device/1.0'
      }).toString();
      var res = await request(RD_OAUTH, {
        method: 'POST', data: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      var json = res.data || {};
      if (!json.access_token) return null;
      writeDmmToken(json.access_token, json.expires_in || 3600);
      return json.access_token;
    } catch (e) { return null; }
  }

  async function resolveToken() {
    if (DEMO) return 'demo';
    if (tokenMemo) return tokenMemo;
    var manual = String(sget('token', '') || '').trim();
    if (manual) { tokenMemo = manual; return manual; }
    var stored = readDmmToken();
    if (stored && stored.value && (!stored.expiry || stored.expiry > Date.now() + 60000)) {
      tokenMemo = stored.value;
      return tokenMemo;
    }
    var refreshed = await refreshToken();
    if (refreshed) { tokenMemo = refreshed; return refreshed; }
    if (stored && stored.value) { tokenMemo = stored.value; return tokenMemo; }
    throw sessionErr();
  }

  async function rd(path, opts) {
    opts = opts || {};
    await gate();
    var token = await resolveToken();
    var url = RD_API + path;
    var headers = { Accept: 'application/json' };
    var data = null;
    if (opts.form) {
      data = new URLSearchParams(opts.form).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    if (HAS_GM) headers.Authorization = 'Bearer ' + token;
    else url += (url.indexOf('?') === -1 ? '?' : '&') + 'auth_token=' + encodeURIComponent(token);
    return request(url, { method: opts.method || 'GET', headers: headers, data: data });
  }

  function summarizeAvailability(json) {
    var out = {};
    if (!json || typeof json !== 'object') return out;
    Object.keys(json).forEach(function (hash) {
      var entry = json[hash];
      var groups = entry && Array.isArray(entry.rd) ? entry.rd : [];
      var files = 0;
      var bytes = 0;
      groups.slice(0, 1).forEach(function (group) {
        if (!group || typeof group !== 'object') return;
        Object.keys(group).forEach(function (key) {
          var file = group[key];
          if (!file || typeof file !== 'object') return;
          if (file.filename) files += 1;
          bytes += Number(file.filesize) || 0;
        });
      });
      out[hash] = { cached: groups.length > 0, files: files, bytes: bytes };
    });
    return out;
  }

  function toMagnet(input) {
    var text = String(input || '').trim();
    if (/^magnet:\?/i.test(text)) return text;
    var hash = text.match(/([A-Fa-f0-9]{40})/);
    return hash ? 'magnet:?xt=urn:btih:' + hash[1].toLowerCase() : null;
  }

  function hashOf(input) {
    var magnet = toMagnet(input);
    if (!magnet) return null;
    var match = magnet.match(/btih:([A-Za-z0-9]+)/i);
    return match ? match[1].toLowerCase() : null;
  }

  /* ================= TMDB ================= */
  var TMDB_API = 'https://api.themoviedb.org/3';
  var TMDB_IMG = 'https://image.tmdb.org/t/p';
  var TMDB_TTL = 30 * 24 * 3600 * 1000;
  var TMDB_GENRES = {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental',
    18: 'Drama', 10751: 'Familia', 14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música',
    9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia ficción', 10770: 'Película de TV',
    53: 'Suspense', 10752: 'Bélica', 37: 'Western', 10759: 'Acción y aventura', 10762: 'Infantil',
    10763: 'Noticias', 10764: 'Reality', 10765: 'Sci-Fi y fantasía', 10766: 'Telenovela',
    10767: 'Talk show', 10768: 'Guerra y política'
  };
  var RELEASE_TAGS = /(?:^|[\s._-])(2160p|1080p|720p|480p|540p|uhd|4k|bluray|blu-ray|bdrip|brrip|bdremux|remux|webrip|web-dl|webdl|web|hdtv|dvdrip|dvd|hdr10\+?|hdr|dolby|atmos|truehd|ddp?\s?\d(?:\.\d)?|aac\d?|ac3|eac3|dts(?:-hd)?|x264|x265|h\.?264|h\.?265|hevc|av1|10bit|8bit|proper|repack|extended|remastered|imax|multi|dual|dubbed|subbed|subs|español|espanol|castellano|latino)/i;

  function tmdbKey() { return String(sget('tmdbKey', '') || '').trim(); }
  function tmdbLinked() { return !!tmdbKey(); }

  function tmdbKeyKind() {
    var key = tmdbKey();
    if (!key) return '';
    if (/^eyJ/.test(key)) return 'v4';
    if (/^[a-f0-9]{32}$/i.test(key)) return 'v3';
    return 'otra';
  }

  function tmdbStatus() {
    var kind = tmdbKeyKind();
    if (!kind) return 'Sin vincular';
    if (kind === 'v3') return 'Vinculada (API Key v3)';
    if (kind === 'v4') return 'Vinculada (Read Access Token v4)';
    return 'Vinculada';
  }

  function tmdbMatchedCount() {
    return Object.keys(state.tmdb).filter(function (id) {
      var entry = state.tmdb[id];
      return entry && entry.item;
    }).length;
  }

  var tmdbCache = null;

  function tmdbCacheLoad() {
    if (!tmdbCache) {
      var raw = sget('tmdbCache', null);
      tmdbCache = raw && typeof raw === 'object' ? raw : {};
    }
    return tmdbCache;
  }

  function tmdbCacheSave() {
    var cache = tmdbCacheLoad();
    var keys = Object.keys(cache);
    if (keys.length > 260) {
      keys.sort(function (a, b) { return (cache[a].at || 0) - (cache[b].at || 0); });
      keys.slice(0, keys.length - 260).forEach(function (k) { delete cache[k]; });
    }
    sset('tmdbCache', cache);
  }

  async function tmdbFetch(path, params) {
    var key = tmdbKey();
    if (!key) throw new Error('Falta la clave de TMDB');
    var query = new URLSearchParams({ language: 'es-ES', include_adult: 'false' });
    Object.keys(params || {}).forEach(function (name) {
      var value = params[name];
      if (value !== null && value !== undefined && value !== '') query.set(name, value);
    });
    var url = TMDB_API + path + '?' + query.toString();
    var headers = { Accept: 'application/json' };
    if (/^eyJ/.test(key)) headers.Authorization = 'Bearer ' + key;
    else url += '&api_key=' + encodeURIComponent(key);
    try {
      var res = await request(url, { headers: headers, timeout: 15000 });
      return res.data;
    } catch (err) {
      if (err.status === 401) throw new Error('TMDB rechazó la clave (401). Revisa que sea una API Key v3 o un Read Access Token v4.');
      if (err.status === 429) throw new Error('TMDB limitó las peticiones. Prueba en unos segundos.');
      if (err.status === 404) return null;
      throw new Error('TMDB: ' + err.message);
    }
  }

  function normText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function parseRelease(filename) {
    var name = String(filename || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) return { title: '', year: null, kind: 'movie' };
    var tagIndex = name.search(RELEASE_TAGS);
    var head = tagIndex > 1 ? name.slice(0, tagIndex) : name;
    var kind = 'movie';
    var ep = head.match(/\bS(\d{1,2})\s?E(\d{1,3})\b/i);
    var season = head.match(/\b(?:S|Season\s?)(\d{1,2})\b/i);
    if (ep || season) kind = 'tv';
    var cut = head.length;
    if (ep) cut = head.indexOf(ep[0]);
    else if (season) cut = head.indexOf(season[0]);
    var year = null;
    var maxYear = new Date().getFullYear() + 2;
    var re = /\b(19\d{2}|20\d{2})\b/g;
    var match;
    while ((match = re.exec(head))) {
      if (match.index >= cut) break;
      var value = Number(match[1]);
      if (value <= maxYear) { year = value; cut = match.index; }
    }
    var title = head.slice(0, cut).replace(/^\[[^\]]*\]\s*/, '').replace(/[\s\-–—_:;,([\]]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!title) title = head.replace(/^\[[^\]]*\]\s*/, '').trim();
    return { title: title, year: year, kind: kind };
  }

  function scoreCandidate(raw, parsed) {
    var title = normText(raw.title || raw.name);
    var want = normText(parsed.title);
    var date = raw.release_date || raw.first_air_date || '';
    var year = date ? Number(String(date).slice(0, 4)) || 0 : 0;
    var score = 0;
    if (want && title === want) score += 60;
    else if (want && title.indexOf(want) === 0) score += 26;
    else if (want && title.indexOf(want) !== -1) score += 12;
    if (parsed.year && year === parsed.year) score += 42;
    else if (parsed.year && year && Math.abs(year - parsed.year) <= 1) score += 14;
    if (parsed.kind === raw.media_type) score += 8;
    if (raw.poster_path) score += 4;
    score += Math.min(18, (Number(raw.popularity) || 0) / 50);
    score += Math.min(8, (Number(raw.vote_count) || 0) / 600);
    return score;
  }

  function tmdbItem(raw) {
    if (!raw) return null;
    var isTv = raw.media_type === 'tv';
    var date = raw.release_date || raw.first_air_date || '';
    return {
      id: raw.id,
      type: isTv ? 'tv' : 'movie',
      title: raw.title || raw.name || '',
      original: raw.original_title || raw.original_name || '',
      year: date ? Number(String(date).slice(0, 4)) || null : null,
      overview: String(raw.overview || '').trim(),
      poster: raw.poster_path ? TMDB_IMG + '/w200' + raw.poster_path : null,
      posterBig: raw.poster_path ? TMDB_IMG + '/w342' + raw.poster_path : null,
      rating: Number(raw.vote_average) || 0,
      votes: Number(raw.vote_count) || 0,
      genres: (raw.genre_ids || []).map(function (id) { return TMDB_GENRES[id]; }).filter(Boolean).slice(0, 3),
      url: 'https://www.themoviedb.org/' + (isTv ? 'tv' : 'movie') + '/' + raw.id
    };
  }

  async function tmdbLookup(torrent) {
    var parsed = parseRelease(torrent && torrent.filename);
    if (!parsed.title || parsed.title.length < 2) return null;
    var cacheKey = normText(parsed.title) + '|' + (parsed.year || '') + '|' + parsed.kind;
    var cache = tmdbCacheLoad();
    var hit = cache[cacheKey];
    if (hit && Date.now() - (hit.at || 0) < TMDB_TTL) return hit.item || null;
    var json = await tmdbFetch('/search/multi', { query: parsed.title, page: 1 });
    var results = json && Array.isArray(json.results) ? json.results.filter(function (r) {
      return r && (r.media_type === 'movie' || r.media_type === 'tv');
    }) : [];
    var best = null;
    var bestScore = 0;
    results.forEach(function (raw) {
      var score = scoreCandidate(raw, parsed);
      if (score > bestScore) { best = raw; bestScore = score; }
    });
    var item = bestScore >= 22 ? tmdbItem(best) : null;
    cache[cacheKey] = { at: Date.now(), item: item };
    tmdbCacheSave();
    return item;
  }

  async function tmdbPing() {
    var json = await tmdbFetch('/configuration', {});
    if (!json || !json.images) throw new Error('TMDB devolvió una respuesta inesperada.');
    return true;
  }

  function tmdbOf(id) {
    var entry = state.tmdb[id];
    return entry && entry.item ? entry.item : null;
  }

  function hueOf(text) {
    var hue = 0;
    var value = String(text || 'x');
    for (var i = 0; i < value.length; i += 1) hue = (hue * 31 + value.charCodeAt(i)) % 360;
    return hue;
  }

  function thumbHtml(t) {
    var item = tmdbOf(t.id);
    if (item && item.poster) {
      return '<div class="thumb" style="background-image:url(' + esc(item.poster) + ')" title="' + esc(item.title) + '"></div>';
    }
    var parsed = parseRelease(t.filename);
    var label = String(parsed.title || t.filename || '?').replace(/[^A-Za-z0-9áéíóúñ ]/g, ' ').trim();
    var initials = label.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
    var hue = hueOf(parsed.title || t.filename);
    return '<div class="thumb ph" style="background:linear-gradient(150deg,hsl(' + hue + ' 52% 30%),hsl(' + ((hue + 42) % 360) + ' 58% 12%))" title="' +
      (DEMO ? 'Ficha simulada de TMDB' : 'Sin póster en TMDB') + '">' + esc((initials || '?').toUpperCase()) + '</div>';
  }

  function tmdbBlock(t) {
    var item = tmdbOf(t.id);
    if (!item) return '';
    var poster = item.posterBig || item.poster;
    var kind = item.type === 'tv' ? 'Serie' : 'Película';
    var meta = [];
    if (item.rating) meta.push('<b>★ ' + item.rating.toFixed(1) + '</b>');
    meta.push(esc(kind));
    if (item.genres.length) meta.push(esc(item.genres.join(', ')));
    if (item.votes) meta.push(fmtNum(item.votes) + ' votos');
    return '<div class="tmdb-card">' +
      (poster ? '<div class="tmdb-poster" style="background-image:url(' + esc(poster) + ')"></div>' : '<div class="tmdb-poster">TMDB</div>') +
      '<div><div class="tmdb-title">' + esc(item.title) + (item.year ? ' <span>(' + item.year + ')</span>' : '') + '</div>' +
      '<div class="tmdb-sub">' + meta.join(' · ') + '</div>' +
      (item.overview ? '<p class="tmdb-overview">' + esc(item.overview) + '</p>' : '') +
      '<a class="tmdb-link" href="' + esc(item.url) + '" target="_blank" rel="noreferrer noopener">Ver en TMDB ↗</a>' +
      '</div></div>';
  }

  function tmdbNotice() {
    if (DEMO || tmdbLinked()) return '';
    return '<div class="notice">' + icon('film') +
      '<div><b>Vincula tu API de TMDB</b>Con tu clave verás el póster, el año, la nota y la sinopsis de cada torrent. Se guarda solo en este navegador.</div>' +
      '<button class="btn" data-action="go-tmdb" type="button">Añadir clave</button></div>';
  }

  var tmdbQueue = [];
  var tmdbActive = 0;

  function tmdbEnabled() { return DEMO || tmdbLinked(); }

  function scheduleTmdb(list) {
    if (!tmdbEnabled() || state.tmdbBlocked) return;
    (list || []).forEach(function (t) {
      if (!t || !t.id) return;
      if (state.tmdb[t.id] || tmdbQueue.indexOf(t.id) !== -1) return;
      tmdbQueue.push(t.id);
    });
    pumpTmdb();
  }

  function runTmdbJob(id) {
    var torrent = state.torrents.filter(function (t) { return t.id === id; })[0];
    if (!torrent) { pumpTmdb(); return; }
    state.tmdb[id] = { loading: true };
    tmdbActive += 1;
    data.tmdb(torrent).then(function (item) {
      state.tmdb[id] = { loading: false, item: item };
    }).catch(function (err) {
      state.tmdb[id] = { loading: false, error: err.message };
      if (/clave|401/i.test(err.message)) {
        tmdbQueue.length = 0;
        state.tmdbBlocked = err.message;
        toast(err.message, 'bad');
      }
    }).then(function () {
      tmdbActive -= 1;
      if (state.view === 'library' && isOpen()) renderContent();
      pumpTmdb();
    });
  }

  function pumpTmdb() {
    if (!tmdbEnabled() || state.tmdbBlocked) return;
    while (tmdbActive < 3 && tmdbQueue.length) {
      runTmdbJob(tmdbQueue.shift());
    }
  }

  /* ================= estados ================= */
  var ACTIVE_STATUSES = ['downloading', 'queued', 'magnet_conversion', 'compressing', 'uploading', 'waiting_files_selection'];
  var PROBLEM_STATUSES = ['error', 'magnet_error', 'virus', 'dead'];

  var STATUS = {
    downloaded: { label: 'Listo', tone: 'ok' },
    downloading: { label: 'Descargando', tone: 'busy' },
    queued: { label: 'En cola', tone: 'idle' },
    magnet_conversion: { label: 'Convirtiendo', tone: 'busy' },
    waiting_files_selection: { label: 'Elegir archivos', tone: 'warn' },
    compressing: { label: 'Comprimiendo', tone: 'busy' },
    uploading: { label: 'Subiendo', tone: 'busy' },
    error: { label: 'Error', tone: 'bad' },
    magnet_error: { label: 'Error de magnet', tone: 'bad' },
    virus: { label: 'Bloqueado', tone: 'bad' },
    dead: { label: 'Sin semillas', tone: 'bad' }
  };

  var FILTERS = [
    { id: 'all', label: 'Todo', match: function () { return true; } },
    { id: 'active', label: 'En curso', match: function (t) { return ACTIVE_STATUSES.indexOf(t.status) !== -1; } },
    { id: 'ready', label: 'Listos', match: function (t) { return t.status === 'downloaded'; } },
    { id: 'problem', label: 'Con problemas', match: function (t) { return PROBLEM_STATUSES.indexOf(t.status) !== -1; } }
  ];

  var SORTS = [
    { id: 'added-desc', label: 'Más recientes' },
    { id: 'added-asc', label: 'Más antiguos' },
    { id: 'size-desc', label: 'Más pesados' },
    { id: 'size-asc', label: 'Más ligeros' },
    { id: 'name-asc', label: 'Nombre A-Z' }
  ];

  /* ================= datos de demostración ================= */
  var DEMO_TORRENTS = [
    { id: 'A1B2C3D4E5F6', filename: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR.HEVC.TrueHD.7.1.Atmos-FraMeSToR', hash: '8f2a4c1d9e5b7a3c6d8e0f2a4b6c8d0e1f3a5b7c', bytes: 84213473280, progress: 100, status: 'downloaded', added: demoDate(2), links: ['https://real-debrid.com/d/A1B2C3D4E5F6'] },
    { id: 'B2C3D4E5F6A1', filename: 'Severance.S02E07.1080p.WEB.h264-ETHEL.mkv', hash: '1c3e5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c', bytes: 1987345678, progress: 62, status: 'downloading', added: demoDate(0.1), speed: 8412672, seeders: 34, links: [] },
    { id: 'C3D4E5F6A1B2', filename: 'The.Bear.S03.COMPLETE.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb', hash: '2d4f6b8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e', bytes: 26418372608, progress: 100, status: 'downloaded', added: demoDate(3), links: ['https://real-debrid.com/d/C3D4E5F6A1B2'] },
    { id: 'D4E5F6A1B2C3', filename: 'Oppenheimer.2023.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv', hash: '3e5a7c9d1b3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c', bytes: 22873456789, progress: 100, status: 'downloaded', added: demoDate(9), links: ['https://real-debrid.com/d/D4E5F6A1B2C3'] },
    { id: 'E5F6A1B2C3D4', filename: 'Arcane.S02.2160p.NF.WEB-DL.DDP5.1.Atmos.H.265-FLUX', hash: '4f6b8d0e2c4a6b8d0f2a4c6e8b0d2f4a6c8e0b2d', bytes: 44873456789, progress: 18, status: 'downloading', added: demoDate(0.3), speed: 12456780, seeders: 128, links: [] },
    { id: 'F6A1B2C3D4E5', filename: 'Past.Lives.2023.1080p.BluRay.x264.DTS-HD.MA.5.1-TRiToN', hash: '5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c', bytes: 8802345678, progress: 0, status: 'waiting_files_selection', added: demoDate(0.02), links: [] },
    { id: 'A7B8C9D0E1F2', filename: 'Blade.Runner.2049.2017.REMASTERED.1080p.BluRay.x264.DTS-HD.MA.5.1-FGT', hash: '6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d', bytes: 16823456789, progress: 100, status: 'downloaded', added: demoDate(14), links: ['https://real-debrid.com/d/A7B8C9D0E1F2'] },
    { id: 'B8C9D0E1F2A3', filename: 'Shogun.S01E10.1080p.DSNP.WEB-DL.DDP5.1.H.264-NTb.mkv', hash: '7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e', bytes: 2578345678, progress: 0, status: 'queued', added: demoDate(0.05), links: [] },
    { id: 'C9D0E1F2A3B4', filename: 'Perfect.Days.2023.JAPANESE.1080p.BluRay.x264.DD5.1-HiFi.mkv', hash: '8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f', bytes: 6547832109, progress: 100, status: 'downloaded', added: demoDate(21), links: ['https://real-debrid.com/d/C9D0E1F2A3B4'] },
    { id: 'D0E1F2A3B4C5', filename: 'Chernobyl.S01.2160p.MAX.WEB-DL.DDP5.1.DV.HDR.H.265-NTb', hash: '9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b', bytes: 35324567890, progress: 100, status: 'downloaded', added: demoDate(35), links: ['https://real-debrid.com/d/D0E1F2A3B4C5'] },
    { id: 'E1F2A3B4C5D6', filename: 'Furiosa.A.Mad.Max.Saga.2024.1080p.WEB-DL.DDP5.1.Atmos.H.264-FLUX.mkv', hash: '0a2c4e6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d', bytes: 11704567890, progress: 74, status: 'error', added: demoDate(4), links: [] },
    { id: 'F2A3B4C5D6E7', filename: 'The.Substance.2024.2160p.WEB-DL.DDP5.1.HDR.H.265-FLUX.mkv', hash: '1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d', bytes: 18467890123, progress: 0, status: 'magnet_conversion', added: demoDate(0.01), links: [] },
    { id: 'A3B4C5D6E7F8', filename: 'Anora.2024.1080p.AMZN.WEB-DL.DDP5.1.H.264-FLUX.mkv', hash: '2c4e6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f', bytes: 10324567890, progress: 100, status: 'downloaded', added: demoDate(6), links: ['https://real-debrid.com/d/A3B4C5D6E7F8'] },
    { id: 'B4C5D6E7F8A9', filename: 'Nosferatu.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv', hash: '3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d0a', bytes: 21234567890, progress: 100, status: 'downloaded', added: demoDate(7), links: ['https://real-debrid.com/d/B4C5D6E7F8A9'] }
  ];

  function demoDate(daysAgo) {
    return new Date(Date.now() - daysAgo * 86400000).toISOString();
  }

  var DEMO_USER = {
    id: 42,
    username: 'ezequiel',
    email: 'ezequielverapadron@gmail.com',
    points: 1240,
    type: 'premium',
    premium: 13132800,
    expiration: new Date(Date.now() + 13132800 * 1000).toISOString()
  };

  /* ================= fichas de demostración de TMDB ================= */
  var DEMO_TMDB = [
    { re: /dune/i, item: { type: 'movie', title: 'Dune: parte dos', year: 2024, rating: 8.1, votes: 6312, genres: ['Ciencia ficción', 'Aventura'], overview: 'Paul Atreides se une a los Fremen para vengar a su familia y evitar un futuro terrible que solo él puede prever.' } },
    { re: /severance/i, item: { type: 'tv', title: 'Severance', year: 2022, rating: 8.4, votes: 2140, genres: ['Drama', 'Misterio'], overview: 'Los empleados de Lumon Industries se someten a un procedimiento que separa sus recuerdos de trabajo de los personales.' } },
    { re: /the[\s.]?bear/i, item: { type: 'tv', title: 'The Bear', year: 2022, rating: 8.6, votes: 1870, genres: ['Drama', 'Comedia'], overview: 'Un chef de alta cocina vuelve a Chicago para hacerse cargo del restaurante familiar.' } },
    { re: /oppenheimer/i, item: { type: 'movie', title: 'Oppenheimer', year: 2023, rating: 8.1, votes: 9420, genres: ['Drama', 'Historia'], overview: 'La historia del físico que dirigió el Proyecto Manhattan y cambió el mundo para siempre.' } },
    { re: /arcane/i, item: { type: 'tv', title: 'Arcane', year: 2021, rating: 8.7, votes: 3860, genres: ['Animación', 'Ciencia ficción'], overview: 'Dos hermanas acaban en bandos opuestos de una guerra entre la ciudad alta de Piltover y la baja de Zaun.' } },
    { re: /past[\s.]?lives/i, item: { type: 'movie', title: 'Vidas pasadas', year: 2023, rating: 7.8, votes: 1240, genres: ['Romance', 'Drama'], overview: 'Dos amigos de la infancia se reencuentran en Nueva York veinte años después de separarse.' } },
    { re: /blade[\s.]?runner/i, item: { type: 'movie', title: 'Blade Runner 2049', year: 2017, rating: 7.6, votes: 12800, genres: ['Ciencia ficción', 'Drama'], overview: 'Un blade runner descubre un secreto enterrado que puede hundir lo que queda de la sociedad.' } },
    { re: /sh[oō]gun/i, item: { type: 'tv', title: 'Shōgun', year: 2024, rating: 8.6, votes: 1580, genres: ['Drama', 'Guerra'], overview: 'En el Japón de 1600, un marinero inglés llega a una tierra al borde de la guerra civil.' } },
    { re: /perfect[\s.]?days/i, item: { type: 'movie', title: 'Perfect Days', year: 2023, rating: 7.9, votes: 720, genres: ['Drama'], overview: 'Un limpiador de baños públicos de Tokio encuentra belleza en los pequeños rituales de su rutina.' } },
    { re: /chernobyl/i, item: { type: 'tv', title: 'Chernobyl', year: 2019, rating: 8.7, votes: 6100, genres: ['Drama', 'Historia'], overview: 'La verdadera historia del accidente nuclear de 1986 y de quienes intentaron ocultarlo.' } },
    { re: /furiosa/i, item: { type: 'movie', title: 'Furiosa: de la saga Mad Max', year: 2024, rating: 7.6, votes: 3420, genres: ['Acción', 'Aventura'], overview: 'Furiosa es arrancada de su hogar y debe sobrevivir en un desierto gobernado por señores de la guerra.' } },
    { re: /substance/i, item: { type: 'movie', title: 'La sustancia', year: 2024, rating: 7.2, votes: 2890, genres: ['Terror', 'Ciencia ficción'], overview: 'Una celebridad en decadencia prueba un tratamiento que genera una versión más joven de sí misma.' } },
    { re: /anora/i, item: { type: 'movie', title: 'Anora', year: 2024, rating: 7.1, votes: 980, genres: ['Drama', 'Comedia'], overview: 'Una trabajadora sexual de Brooklyn se casa con el hijo de un oligarca y todo se complica.' } },
    { re: /nosferatu/i, item: { type: 'movie', title: 'Nosferatu', year: 2024, rating: 7.3, votes: 1460, genres: ['Terror', 'Fantasía'], overview: 'Una joven es perseguida por una criatura milenaria enamorada de ella.' } }
  ];

  function demoTmdb(filename) {
    var match = DEMO_TMDB.filter(function (entry) { return entry.re.test(String(filename || '')); })[0];
    if (!match) return null;
    return {
      id: 0, type: match.item.type, title: match.item.title, original: match.item.title,
      year: match.item.year, overview: match.item.overview,
      poster: null, posterBig: null, rating: match.item.rating, votes: match.item.votes,
      genres: match.item.genres, url: 'https://www.themoviedb.org/'
    };
  }

  /* ================= proveedores ================= */
  var liveProvider = {
    user: function () {
      return rd('/user').then(function (res) { return res.data; });
    },
    torrents: function (page, limit) {
      return rd('/torrents?page=' + page + '&limit=' + limit).then(function (res) {
        return { items: Array.isArray(res.data) ? res.data : [], total: res.total };
      });
    },
    info: function (id) {
      return rd('/torrents/info/' + encodeURIComponent(id)).then(function (res) { return res.data; });
    },
    remove: function (id) {
      return rd('/torrents/delete/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    add: function (magnet) {
      return rd('/torrents/addMagnet', { method: 'POST', form: { magnet: magnet } }).then(function (res) { return res.data; });
    },
    select: function (id, files) {
      return rd('/torrents/selectFiles/' + encodeURIComponent(id), { method: 'POST', form: { files: files || 'all' } });
    },
    unrestrict: function (link) {
      return rd('/unrestrict/link', { method: 'POST', form: { link: link } }).then(function (res) { return res.data; });
    },
    availability: function (hashes) {
      return rd('/torrents/instantAvailability/' + hashes.join('/')).then(function (res) {
        return summarizeAvailability(res.data);
      });
    },
    tmdb: function (torrent) { return tmdbLookup(torrent); },
    dmmHealth: function () {
      var cookies = cookieHeaderFor('debridmediamanager.com');
      if (!HAS_GM) return Promise.resolve({ ok: null, reason: 'Requiere Tampermonkey' });
      return request(DMM_API + '/healthz', { headers: cookies ? { Cookie: cookies } : {} })
        .then(function () { return { ok: true }; })
        .catch(function (err) { return { ok: false, reason: err.message }; });
    }
  };

  var demoBook = { items: DEMO_TORRENTS.slice(), deleted: {} };

  function delay(ms, value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms); });
  }

  var demoProvider = {
    user: function () { return delay(160, DEMO_USER); },
    torrents: function () {
      return delay(320, { items: demoBook.items.slice(), total: demoBook.items.length });
    },
    info: function (id) {
      var torrent = demoBook.items.filter(function (t) { return t.id === id; })[0];
      if (!torrent) return delay(120, { files: [], links: [] });
      var parts = ['mkv', 'srt', 'nfo', 'jpg'];
      var files = [0, 1, 2].map(function (i) {
        return { id: i + 1, path: '/' + torrent.filename.replace(/\.[a-z0-9]+$/i, '') + (i ? '.part' + (i + 1) : '') + '.' + (parts[i] || 'mkv'), bytes: Math.round(torrent.bytes / (i + 1.6)), selected: 1 };
      });
      return delay(240, { id: torrent.id, filename: torrent.filename, hash: torrent.hash, bytes: torrent.bytes, files: files, links: torrent.links });
    },
    remove: function (id) {
      demoBook.items = demoBook.items.filter(function (t) { return t.id !== id; });
      return delay(220);
    },
    add: function (magnet) {
      var hash = hashOf(magnet) || 'deadbeef';
      var id = 'D' + hash.slice(0, 11).toUpperCase();
      var item = { id: id, filename: 'Release.' + hash.slice(0, 6) + '.1080p.WEB-DL.H.264-GRP.mkv', hash: hash, bytes: 8462345678, progress: 0, status: 'magnet_conversion', added: new Date().toISOString(), links: [] };
      demoBook.items.unshift(item);
      return delay(420, { id: id, uri: 'magnet' });
    },
    select: function () { return delay(300); },
    unrestrict: function (link) {
      return delay(600, { download: 'https://download.real-debrid.com/d/' + link.slice(-12) + '/archivo.mkv', filename: 'descarga.mkv', filesize: 8421347328, host: 'real-debrid.com' });
    },
    availability: function (hashes) {
      var out = {};
      hashes.forEach(function (hash, index) {
        out[hash] = { cached: index % 3 !== 1, files: index % 3 !== 1 ? 3 : 0, bytes: 8421347328 };
      });
      return delay(700, out);
    },
    tmdb: function (torrent) { return delay(160, demoTmdb(torrent.filename)); },
    dmmHealth: function () {
      return delay(400, { ok: null, reason: 'Modo demostración' });
    }
  };

  var data = DEMO ? demoProvider : liveProvider;

  /* ================= iconos ================= */
  function icon(name) {
    var paths = {
      bolt: '<path d="M13 2 5 13.5h5.5L11 22l8-11.5h-5.5L13 2Z"/>',
      library: '<path d="M4 4h5v16H4zM15 4h5v16h-5zM9 4v16"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16.5 2.5H21v4.5"/>',
      refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v6h-6"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
      trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
      link: '<path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
      files: '<path d="M8 3h7l4 4v14H8z"/><path d="M15 3v4h4"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
      check: '<path d="m5 13 4 4L19 7"/>',
      alert: '<path d="M12 8v6M12 17v.5"/><path d="M12 3 2 21h20L12 3Z"/>',
      box: '<path d="M12 3 3 8v8l9 5 9-5V8l-9-5Z"/><path d="m3 8 9 5 9-5"/>',
      folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
      star: '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3Z"/>',
      film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  /* ================= estado de la interfaz ================= */
  var state = {
    view: 'library',
    filter: 'all',
    q: '',
    sort: 'added-desc',
    page: 1,
    limit: 100,
    torrents: [],
    total: null,
    loading: false,
    error: null,
    user: null,
    userError: null,
    details: {},
    links: {},
    expanded: {},
    busy: {},
    addText: '',
    addBusy: false,
    addResults: null,
    autoRefresh: sget('autoRefresh', true) !== false,
    tmdb: {},
    tmdbBlocked: null,
    session: { testing: false, health: null, tmdbTest: null, tmdbTesting: false }
  };

  if (!DEMO) {
    var savedSort = sget('sort', 'added-desc');
    if (SORTS.some(function (s) { return s.id === savedSort; })) state.sort = savedSort;
  }

  var shadow = null;
  var els = {};

  /* ================= estructura ================= */
  function shellHtml() {
    return '<button class="launcher" data-action="toggle" type="button" aria-label="Abrir DMM Studio" title="DMM Studio (Ctrl+Shift+D)">' +
        '<span class="glow"></span><span class="ring"></span>' + icon('bolt') +
      '</button>' +
      '<div class="overlay" data-ref="overlay">' +
        '<div class="panel" role="dialog" aria-modal="true" aria-label="DMM Studio">' +
          '<aside class="rail" data-ref="rail"></aside>' +
          '<section class="main">' +
            '<div class="topbar">' +
              '<label class="search">' + icon('search') +
                '<input type="search" data-ref="search" placeholder="Buscar en la biblioteca..." autocomplete="off" spellcheck="false" aria-label="Buscar">' +
              '</label>' +
              '<button class="iconbtn" data-action="refresh" type="button" title="Recargar">' + icon('refresh') + '</button>' +
              '<button class="iconbtn" data-action="close" type="button" title="Cerrar (Esc)">' + icon('close') + '</button>' +
            '</div>' +
            '<div class="content" data-ref="content"></div>' +
          '</section>' +
        '</div>' +
      '</div>' +
      '<div class="toasts" data-ref="toasts"></div>';
  }

  function mount() {
    var host = document.createElement('div');
    host.id = 'dmm-studio-host';
    (document.body || document.documentElement).appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
    var root = document.createElement('div');
    root.innerHTML = shellHtml();
    shadow.appendChild(root);
    els.root = root;
    els.overlay = root.querySelector('[data-ref="overlay"]');
    els.rail = root.querySelector('[data-ref="rail"]');
    els.content = root.querySelector('[data-ref="content"]');
    els.search = root.querySelector('[data-ref="search"]');
    els.toasts = root.querySelector('[data-ref="toasts"]');
    bindEvents();
    renderRail();
    renderContent();
    if (DEMO || window.DMM_STUDIO_OPEN) openPanel();
  }

  function openPanel() {
    els.overlay.classList.add('open');
    setTimeout(function () { if (els.search) els.search.focus(); }, 120);
    if (!state.user && !state.loading) refreshAll();
  }

  function closePanel() {
    els.overlay.classList.remove('open');
  }

  function isOpen() { return els.overlay && els.overlay.classList.contains('open'); }

  /* ================= avisos ================= */
  function toast(message, tone) {
    if (!els.toasts) return;
    var node = document.createElement('div');
    node.className = 'toast ' + (tone || '');
    node.textContent = message;
    els.toasts.appendChild(node);
    setTimeout(function () {
      node.style.transition = 'opacity .3s ease, transform .3s ease';
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      setTimeout(function () { node.remove(); }, 320);
    }, 3800);
  }
  /* ================= carga ================= */
  function refreshAll() {
    loadUser();
    return loadLibrary(true);
  }

  async function loadUser() {
    try {
      state.user = await data.user();
      state.userError = null;
      state.session.expired = false;
    } catch (err) {
      state.userError = err.message;
      if (err.session) state.session.expired = true;
    }
    renderRail();
    if (state.view === 'session') renderContent();
  }

  async function loadLibrary(reset) {
    if (state.loading) return;
    state.loading = true;
    state.error = null;
    if (reset) {
      state.page = 1;
      state.torrents = [];
      state.expanded = {};
      state.details = {};
      state.links = {};
    }
    renderContent();
    try {
      var res = await data.torrents(state.page, state.limit);
      state.torrents = reset ? res.items : state.torrents.concat(res.items);
      if (typeof res.total === 'number') state.total = res.total;
      else if (state.total == null) state.total = state.torrents.length;
      state.session.expired = false;
    } catch (err) {
      state.error = err.message;
      if (err.session) state.session.expired = true;
    } finally {
      state.loading = false;
      renderRail();
      renderContent();
    }
  }

  function parseInputs(text) {
    return String(text || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (raw) {
      return { raw: raw, hash: hashOf(raw) };
    });
  }

  function visibleTorrents() {
    var filter = FILTERS.filter(function (f) { return f.id === state.filter; })[0] || FILTERS[0];
    var q = state.q.trim().toLowerCase();
    var list = state.torrents.filter(function (t) {
      if (!filter.match(t)) return false;
      if (!q) return true;
      return String(t.filename || '').toLowerCase().indexOf(q) !== -1;
    });
    var sort = state.sort;
    list.sort(function (a, b) {
      if (sort === 'size-desc') return (Number(b.bytes) || 0) - (Number(a.bytes) || 0);
      if (sort === 'size-asc') return (Number(a.bytes) || 0) - (Number(b.bytes) || 0);
      if (sort === 'name-asc') return String(a.filename || '').localeCompare(String(b.filename || ''), 'es');
      var da = new Date(a.added || 0).getTime() || 0;
      var db = new Date(b.added || 0).getTime() || 0;
      return sort === 'added-asc' ? da - db : db - da;
    });
    return list;
  }

  function summary() {
    var total = state.total == null ? state.torrents.length : state.total;
    var active = 0;
    var ready = 0;
    var bytes = 0;
    state.torrents.forEach(function (t) {
      if (ACTIVE_STATUSES.indexOf(t.status) !== -1) active += 1;
      if (t.status === 'downloaded') ready += 1;
      bytes += Number(t.bytes) || 0;
    });
    return { total: total, active: active, ready: ready, bytes: bytes, loaded: state.torrents.length };
  }

  /* ================= pintado ================= */
  function titleRow(title, subtitle) {
    return '<div class="title-row"><div><h2 class="title">' + esc(title) + '</h2><p class="subtitle">' + esc(subtitle) + '</p></div></div>';
  }

  function statCard(label, value, hint) {
    return '<div class="stat"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div><div class="hint">' + esc(hint) + '</div></div>';
  }

  function emptyState(iconName, title, text, actionLabel, actionName) {
    return '<div class="empty"><div class="empty-icon">' + icon(iconName) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (actionLabel ? '<div class="form-row"><button class="btn primary" data-action="' + actionName + '" type="button">' + esc(actionLabel) + '</button></div>' : '') +
      '</div>';
  }

  function tokenSourceLabel() {
    if (DEMO) return 'Datos de demostración';
    if (String(sget('token', '') || '').trim()) return 'Token pegado a mano';
    var stored = readDmmToken();
    if (stored && stored.value) return 'Sesión de DMM (rd:accessToken)';
    if (readDmmValue('rd:refreshToken')) return 'Credenciales OAuth de DMM';
    return 'Sin credenciales';
  }

  function renderRail() {
    if (!els.rail) return;
    var user = state.user;
    var initial = user && user.username ? String(user.username).charAt(0).toUpperCase() : 'D';
    var avatar = user && user.avatar ? '<img src="' + esc(user.avatar) + '" alt="">' : esc(initial);

    var plan;
    if (!user) {
      plan = '<span class="pill off">' + (state.session.expired ? 'Sin sesión' : 'Conectando') + '</span>';
    } else if (user.type === 'premium') {
      plan = '<span class="pill">' + icon('check') + ' Premium · ' + fmtNum(premiumDays(user.premium)) + ' d</span>';
    } else {
      plan = '<span class="pill free">Cuenta gratuita</span>';
    }

    var navItems = [
      { id: 'library', label: 'Biblioteca', iconName: 'library', count: user ? fmtNum(state.total == null ? state.torrents.length : state.total) : '' },
      { id: 'add', label: 'Añadir', iconName: 'plus', count: '' },
      { id: 'session', label: 'Sesión', iconName: 'key', count: '' }
    ];
    var nav = navItems.map(function (item) {
      return '<button class="navbtn' + (state.view === item.id ? ' active' : '') + '" data-action="view" data-view="' + item.id + '" type="button">' +
        icon(item.iconName) + '<span>' + item.label + '</span>' +
        (item.count ? '<span class="count">' + item.count + '</span>' : '') + '</button>';
    }).join('');

    var tone = state.session.expired ? 'bad' : (user ? '' : 'warn');
    var status = state.session.expired ? 'Sin sesión de RD' : (user ? 'Sesión activa' : 'Comprobando sesión');

    els.rail.innerHTML =
      '<div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">DMM Studio</div><div class="brand-sub">Debrid Manager</div></div></div>' +
      '<div class="account"><div class="avatar">' + avatar + '</div><div class="account-info">' +
        '<div class="account-name">' + esc(user ? user.username : 'Real-Debrid') + '</div>' +
        '<div class="account-mail">' + esc(user ? (user.email || (user.points ? fmtNum(user.points) + ' puntos' : '')) : 'Sin conectar') + '</div>' +
        plan +
      '</div></div>' +
      '<nav class="rail-nav">' + nav + '</nav>' +
      '<div class="rail-foot"><div class="status-line"><span class="dot ' + tone + '"></span>' + status + '</div>' +
      '<div class="version">v' + VERSION + (DEMO ? ' · demo' : HAS_GM ? ' · Tampermonkey' : ' · navegador') + '</div></div>';
  }

  function renderContent() {
    if (!els.content) return;
    if (state.view === 'library') renderLibrary();
    else if (state.view === 'add') renderAdd();
    else renderSession();
  }

  function renderLibrary() {
    var s = summary();
    var stats = '<div class="stats">' +
      statCard('Biblioteca', fmtNum(s.total), 'torrents en la cuenta') +
      statCard('En curso', fmtNum(s.active), 'descargas activas') +
      statCard('Listos', fmtNum(s.ready), 'entre los ' + fmtNum(s.loaded) + ' cargados') +
      statCard('Peso cargado', fmtBytes(s.bytes), 'de ' + fmtNum(s.loaded) + ' torrents') +
      '</div>';

    var chips = FILTERS.map(function (f) {
      return '<button class="chipbtn' + (state.filter === f.id ? ' active' : '') + '" data-action="filter" data-filter="' + f.id + '" type="button">' + f.label + '</button>';
    }).join('');

    var options = SORTS.map(function (o) {
      return '<option value="' + o.id + '"' + (state.sort === o.id ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var toolbar = '<div class="toolbar"><div style="display:flex;gap:8px;flex-wrap:wrap">' + chips + '</div>' +
      '<div class="spacer"></div><select class="select" data-ref="sort" aria-label="Ordenar">' + options + '</select></div>';

    els.content.innerHTML = titleRow('Biblioteca', 'Tu cuenta de Real-Debrid con filtros, archivos y enlaces en el mismo sitio.') +
      stats + tmdbNotice() + toolbar + buildList() + buildFooter();
    scheduleTmdb(visibleTorrents());
  }

  function buildList() {
    if (state.loading && state.torrents.length === 0) {
      var skeleton = '';
      for (var i = 0; i < 5; i += 1) skeleton += '<div class="skel"></div>';
      return '<div class="list">' + skeleton + '</div>';
    }

    if (state.error && state.torrents.length === 0) {
      var isSession = /token|sesión|sesion|credencial/i.test(state.error);
      return '<div class="empty"><div class="empty-icon">' + icon(isSession ? 'key' : 'alert') + '</div>' +
        '<h3>' + (isSession ? 'Falta la sesión de Real-Debrid' : 'No se pudo cargar la biblioteca') + '</h3>' +
        '<p>' + esc(state.error) + '</p>' +
        '<div class="form-row">' +
          (isSession ? '<button class="btn primary" data-action="view" data-view="session" type="button">Configurar sesión</button>' : '') +
          '<button class="btn" data-action="refresh" type="button">Reintentar</button>' +
        '</div></div>';
    }

    var list = visibleTorrents();
    if (state.torrents.length === 0) {
      return emptyState('box', 'Biblioteca vacía', 'Cuando añadas un magnet aparecerá aquí, con su progreso y sus archivos.', 'Añadir el primero', 'go-add');
    }
    if (list.length === 0) {
      return emptyState('search', 'Sin resultados', 'Ningún torrent coincide con el filtro o la búsqueda actual.');
    }
    return '<div class="list">' + list.map(rowHtml).join('') + '</div>';
  }

  function buildFooter() {
    if (!state.torrents.length) return '';
    var total = state.total == null ? state.torrents.length : state.total;
    var list = visibleTorrents();
    var more = state.torrents.length < total;
    return '<div class="form-row" style="justify-content:space-between;margin-top:14px">' +
      '<span class="hint">Mostrando ' + fmtNum(list.length) + ' de ' + fmtNum(total) + '</span>' +
      (more ? '<button class="btn" data-action="loadmore" type="button"' + (state.loading ? ' disabled' : '') + '>' + (state.loading ? 'Cargando…' : 'Cargar más') + '</button>' : '') +
      '</div>';
  }

  function rowHtml(t) {
    var meta = STATUS[t.status] || { label: t.status || 'Desconocido', tone: 'idle' };
    var active = t.status === 'downloading';
    var progress = active ? '<div class="progress"><i style="width:' + Math.max(2, Math.min(100, Number(t.progress) || 0)) + '%"></i></div>' : '';

    var bits = ['<span>' + fmtBytes(t.bytes) + '</span>', '<span class="sep">·</span>', '<span>' + fmtAgo(t.added) + '</span>'];
    if (active && t.speed) bits.push('<span class="sep">·</span><span>' + fmtBytes(t.speed) + '/s</span>');
    if (active && t.seeders) bits.push('<span class="sep">·</span><span>' + fmtNum(t.seeders) + ' semillas</span>');
    if (t.hash) bits.push('<span class="sep">·</span><span class="hash mono">' + esc(String(t.hash).slice(0, 10)) + '…</span>');
    var item = tmdbOf(t.id);
    if (item) {
      if (item.rating) bits.push('<span class="sep">·</span><span class="tmdb-chip">★ ' + item.rating.toFixed(1) + '</span>');
      if (item.year) bits.push('<span class="sep">·</span><span>' + item.year + '</span>');
    }

    var actions = '';
    if (t.status === 'waiting_files_selection') {
      actions += '<button class="act" data-action="select" data-id="' + esc(t.id) + '" type="button">Elegir todo</button>';
    }
    if ((t.links && t.links.length) || t.status === 'downloaded') {
      actions += '<button class="act" data-action="links" data-id="' + esc(t.id) + '" type="button">' + (state.busy[t.id] ? '…' : 'Enlaces') + '</button>';
    }
    actions += '<button class="act" data-action="files" data-id="' + esc(t.id) + '" type="button">Archivos</button>';
    actions += '<button class="act danger" data-action="delete" data-id="' + esc(t.id) + '" type="button">Borrar</button>';

    return '<article class="row">' +
      '<div class="row-head">' +
        '<div class="row-inner">' +
          thumbHtml(t) +
          '<div class="row-main">' +
            '<div class="row-title"><span class="statusdot ' + meta.tone + '"></span><h3 title="' + esc(t.filename) + '">' + esc(t.filename) + '</h3></div>' +
            '<div class="row-meta">' + bits.join('') + '</div>' + progress +
          '</div>' +
        '</div>' +
        '<div class="row-side"><span class="badge ' + meta.tone + '">' + esc(meta.label) + (active ? ' ' + Math.round(Number(t.progress) || 0) + '%' : '') + '</span>' +
        '<div class="row-actions">' + actions + '</div></div>' +
      '</div>' + detailHtml(t) + '</article>';
  }

  function detailHtml(t) {
    if (!state.expanded[t.id]) return '';
    var blocks = [];
    var tmdbCard = tmdbBlock(t);
    if (tmdbCard) blocks.push(tmdbCard);
    var links = state.links[t.id];
    if (links && links.length) {
      blocks.push(links.map(function (item) {
        return '<div class="linkline"><span class="mono">' + esc(item.download) + '</span>' +
          '<button class="act" data-action="copy" data-copy="' + esc(item.download) + '" type="button">Copiar</button>' +
          '<a href="' + esc(item.download) + '" target="_blank" rel="noreferrer noopener">Abrir</a></div>';
      }).join(''));
    }

    var detail = state.details[t.id];
    if (!detail || detail.loading) {
      blocks.push('<div class="loading-line"><span class="spinner"></span> Cargando archivos…</div>');
    } else if (detail.error) {
      blocks.push('<div class="detail-note">' + esc(detail.error) + '</div>');
    } else {
      var info = detail.info || {};
      var files = Array.isArray(info.files) ? info.files.slice(0, 8) : [];
      if (files.length) {
        blocks.push(files.map(function (file) {
          return '<div class="file"><span class="file-name mono">' + esc(file.path || '') + '</span><span class="file-size">' + fmtBytes(file.bytes) + '</span></div>';
        }).join(''));
        if (info.files.length > files.length) {
          blocks.push('<div class="detail-note">y ' + fmtNum(info.files.length - files.length) + ' archivo(s) más</div>');
        }
      }
      var count = info.links ? info.links.length : 0;
      if (count && !(links && links.length)) {
        blocks.push('<div class="detail-note">' + fmtNum(count) + ' enlace(s) listos para desbloquear con Real-Debrid.</div>');
      }
      if (!files.length && !count) {
        blocks.push('<div class="detail-note">Todavía no hay archivos disponibles para este torrent.</div>');
      }
    }
    return '<div class="detail">' + blocks.join('') + '</div>';
  }

  function renderAdd() {
    var inputs = parseInputs(state.addText);
    var results = '';
    if (state.addResults) {
      results = '<div class="card"><h3>Caché en Real-Debrid</h3>' +
        '<p>Lo que está en caché se descarga al instante; lo demás depende de las semillas del torrent.</p>' +
        state.addResults.map(function (r) {
          var badge = r.unknown ? '<span class="badge bad">No válido</span>'
            : r.cached ? '<span class="badge ok">En caché</span>'
            : '<span class="badge idle">Sin caché</span>';
          return '<div class="file"><span class="file-name mono">' + esc(r.hash || r.raw) + '</span>' + badge + '</div>';
        }).join('') + '</div>';
    }

    els.content.innerHTML = titleRow('Añadir torrents', 'Magnet links o hashes SHA1, uno por línea. Real-Debrid limita los añadidos seguidos.') +
      '<div class="card"><h3>Magnet links o hashes</h3>' +
        '<p>Puedes comprobar la caché antes de añadir; al entrar se seleccionan todos los archivos.</p>' +
        '<textarea class="field mono" data-ref="add-text" placeholder="magnet:?xt=urn:btih:...&#10;8f2a4c1d9e5b7a3c6d8e0f2a4b6c8d0e1f3a5b7c">' + esc(state.addText) + '</textarea>' +
        '<div class="form-row">' +
          '<button class="btn primary" data-action="add" type="button"' + (state.addBusy ? ' disabled' : '') + '>' + (state.addBusy ? 'Trabajando…' : 'Añadir a la biblioteca') + '</button>' +
          '<button class="btn" data-action="check" type="button"' + (state.addBusy ? ' disabled' : '') + '>Comprobar caché</button>' +
          '<button class="btn ghost" data-action="paste" type="button">Pegar</button>' +
          '<span class="hint">' + inputs.length + ' línea(s)</span>' +
        '</div></div>' + results;
  }

  function renderSession() {
    var health = state.session.health;
    var imported = importedCookies();
    var rows = [
      ['Origen del token', tokenSourceLabel()],
      ['Sesión en localStorage', readDmmToken() ? 'Sí (rd:accessToken)' : 'No'],
      ['Credenciales OAuth', readDmmValue('rd:refreshToken') ? 'Sí, renovación automática' : 'No'],
      ['Cookies importadas', imported.length ? fmtNum(imported.length) : 'Ninguna'],
      ['cf_clearance de DMM', hasCookie('cf_clearance', 'debridmediamanager.com') ? 'Detectada' : 'No detectada'],
      ['auth de Real-Debrid', hasCookie('auth', 'real-debrid.com') ? 'Detectada' : 'No detectada'],
      ['TMDB', tmdbStatus()],
      ['Fichas de TMDB cargadas', fmtNum(tmdbMatchedCount())]
    ].map(function (pair) {
      return '<div class="kvrow"><span class="k">' + esc(pair[0]) + '</span><span class="v">' + esc(pair[1]) + '</span></div>';
    }).join('');

    els.content.innerHTML = titleRow('Sesión', 'DMM Studio reutiliza la sesión que el navegador ya tiene abierta.') +
      '<div class="card"><h3>Estado de la conexión</h3><div class="kv">' + rows + '</div>' +
        '<div class="form-row"><button class="btn" data-action="test-session" type="button"' + (state.session.testing ? ' disabled' : '') + '>' +
          (state.session.testing ? 'Probando…' : 'Probar sesión') + '</button>' +
          (health ? '<span class="hint">RD: ' + esc(health.rd) + ' · DMM: ' + esc(health.dmm) + '</span>' : '') +
        '</div></div>' +
      '<div class="card"><h3>Token manual de Real-Debrid</h3>' +
        '<p>Si aquí no hay sesión de DMM, pega la API privada de real-debrid.com/apitoken. Solo se guarda en tu navegador.</p>' +
        '<input class="field mono" data-ref="token-input" type="password" placeholder="Token privado de Real-Debrid" autocomplete="off" spellcheck="false">' +
        '<div class="form-row"><button class="btn primary" data-action="save-token" type="button">Guardar token</button>' +
        '<button class="btn ghost" data-action="clear-token" type="button">Borrar token manual</button></div></div>' +
      '<div class="card"><h3>TMDB</h3>' +
        '<p>Con tu clave de TMDB cada torrent muestra póster, año, nota y sinopsis. La clave se guarda solo en tu navegador y las peticiones van directas a api.themoviedb.org.</p>' +
        '<input class="field mono" data-ref="tmdb-input" type="password" placeholder="API Key v3 (32 caracteres) o Read Access Token v4" autocomplete="off" spellcheck="false">' +
        '<div class="form-row"><button class="btn primary" data-action="save-tmdb" type="button">Guardar clave</button>' +
        '<button class="btn" data-action="test-tmdb" type="button"' + (state.session.tmdbTesting ? ' disabled' : '') + '>' +
          (state.session.tmdbTesting ? 'Probando…' : 'Probar clave') + '</button>' +
        '<button class="btn ghost" data-action="clear-tmdb" type="button">Borrar clave</button>' +
        '<a class="hint" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer noopener" style="text-decoration:underline">Obtener una clave gratis</a></div>' +
        (state.session.tmdbTest ? '<p class="hint" style="margin:10px 0 0">' + esc(state.session.tmdbTest) + '</p>' : '') +
        '<p class="hint" style="margin:10px 0 0">Si pegas una API Key v3 se envía como api_key; si pegas un token v4 se envía como Bearer.</p></div>' +
      '<div class="card"><h3>Importar cookies (opcional)</h3>' +
        '<p>Pega un archivo de cookies en formato Netscape. Solo se guardan las de debridmediamanager.com y real-debrid.com, y solo se envían a las rutas de DMM.</p>' +
        '<textarea class="field mono" data-ref="cookie-input" placeholder="# Netscape HTTP Cookie File&#10;.debridmediamanager.com&#9;TRUE&#9;/&#9;TRUE&#9;0&#9;cf_clearance&#9;..."></textarea>' +
        '<div class="form-row"><button class="btn primary" data-action="import-cookies" type="button">Importar cookies</button>' +
        '<button class="btn ghost" data-action="clear-cookies" type="button">Borrar cookies</button></div></div>' +
      '<div class="card"><h3>Preferencias</h3><div class="kv">' +
        '<div class="kvrow"><span class="k">Auto-actualizar descargas</span><span class="v">' + (state.autoRefresh ? 'Activado (12 s)' : 'Desactivado') + '</span></div>' +
        '<div class="kvrow"><span class="k">Versión del script</span><span class="v">' + VERSION + '</span></div></div>' +
        '<div class="form-row"><button class="btn" data-action="toggle-autorefresh" type="button">' + (state.autoRefresh ? 'Desactivar refresco' : 'Activar refresco') + '</button>' +
        '<button class="btn danger" data-action="clear-all" type="button">Borrar datos locales</button></div>' +
        '<p class="hint" style="margin:10px 0 0">Ctrl+Shift+D abre el panel · Esc lo cierra · / salta al buscador.</p></div>';
  }
  /* ================= acciones ================= */
  function toggleDetail(id) {
    if (state.expanded[id]) {
      delete state.expanded[id];
      renderContent();
      return;
    }
    state.expanded[id] = true;
    renderContent();
    if (!state.details[id] || state.details[id].error) {
      state.details[id] = { loading: true };
      renderContent();
      data.info(id).then(function (info) {
        state.details[id] = { loading: false, info: info };
      }).catch(function (err) {
        state.details[id] = { loading: false, error: err.message };
      }).then(function () { renderContent(); });
    }
  }

  async function makeLinks(id) {
    if (state.busy[id]) return;
    var torrent = state.torrents.filter(function (t) { return t.id === id; })[0];
    if (!torrent) return;
    var links = (state.details[id] && state.details[id].info && state.details[id].info.links) || torrent.links || [];
    if (!links.length) {
      try {
        var info = await data.info(id);
        links = info.links || [];
        state.details[id] = { loading: false, info: info };
      } catch (err) {
        toast(err.message, 'bad');
        return;
      }
    }
    if (!links.length) {
      toast('Ese torrent no tiene enlaces todavía: puede seguir descargando.', 'warn');
      return;
    }
    state.busy[id] = true;
    state.expanded[id] = true;
    renderContent();
    toast('Desbloqueando enlaces (Real-Debrid limita ~1 cada 5 s)', 'info');
    var out = [];
    var slice = links.slice(0, 3);
    for (var i = 0; i < slice.length; i += 1) {
      try {
        var res = await data.unrestrict(slice[i]);
        if (res && res.download) out.push(res);
      } catch (err) {
        toast(err.message, 'bad');
        break;
      }
      if (i < slice.length - 1) await new Promise(function (r) { setTimeout(r, 1200); });
    }
    state.links[id] = out;
    state.busy[id] = false;
    renderContent();
    if (out.length) toast(out.length + ' enlace(s) listos para copiar', 'ok');
  }

  function removeTorrent(id) {
    var torrent = state.torrents.filter(function (t) { return t.id === id; })[0];
    var name = torrent ? torrent.filename : id;
    if (!window.confirm('¿Borrar de Real-Debrid?\n\n' + name)) return;
    data.remove(id).then(function () {
      state.torrents = state.torrents.filter(function (t) { return t.id !== id; });
      if (state.total) state.total = Math.max(0, state.total - 1);
      delete state.expanded[id];
      delete state.details[id];
      delete state.links[id];
      toast('Torrent borrado', 'ok');
      renderRail();
      renderContent();
    }).catch(function (err) { toast(err.message, 'bad'); });
  }

  async function selectAll(id) {
    try {
      await data.select(id, 'all');
      toast('Archivos seleccionados: la descarga arranca ahora', 'ok');
      loadLibrary(true);
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  function fallbackCopy(text, done) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('No se pudo copiar', 'bad'); }
    area.remove();
  }

  function copyText(text) {
    if (!text) return;
    var done = function () { toast('Copiado al portapapeles', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  async function checkAvailability() {
    var inputs = parseInputs(state.addText);
    if (!inputs.length) { toast('Pega al menos un magnet o hash', 'warn'); return; }
    var hashes = inputs.map(function (x) { return x.hash; }).filter(Boolean).slice(0, 5);
    if (!hashes.length) { toast('Ninguna línea tiene un hash válido', 'bad'); return; }
    state.addBusy = true;
    state.addResults = null;
    renderContent();
    try {
      var res = await data.availability(hashes);
      state.addResults = inputs.map(function (item) {
        var info = item.hash ? res[item.hash] : null;
        return { raw: item.raw, hash: item.hash, cached: info ? info.cached : false, files: info ? info.files : 0, unknown: !item.hash };
      });
    } catch (err) {
      toast(err.message, 'bad');
    }
    state.addBusy = false;
    renderContent();
  }

  async function addFromText() {
    var inputs = parseInputs(state.addText);
    if (!inputs.length) { toast('Pega al menos un magnet o hash', 'warn'); return; }
    var valid = inputs.filter(function (x) { return !!toMagnet(x.raw); });
    if (!valid.length) { toast('No se reconoció ningún magnet ni hash SHA1', 'bad'); return; }
    state.addBusy = true;
    renderContent();
    var added = 0;
    var batch = valid.slice(0, 5);
    for (var i = 0; i < batch.length; i += 1) {
      try {
        var res = await data.add(toMagnet(batch[i].raw));
        if (res && res.id) {
          try { await data.select(res.id, 'all'); } catch (e) { /* la cuenta puede no necesitarlo */ }
          added += 1;
        }
      } catch (err) {
        toast(err.message, 'bad');
      }
      if (i < batch.length - 1) await new Promise(function (r) { setTimeout(r, 1200); });
    }
    state.addBusy = false;
    if (added) {
      toast(added + ' torrent(s) añadidos a Real-Debrid', 'ok');
      state.addText = '';
      state.addResults = null;
      state.view = 'library';
      renderRail();
      loadLibrary(true);
      return;
    }
    renderContent();
  }

  async function pasteIntoAdd() {
    try {
      var text = await navigator.clipboard.readText();
      if (!text) { toast('El portapapeles está vacío', 'warn'); return; }
      state.addText = text.trim();
      renderContent();
    } catch (e) {
      toast('El navegador no permite leer el portapapeles', 'bad');
    }
  }

  function saveTmdbKey() {
    var input = els.content.querySelector('[data-ref="tmdb-input"]');
    var value = input ? input.value.trim() : '';
    if (!value) { toast('Escribe tu clave de TMDB', 'warn'); return; }
    if (!/^eyJ/.test(value) && !/^[a-f0-9]{32}$/i.test(value)) {
      toast('La clave no tiene el formato habitual de TMDB; se guarda igual', 'warn');
    }
    sset('tmdbKey', value);
    state.tmdbBlocked = null;
    state.session.tmdbTest = 'Clave guardada. Buscando fichas…';
    toast('Clave de TMDB guardada', 'ok');
    renderContent();
    scheduleTmdb(state.torrents);
  }

  async function testTmdbKey() {
    if (!tmdbLinked()) { toast('Guarda primero tu clave de TMDB', 'warn'); return; }
    state.session.tmdbTesting = true;
    state.session.tmdbTest = null;
    renderContent();
    try {
      await tmdbPing();
      state.session.tmdbTest = 'Clave válida: TMDB respondió correctamente.';
      toast('TMDB conectada', 'ok');
    } catch (err) {
      state.session.tmdbTest = err.message;
      toast(err.message, 'bad');
    }
    state.session.tmdbTesting = false;
    renderContent();
  }

  function saveToken() {
    var input = els.content.querySelector('[data-ref="token-input"]');
    var value = input ? input.value.trim() : '';
    if (!value) { toast('Escribe el token de Real-Debrid', 'warn'); return; }
    sset('token', value);
    tokenMemo = null;
    toast('Token guardado', 'ok');
    refreshAll();
    renderContent();
  }

  function importCookies() {
    var area = els.content.querySelector('[data-ref="cookie-input"]');
    var parsed = parseNetscape(area ? area.value : '');
    if (!parsed.length) { toast('No hay cookies en formato Netscape', 'bad'); return; }
    var relevant = parsed.filter(function (c) {
      var domain = String(c.domain || '').replace(/^\./, '');
      return domain === 'debridmediamanager.com' || domain === 'real-debrid.com';
    });
    var stored = relevant.length ? relevant : parsed;
    sset('cookies', stored);
    toast(fmtNum(stored.length) + ' cookie(s) importadas', 'ok');
    renderContent();
    renderRail();
  }

  function clearAll() {
    if (!window.confirm('¿Borrar token, cookies importadas y preferencias de DMM Studio?')) return;
    ['token', 'cookies', 'sort', 'autoRefresh', 'tmdbKey', 'tmdbCache'].forEach(sdel);
    tokenMemo = null;
    tmdbCache = null;
    state.tmdb = {};
    state.tmdbBlocked = null;
    state.addResults = null;
    state.addText = '';
    toast('Datos locales borrados', 'warn');
    renderContent();
    renderRail();
  }

  async function testSession() {
    state.session.testing = true;
    state.session.health = null;
    renderContent();
    var out = { rd: '—', dmm: '—' };
    try {
      var user = await data.user();
      state.user = user;
      out.rd = user && user.username ? 'Conectado como ' + user.username : 'Conectado';
    } catch (err) {
      out.rd = err.message;
    }
    try {
      var health = await data.dmmHealth();
      out.dmm = health.ok === true ? 'Cloudflare OK' : (health.ok === null ? health.reason : health.reason || 'Error');
    } catch (err) {
      out.dmm = err.message;
    }
    state.session.testing = false;
    state.session.health = out;
    renderContent();
    renderRail();
  }

  async function handleAction(action, el) {
    if (action === 'toggle') { isOpen() ? closePanel() : openPanel(); return; }
    if (action === 'close') { closePanel(); return; }
    if (action === 'refresh') { refreshAll(); return; }
    if (action === 'view') { state.view = el.getAttribute('data-view'); renderRail(); renderContent(); return; }
    if (action === 'go-add') { state.view = 'add'; renderRail(); renderContent(); return; }
    if (action === 'filter') { state.filter = el.getAttribute('data-filter'); renderContent(); return; }
    if (action === 'loadmore') { state.page += 1; loadLibrary(false); return; }
    if (action === 'files') { toggleDetail(el.getAttribute('data-id')); return; }
    if (action === 'links') { makeLinks(el.getAttribute('data-id')); return; }
    if (action === 'delete') { removeTorrent(el.getAttribute('data-id')); return; }
    if (action === 'select') { selectAll(el.getAttribute('data-id')); return; }
    if (action === 'copy') { copyText(el.getAttribute('data-copy')); return; }
    if (action === 'check') { checkAvailability(); return; }
    if (action === 'add') { addFromText(); return; }
    if (action === 'paste') { pasteIntoAdd(); return; }
    if (action === 'save-token') { saveToken(); return; }
    if (action === 'go-tmdb') {
      state.view = 'session';
      renderRail();
      renderContent();
      var tmdbInput = els.content.querySelector('[data-ref="tmdb-input"]');
      if (tmdbInput) tmdbInput.focus();
      return;
    }
    if (action === 'save-tmdb') { saveTmdbKey(); return; }
    if (action === 'test-tmdb') { testTmdbKey(); return; }
    if (action === 'clear-tmdb') {
      sdel('tmdbKey');
      sdel('tmdbCache');
      tmdbCache = null;
      state.tmdb = {};
      state.tmdbBlocked = null;
      state.session.tmdbTest = 'Clave borrada.';
      toast('Clave de TMDB borrada', 'warn');
      renderContent();
      return;
    }
    if (action === 'clear-token') { sdel('token'); tokenMemo = null; toast('Token manual borrado', 'warn'); renderContent(); renderRail(); return; }
    if (action === 'import-cookies') { importCookies(); return; }
    if (action === 'clear-cookies') { sdel('cookies'); toast('Cookies importadas borradas', 'warn'); renderContent(); return; }
    if (action === 'test-session') { testSession(); return; }
    if (action === 'toggle-autorefresh') {
      state.autoRefresh = !state.autoRefresh;
      sset('autoRefresh', state.autoRefresh);
      renderContent();
      return;
    }
    if (action === 'clear-all') { clearAll(); return; }
  }

  /* ================= eventos ================= */
  function bindEvents() {
    els.root.addEventListener('click', function (event) {
      if (event.target === els.overlay) { closePanel(); return; }
      var button = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!button) return;
      event.preventDefault();
      handleAction(button.getAttribute('data-action'), button);
    });

    els.search.addEventListener('input', function () {
      state.q = els.search.value;
      if (state.view !== 'library') {
        state.view = 'library';
        renderRail();
      }
      renderContent();
    });

    els.content.addEventListener('input', function (event) {
      var el = event.target;
      if (el && el.getAttribute('data-ref') === 'add-text') state.addText = el.value;
    });

    els.content.addEventListener('change', function (event) {
      var el = event.target;
      if (el && el.getAttribute('data-ref') === 'sort') {
        state.sort = el.value;
        sset('sort', state.sort);
        renderContent();
      }
    });

    document.addEventListener('keydown', function (event) {
      var key = event.key || '';
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key.toLowerCase() === 'd') {
        event.preventDefault();
        if (isOpen()) closePanel(); else openPanel();
        return;
      }
      if (key === 'Escape' && isOpen()) { closePanel(); return; }
      if (key === '/' && isOpen() && event.target !== els.search) {
        event.preventDefault();
        els.search.focus();
      }
    });
  }

  /* ================= refresco automático ================= */
  var refreshTimer = null;

  function startLoop() {
    if (refreshTimer) return;
    refreshTimer = setInterval(function () {
      if (!state.autoRefresh || !isOpen() || document.hidden) return;
      var hasActive = state.torrents.some(function (t) { return ACTIVE_STATUSES.indexOf(t.status) !== -1; });
      if (!hasActive) return;
      data.torrents(1, state.limit).then(function (res) {
        state.torrents = res.items;
        if (typeof res.total === 'number') state.total = res.total;
        renderContent();
      }).catch(function () { /* se reintenta en el próximo ciclo */ });
    }, 12000);
  }

  /* ================= arranque ================= */
  function boot() {
    if (document.getElementById('dmm-studio-host')) return;
    mount();
    startLoop();
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Abrir DMM Studio', function () {
        if (isOpen()) closePanel(); else openPanel();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
