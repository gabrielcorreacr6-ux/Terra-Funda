/*
 * Terra Funda — contas, salvamento na nuvem e moderação (Supabase).
 * Sem configuração em config.js, o jogo roda só no navegador e este módulo fica desligado.
 * Toda permissão (admin, moderador, banimento) é conferida no servidor pelas regras de supabase/schema.sql.
 */
(() => {
  'use strict';
  const cfg = window.TERRA_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  const sb = enabled ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const T = {
    enabled,
    user: null,
    profile: null,
    get role() { return this.profile ? this.profile.role : 'player'; },
    get isAdmin() { return this.role === 'admin'; },
    get isStaff() { return this.role === 'admin' || this.role === 'moderator'; },
    get banned() {
      const b = this.profile && this.profile.banned_until;
      return !!b && (b === 'infinity' || new Date(b) > new Date());
    },
  };

  async function fetchProfile() {
    if (!T.user) { T.profile = null; return null; }
    T.profileError = '';
    // primeiro pela função do servidor (não depende das permissões da tabela); depois direto na tabela
    let r = await sb.rpc('my_profile');
    let row = !r.error && Array.isArray(r.data) ? r.data[0] : (!r.error && r.data && r.data.id ? r.data : null);
    if (!row) {
      const q = await sb.from('profiles').select('*').eq('id', T.user.id).maybeSingle();
      row = q.data || null;
      if (!row) T.profileError = (q.error && q.error.message) || (r.error && r.error.message) || 'perfil não encontrado';
    }
    T.profile = row;
    return T.profile;
  }

  // Link de "esqueci minha senha": o Supabase volta para o jogo já logado e avisa que é recuperação
  T.recovery = /type=recovery/.test(location.hash + location.search);
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') T.recovery = true; });

  T.init = async function () {
    if (!enabled) return false;
    const { data } = await sb.auth.getSession();
    T.user = data.session ? data.session.user : null;
    if (T.user) await fetchProfile();
    return !!T.user;
  };

  const msg = e => {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta. Use Entrar.';
    if (/duplicate key.*username|profiles_username_key|Database error saving new user/i.test(m)) return 'Esse nome de jogador já está em uso.';
    if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/Esse é o seu código/.test(m)) return 'Esse é o seu próprio código.';
    if (/Jogador não encontrado/.test(m)) return 'Não achei nenhum jogador com esse código.';
    if (/rate limit|security purposes/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
    if (/same.*password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da antiga.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos e depois entre.';
    return m;
  };

  T.signUp = async function (email, password, username) {
    username = (username || '').trim();
    if (!/^[A-Za-z0-9_À-ÿ]{3,20}$/.test(username)) throw new Error('Nome de jogador: 3 a 20 letras, números ou _.');
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw new Error(msg(error));
    T.user = data.user && data.session ? data.user : null;
    if (T.user) await fetchProfile();
    return { needsConfirm: !data.session };
  };

  T.signIn = async function (email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(msg(error));
    T.user = data.user;
    await fetchProfile();
  };

  T.resetPassword = async function (email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(msg(error));
  };
  T.updatePassword = async function (password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(msg(error));
    T.recovery = false;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  T.signOut = async function () {
    if (sb) await sb.auth.signOut();
    T.user = null; T.profile = null;
  };

  // ---- Salvamento ----
  T.loadSave = async function () {
    if (!T.user) return null;
    const { data, error } = await sb.from('saves').select('data, updated_at').eq('user_id', T.user.id).maybeSingle();
    if (error || !data) return null;
    return { data: data.data, updatedAt: Date.parse(data.updated_at) };
  };
  let pending = null, timer = null, inflight = false;
  async function flush() {
    timer = null;
    if (!pending || !T.user || inflight || T.banned) return;
    const body = pending; pending = null; inflight = true;
    try {
      await sb.from('saves').upsert({ user_id: T.user.id, data: body, updated_at: new Date().toISOString() });
    } catch (e) { pending = pending || body; }
    inflight = false;
  }
  // grava na nuvem no máximo a cada 20 s (ou já, quando immediate)
  T.queueSave = function (obj, immediate) {
    if (!T.user) return;
    pending = obj;
    if (immediate) { clearTimeout(timer); flush(); return; }
    if (!timer) timer = setTimeout(flush, 20000);
  };

  // ---- Equipe (o servidor recusa se não tiver permissão) ----
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(msg(error));
    return data;
  };
  T.listPlayers = busca => rpc('staff_list_players', { busca: busca || '' });
  T.ban = (target, dias, motivo) => rpc('staff_ban', { target, dias, motivo: motivo || null });
  T.setRole = (target, novo) => rpc('admin_set_role', { target, novo });
  T.giveCoins = (target, quantidade) => rpc('admin_give_coins', { target, quantidade });
  T.giftSkin = (codigo, skin) => rpc('presentear_skin', { codigo, skin });
  T.bless = (target, arma, nivel, horas) => rpc('admin_bless', { target, arma, nivel, horas });


  // ---- Chat ao vivo (Supabase Realtime). Nada fica guardado: a mensagem só passa por quem está conectado.
  // Canais: "tf-geral" (todos) e "tf-dm-<código>" (caixa de cada jogador, para privadas e de amigos).
  const chat = { onMsg: null, geral: null, caixa: null, ultimo: 0 };
  T.chatReady = false;
  T.chatStart = function (onMsg) {
    if (!enabled || !T.user || !T.profile || chat.geral) return;
    chat.onMsg = onMsg;
    const cfg = { config: { broadcast: { self: false } } };
    chat.geral = sb.channel('tf-geral', cfg).on('broadcast', { event: 'msg' }, ({ payload }) => onMsg(payload)).subscribe(st => { T.chatReady = st === 'SUBSCRIBED'; });
    chat.caixa = sb.channel('tf-dm-' + T.profile.codigo, cfg).on('broadcast', { event: 'msg' }, ({ payload }) => onMsg(payload)).subscribe();
  };
  const meuNome = () => (T.isAdmin ? 'Equipe' : T.profile.username);   // o administrador continua invisível
  function enviar(canal, payload) {
    return new Promise((ok, falha) => {
      if (canal === 'tf-geral' && chat.geral) { chat.geral.send({ type: 'broadcast', event: 'msg', payload }).then(ok, falha); return; }
      const ch = sb.channel(canal);
      const t = setTimeout(() => { sb.removeChannel(ch); falha(new Error('Sem conexão com o chat')); }, 8000);
      ch.subscribe(st => {
        if (st !== 'SUBSCRIBED') return;
        ch.send({ type: 'broadcast', event: 'msg', payload }).then(r => { clearTimeout(t); sb.removeChannel(ch); ok(r); }, e => { clearTimeout(t); sb.removeChannel(ch); falha(e); });
      });
    });
  }
  // tipo: 'todos' | 'privado' | 'amigos'. destinos: códigos TF- (privado) ou lista de amigos
  T.chatSend = async function (tipo, texto, destinos) {
    if (!T.user || !T.profile) throw new Error('Entre na sua conta para usar o chat');
    if (T.banned) throw new Error('Conta suspensa');
    texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!texto) return null;
    const agora = Date.now();
    if (agora - chat.ultimo < 1500) throw new Error('Espere um pouco antes de mandar outra mensagem');
    chat.ultimo = agora;
    const msg = { de: T.profile.codigo, nome: meuNome(), texto, tipo, t: agora, para: tipo === 'privado' ? destinos : undefined };
    if (tipo === 'todos') await enviar('tf-geral', msg);
    else for (const c of destinos) await enviar('tf-dm-' + c, msg);
    return msg;
  };
  T.addFriend = codigo => rpc('adicionar_amigo', { codigo });
  T.removeFriend = alvo => rpc('remover_amigo', { alvo });
  T.friends = () => rpc('meus_amigos', {});

  window.TerraOnline = T;
})();
