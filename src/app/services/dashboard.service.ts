import { Injectable } from '@angular/core';
import { WorkoutPlan, Exercice, DayTypeMuscleGroup, PlanType, DayType } from '../models/models'
import { SupabaseService } from './supabase_service'
import { CacheService, TTL_1H, TTL_7D } from './cache.service'

// Ključevi keša (vidi CacheService). Šifarnici su globalni — isti za sve;
// liste planova su LIČNE (šta je „moje" zavisi od toga ko gleda), pa userId
// mora u ključ: telefon dijele dva korisnika.
const CACHE_PLAN_TYPES = 'dashboard.planTypes.global';
const CACHE_DAY_TYPES = 'dashboard.dayTypes.global';
const cacheMyPlans = (userId: string) => `dashboard.myPlans.${userId}`;
const cacheOtherPlans = (userId: string) => `dashboard.otherPlans.${userId}`;

/**
 * Domen keša RAZRIJEŠENOG aktivnog plana (puni ga `TrainingService.
 * getPlanForUser`). Izvezen odavde jer ga i ovaj servis mora obarati:
 * izmjena/brisanje plana mijenja i ono što se za korisnika razriješi.
 */
export const CACHE_ACTIVE_PLAN = 'training.activePlan';
export const cacheActivePlan = (userId: string) => `${CACHE_ACTIVE_PLAN}.${userId}`;

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(private supabase: SupabaseService, private cache: CacheService) {}

  // --- Keš za prvi kadar dashboarda ------------------------------------------
  // Sinhroni `peek`-ovi: komponenta crta odmah iz njih, pa ISTE metode ispod
  // svejedno odu na server i tiho zamijene prikaz (stale-while-revalidate).

  peekMyPlans(userId: string): any[] | null {
    return this.cache.peek<any[]>(cacheMyPlans(userId), TTL_1H);
  }

  peekOtherPlans(userId: string): any[] | null {
    return this.cache.peek<any[]>(cacheOtherPlans(userId), TTL_1H);
  }

  peekPlanTypes(): PlanType[] | null {
    return this.cache.peek<PlanType[]>(CACHE_PLAN_TYPES, TTL_7D);
  }

  peekDayTypes(): DayType[] | null {
    return this.cache.peek<DayType[]>(CACHE_DAY_TYPES, TTL_7D);
  }

  /** Sve što je izvedeno iz planova — pri svakoj izmjeni/brisanju plana. */
  private invalidatePlans(): void {
    this.cache.clear('dashboard.myPlans');
    this.cache.clear('dashboard.otherPlans');
    this.cache.clear(CACHE_ACTIVE_PLAN);
  }

  // Svi planovi - i tvoji i od drugih korisnika
  async getAllPlans(): Promise<WorkoutPlan[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as WorkoutPlan[];
  }

  // Samo planovi koje je trenutni korisnik kreirao
  async getMyPlans(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.cache.put(cacheMyPlans(userId), data);
    return data;
  }

  async getOtherPlans(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .neq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.cache.put(cacheOtherPlans(userId), data);
    return data;
  }

  // Svi planovi, sa imenom kreatora ugnježdeno (JOIN sa profiles)
  async getAllPlansWithCreator() {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async postPlan(plan: {
    name: string;
    description?: string;
    plan_type_id?: string;
    created_by: string;
  }): Promise<WorkoutPlan> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .insert(plan)
      .select()
      .single();

    if (error) throw error;
    return data as WorkoutPlan;
  }

  // NOVO: izmena plana
  async updatePlan(
    planId: string,
    changes: Partial<Pick<WorkoutPlan, 'name' | 'description' | 'plan_type_id'>>
  ): Promise<WorkoutPlan> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .update(changes)
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    return data as WorkoutPlan;
  }

  // NOVO: brisanje plana
  async deletePlan(planId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_plan')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    // Keširane liste i razriješeni aktivni plan više ne odgovaraju bazi.
    this.invalidatePlans();
  }

  async getPlanTypes(): Promise<PlanType[]> {
    const { data, error } = await this.supabase.client
      .from('plan_type')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    this.cache.put(CACHE_PLAN_TYPES, data);
    return data as PlanType[];
  }

  // Sve vježbe iz kataloga
  async getAllExercices(): Promise<Exercice[]> {
    const { data, error } = await this.supabase.client
      .from('exercices')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Exercice[];
  }

  async getDayTypes(): Promise<DayType[]> {
    const { data, error } = await this.supabase.client
      .from('day_type')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    this.cache.put(CACHE_DAY_TYPES, data);
    return data as DayType[];
  }

  // Vraća vježbe filtrirane po day_type preko muscle_group mapiranja
  async getExercicesForDayType(dayTypeId: string): Promise<Exercice[]> {
  // 1. Nađi sve muscle_group_id mapirane na ovaj day_type
  const { data: mappings, error: mapError } = await this.supabase.client
    .from('day_type_muscle_group')
    .select('muscle_group_id')
    .eq('day_type_id', dayTypeId);

  if (mapError) throw mapError;
  if (!mappings || mappings.length === 0) return [];

  const muscleGroupIds = mappings.map(m => m.muscle_group_id);

  // 2. Nađi sve exercice_id povezane sa tim muscle_group_id
  const { data: exerciceMappings, error: emError } = await this.supabase.client
    .from('exercice_muscle')
    .select('exercice_id')
    .in('muscle_group_id', muscleGroupIds);

  if (emError) throw emError;
  if (!exerciceMappings || exerciceMappings.length === 0) return [];

  const exerciceIds = [...new Set(exerciceMappings.map(e => e.exercice_id))];

  // 3. Vrati pune podatke o vježbama
  const { data: exercices, error: exError } = await this.supabase.client
    .from('exercices')
    .select('*')
    .in('id', exerciceIds)
    .order('name', { ascending: true });

  if (exError) throw exError;
  return exercices as Exercice[];
}

