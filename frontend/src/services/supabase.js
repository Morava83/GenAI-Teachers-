import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings -> API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// ============================================
// USER / ACCOUNT FUNCTIONS
// ============================================

/**
 * Get user by ID
 */
export const getUser = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Update user settings
 */
export const updateUserSettings = async (userId, settings) => {
  const { data, error } = await supabase
    .from('users')
    .update({ settings })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, profile) => {
  const { data, error } = await supabase
    .from('users')
    .update(profile)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Increment problems generated count
 */
export const incrementProblemsGenerated = async (userId) => {
  const { data, error } = await supabase.rpc('increment_problems_generated', {
    user_id: userId
  });
  
  if (error) throw error;
  return data;
};

// ============================================
// PROBLEMS HISTORY (optional)
// ============================================

/**
 * Save a generated problem
 */
export const saveProblem = async (userId, problem) => {
  const { data, error } = await supabase
    .from('problems')
    .insert({
      user_id: userId,
      topic: problem.topic,
      problem_text: problem.problem,
      hints: problem.hints,
      solution: problem.solution,
      answer: problem.answer,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Get user's problem history
 */
export const getProblemHistory = async (userId, limit = 10) => {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
};
