// Configuração do servidor de contas (Supabase).
// Deixe os dois campos vazios para jogar só no navegador, sem contas.
// A chave "publishable"/"anon" é pública por natureza: a segurança fica nas regras do banco (supabase/schema.sql).
// Nunca coloque aqui a chave secreta (service_role / sb_secret_...).
window.TERRA_CONFIG = {
  supabaseUrl: 'https://qnsxkzhxavmevyelcgom.supabase.co',
  supabaseAnonKey: 'sb_publishable_LDqbCvXPnUPt89S5t1tTSw_1Ts6PgXM',
};