// Kreira ceo plan sa danima i vježbama u jednom pozivu
async createFullPlan(
  plan: { name: string; description: string; plan_type_id: string; created_by: string },
  days: {
    dayNumber: number;
    dayName: string;
    dayTypeId: string | null; // null = rest day
    exercices: { exerciceId: string; targetSets: number | null; targetReps: number | null; orderNum: number }[];
  }[]
): Promise<WorkoutPlan> {

  const { data: newPlan, error: planError } = await this.supabase.client
    .from('workout_plan')
    .insert({
      name: plan.name,
      description: plan.description,
      plan_type_id: plan.plan_type_id,
      created_by: plan.created_by
    })
    .select()
    .single();

  if (planError) throw planError;

  await this.insertDays(newPlan.id, days);

  // Nov plan mijenja liste, a možda i razriješeni aktivni plan (prvi svoj).
  this.invalidatePlans();

  return newPlan as WorkoutPlan;
}

/**
 * Izmjena postojećeg plana — osnovni podaci se ažuriraju, a raspored po danima
 * se u potpunosti zamjenjuje novim (jednostavnije i pouzdanije od diff-ovanja).
 *
 * PRVO UPIŠI NOVO, PA OBRIŠI STARO
 *
 * Ranije je redoslijed bio obrnut: obriši `day_exercice`, obriši `workout_days`,
 * pa upiši nove dane jedan po jedan — do 14 serijskih odlazaka na server. Ako bi
 * veza pukla na pola (a puca: teretana, podrum, tunel), plan bi ostao BEZ IJEDNOG
 * DANA, i to nepovratno — stari raspored je već bio obrisan, novi nije stigao.
 * Tako se tiho gubio cio plan.
 *
 * Sada se prvo upisuju NOVI redovi (stari se ne diraju), pa se tek pošto su svi
 * prošli brišu stari — po id-jevima pokupljenim PRIJE upisa. Prekid na pola
 * ostavlja plan sa starim danima, dakle ispravan; nedovršeni novi dani se čiste
 * u `insertDays`. Šema ovo dozvoljava: `workout_days` nema unique ograničenje na
 * `(plan_id, day_number)` (vidi 20260725000000_initial_schema.sql), pa dva
 * kompleta dana mogu nakratko stajati jedan pored drugog.
 *
 * Cijena je kratak prozor (dio sekunde) u kojem bi neko ko baš tada otvori plan
 * vidio dane duplirane. To je neuporedivo jeftinije od trajno praznog plana.
 *
 * Brisanje starih dana ionako ne dira istoriju: `workout_sessions.workout_day_id`
 * je `on delete set null`, sesija ostaje sa svojim snimkom naziva i tipa dana.
 */
