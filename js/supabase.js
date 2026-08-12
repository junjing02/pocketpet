// Fill these in after creating a project at https://supabase.com/dashboard
const SUPABASE_URL = "https://zxcpcjoyxcwhvumxgmau.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z2ifKiCIYWIrjb853GKxig_CX0xOCmZ";

export const isConfigured = SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

// window.supabase is the library namespace injected by the CDN <script> tag in index.html
// (must load before this module). We shadow it here with the actual client instance.
export const client = isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function requireClient() {
  if (!client) throw new Error("Supabase not configured yet. Fill in SUPABASE_URL/SUPABASE_ANON_KEY in supabase.js");
  return client;
}

export async function signUp(email, password) {
  const { data, error } = await requireClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  requireClient().auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function resetPasswordForEmail(email) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await requireClient().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function fetchPets(userId) {
  const { data, error } = await requireClient()
    .from("pets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// Clears is_active on the user's other pets before inserting so a new pet
// (whether it's the first or an additional one) is always the sole active row.
export async function createPet(userId, name, species) {
  const client = requireClient();
  const { error: clearError } = await client.from("pets").update({ is_active: false }).eq("user_id", userId);
  if (clearError) throw clearError;

  const { data, error } = await client
    .from("pets")
    .insert({ user_id: userId, name, species, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePet(petId) {
  const { error } = await requireClient().from("pets").delete().eq("id", petId);
  if (error) throw error;
}

export async function setActivePet(userId, petId) {
  const client = requireClient();
  const { error: clearError } = await client.from("pets").update({ is_active: false }).eq("user_id", userId);
  if (clearError) throw clearError;

  const { data, error } = await client
    .from("pets")
    .update({ is_active: true })
    .eq("id", petId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function savePet(pet) {
  const { data, error } = await requireClient()
    .from("pets")
    .update({
      name: pet.name,
      species: pet.species,
      life_stage: pet.life_stage,
      hunger: pet.hunger,
      happiness: pet.happiness,
      energy: pet.energy,
      health: pet.health,
      hygiene: pet.hygiene,
      is_sick: pet.is_sick,
      is_sleeping: pet.is_sleeping,
      coins: pet.coins,
      food_count: pet.food_count,
      meal_count: pet.meal_count,
      total_coins_earned: pet.total_coins_earned,
      ever_sick: pet.ever_sick,
      neglect_incidents: pet.neglect_incidents,
      last_login_date: pet.last_login_date,
      login_streak: pet.login_streak,
      has_bow: pet.has_bow,
      bow_worn: pet.bow_worn,
      bow_color: pet.bow_color,
      has_scarf: pet.has_scarf,
      scarf_worn: pet.scarf_worn,
      scarf_color: pet.scarf_color,
      has_bed: pet.has_bed,
      bed_x: pet.bed_x,
      bed_y: pet.bed_y,
      birth_timestamp: pet.birth_timestamp,
      last_updated: pet.last_updated,
    })
    .eq("id", pet.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
