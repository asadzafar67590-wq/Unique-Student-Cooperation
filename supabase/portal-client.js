/*
 * Browser-side USC Supabase adapter.
 * Load after @supabase/supabase-js and supabase/config.js.
 * The anon/publishable key is public; never put service_role or AI keys here.
 */
(function () {
  'use strict';

  function client() {
    if (!window.USC_SUPABASE_CONFIG || !window.USC_SUPABASE_CONFIG.url || !window.USC_SUPABASE_CONFIG.anonKey) {
      throw new Error('Supabase is not configured. Set USC_SUPABASE_CONFIG in supabase/config.js.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase SDK did not load. Check the Supabase script tag and network connection.');
    }
    if (!window._uscSupabaseClient) {
      window._uscSupabaseClient = window.supabase.createClient(
        window.USC_SUPABASE_CONFIG.url,
        window.USC_SUPABASE_CONFIG.anonKey,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      );
    }
    return window._uscSupabaseClient;
  }

  async function requireUser() {
    const { data, error } = await client().auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Please sign in first.');
    return data.user;
  }

  async function getRole() {
    const user = await requireUser();
    const { data, error } = await client().from('profiles').select('role, display_name').eq('user_id', user.id).single();
    if (error) throw error;
    return { user, role: data.role, displayName: data.display_name };
  }

  async function signIn(email, password) {
    const { data, error } = await client().auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
    if (error) throw error;
    return getRole();
  }

  async function signOut() {
    const { error } = await client().auth.signOut();
    if (error) throw error;
  }

  // RLS restricts students to their own row; admins can list all students.
  async function listStudents() {
    const { error: roleError } = await getRole();
    if (roleError) throw roleError;
    const { data, error } = await client().from('students')
      .select('id,user_id,registration_no,full_name,father_name,program,department,campus,current_semester,session,phone,email')
      .order('full_name');
    if (error) throw error;
    return data;
  }

  async function getMyStudentRecord() {
    const user = await requireUser();
    const { data, error } = await client().from('students')
      .select('id,user_id,registration_no,full_name,father_name,program,department,campus,current_semester,session,phone,email')
      .eq('user_id', user.id).single();
    if (error) throw error;
    return data;
  }

  // Admin-only through database RLS; existing linked student rows may be updated.
  async function updateStudent(id, fields) {
    const allowed = ['registration_no','full_name','father_name','program','department','campus','current_semester','session','phone','email','address','cnic','date_of_birth'];
    const patch = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(fields || {}, key)) patch[key] = fields[key];
    const { data, error } = await client().from('students').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // A server-side admin provisioning function is required to create Auth users.
  // Never create student Auth accounts from browser code with a service-role key.
  async function askAI(messages) {
    const { data, error } = await client().functions.invoke('ai-chat', { body: { messages } });
    if (error) throw error;
    if (!data || typeof data.answer !== 'string') throw new Error(data?.error || 'Assistant response was invalid.');
    return data.answer;
  }

  window.USCBackend = Object.freeze({ client, getRole, signIn, signOut, listStudents, getMyStudentRecord, updateStudent, askAI });
})();