async updateFullPlan(
  planId: string,
  plan: { name: string; description: string; plan_type_id: string },
  days: {
    dayNumber: number;
    dayName: string;
    dayTypeId: string | null;
    exercices: { exerciceId: string; targetSets: number | null; targetReps: number | null; orderNum: number }[];
  }[]
): Promise<void> {
  const { error: planError } = await this.supabase.client
    .from('workout_plan')
    .update({
      name: plan.name,
      description: plan.description,
      plan_type_id: plan.plan_type_id
    })
    .eq('id', planId);

  if (planError) throw planError;

  // Id-jevi STARIH dana se pamte prije upisa novih — poslije se više ne bi
  // mogli razlikovati od novih, jer oba kompleta vise o istom planu.
  const { data: existingDays, error: fetchDaysError } = await this.supabase.client
    .from('workout_days')
    .select('id')
    .eq('plan_id', planId);

  if (fetchDaysError) throw fetchDaysError;

  const oldDayIds = (existingDays ?? []).map(d => d.id);

  // 1) Novi raspored ide u bazu prvi. Ako ovdje pukne, plan i dalje ima stari.
  await this.insertDays(planId, days);

  // 2) Tek sada, kad je novo sigurno upisano, stari dani odlaze.
  if (oldDayIds.length > 0) {
    const { error: deleteExError } = await this.supabase.client
      .from('day_exercice')
      .delete()
      .in('workout_day_id', oldDayIds);

    if (deleteExError) throw deleteExError;

    // PO ID-JEVIMA, ne po plan_id — inače bi ovo odnijelo i dane koje smo
    // upravo upisali.
    const { error: deleteDaysError } = await this.supabase.client
      .from('workout_days')
      .delete()
      .in('id', oldDayIds);

    if (deleteDaysError) throw deleteDaysError;
  }

  // Izmijenjen raspored: keširani plan bi na prvom kadru pokazivao stare dane.
  this.invalidatePlans();
}

/**
 * Upisuje dane plana i vraća id-jeve napravljenih redova.
 *
 * Dani su međusobno nezavisni, pa idu UPOREDO — serijska petlja je značila do
 * 14 odlazaka na server u nizu (dan, pa njegove vježbe, pa sljedeći dan...),
 * što se na mobilnoj vezi mjerilo sekundama. Vježbe jednog dana su i dalje
 * jedan skupni insert.
 *
 * Ako ijedan dan padne, ovaj poziv za sobom POČISTI ono što je stigao da upiše
 * i baci grešku — pola upisanog rasporeda je gore od nijednog, jer bi se
 * pomiješalo sa starim danima koje pozivalac tek treba da obriše.
 */
private async insertDays(
  planId: string,
  days: {
    dayNumber: number;
    dayName: string;
    dayTypeId: string | null;
    exercices: { exerciceId: string; targetSets: number | null; targetReps: number | null; orderNum: number }[];
  }[]
): Promise<string[]> {
  const results = await Promise.allSettled(days.map(day => this.insertDay(planId, day)));

  const created = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;

  if (failed) {
    await this.deleteDaysById(created);
    throw failed.reason;
  }

  return created;
}

/** Jedan dan sa svojim vježbama. Vraća id novog reda u `workout_days`. */
private async insertDay(
  planId: string,
  day: {
    dayNumber: number;
    dayName: string;
    dayTypeId: string | null;
    exercices: { exerciceId: string; targetSets: number | null; targetReps: number | null; orderNum: number }[];
  }
): Promise<string> {
  const { data: newDay, error: dayError } = await this.supabase.client
    .from('workout_days')
    .insert({
      plan_id: planId,
      name: day.dayName,
      day_number: day.dayNumber,
      day_type: day.dayTypeId
    })
    .select()
    .single();

  if (dayError) throw dayError;

  if (day.exercices.length === 0) return newDay.id as string;

  const exerciceRows = day.exercices.map(ex => ({
    workout_day_id: newDay.id,
    exercice_id: ex.exerciceId,
    order_num: ex.orderNum,
    target_sets: ex.targetSets,
    target_reps: ex.targetReps
  }));

  const { error: dayExError } = await this.supabase.client
    .from('day_exercice')
    .insert(exerciceRows);

  if (dayExError) {
    // Dan bez svojih vježbi ne smije ostati za sobom — briše se odmah, pa
    // gore ostane samo greška.
    await this.deleteDaysById([newDay.id as string]);
    throw dayExError;
  }

  return newDay.id as string;
}

/** Čišćenje nedovršenog upisa. Tiho na grešci — greška upisa je važnija. */
private async deleteDaysById(dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) return;

  try {
    // `day_exercice` ima FK na `workout_days` sa `on delete cascade`, pa se
    // vježbe tih dana brišu same.
    await this.supabase.client
      .from('workout_days')
      .delete()
      .in('id', dayIds);
  } catch {
    // Nema šta dalje da se radi — plan je i dalje ispravan sa starim danima.
  }
}

// Da li je korisnik već pridružen tuđem planu
async isFollowingPlan(planId: string, userId: string): Promise<boolean> {
  const { data, error } = await this.supabase.client
    .from('plan_members')
    .select('id')
    .eq('plan_id', planId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async followPlan(planId: string, userId: string): Promise<void> {
  const { error } = await this.supabase.client
    .from('plan_members')
    .insert({ plan_id: planId, profile_id: userId });

  if (error) throw error;

  // Praćeni plan ima prioritet pri razrješavanju — keširani „aktivni" je pao.
  this.cache.clear(cacheActivePlan(userId));
}

async unfollowPlan(planId: string, userId: string): Promise<void> {
  const { error } = await this.supabase.client
    .from('plan_members')
    .delete()
    .eq('plan_id', planId)
    .eq('profile_id', userId);

  if (error) throw error;

  this.cache.clear(cacheActivePlan(userId));
}

// Plan_id koji korisnik trenutno prati (max jedan zbog unique constraint-a na profile_id)
async getFollowedPlanId(userId: string): Promise<string | null> {
  const { data, error } = await this.supabase.client
    .from('plan_members')
    .select('plan_id')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.plan_id ?? null;
}

// Aktivira jedan od sopstvenih planova - deaktivira sve ostale kreatorove planove
async activatePlan(planId: string, userId: string): Promise<void> {
  const { error: deactivateError } = await this.supabase.client
    .from('workout_plan')
    .update({ active: false })
    .eq('created_by', userId);

  if (deactivateError) throw deactivateError;

  const { error: activateError } = await this.supabase.client
    .from('workout_plan')
    .update({ active: true })
    .eq('id', planId);

  if (activateError) throw activateError;

  // Drugi plan je sada aktivan — razriješeni keš tog korisnika ne važi.
  this.cache.clear(cacheActivePlan(userId));
}

async deactivatePlan(planId: string): Promise<void> {
  const { error } = await this.supabase.client
    .from('workout_plan')
    .update({ active: false })
    .eq('id', planId);

  if (error) throw error;

  // Ovdje se ne zna čiji je plan — obara se cio domen (bezbjedno preširoko).
  this.cache.clear(CACHE_ACTIVE_PLAN);
}

async getFullPlan(planId: string) {
  const { data, error } = await this.supabase.client
    .from('workout_plan')
    .select(`
      *,
      profiles:created_by ( username, profile_pic_url ),
      plan_type:plan_type_id ( name ),
      workout_days (
        *,
        day_type:day_type ( name ),
        day_exercice (
          *,
          exercices ( name, picture, description )
        )
      )
    `)
    .eq('id', planId)
    .single();

  if (error) throw error;
  return data;
}

}
