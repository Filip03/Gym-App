export interface Profile {
  id: string;
  created_at: string;
  username: string;
  height: number | null;
  weight: number | null;
  profile_pic_url: string | null;
}

export interface PlanType {
  id: string;
  name: string;
}

export interface WorkoutPlan {
  id: string;
  created_at: string;
  created_by: string | null;
  name: string | null;
  description: string | null;
  plan_type_id: string | null;
}

export interface PlanMember {
  id: string;
  plan_id: string;
  profile_id: string | null;
  joined_at: string | null;
}

export interface WorkoutDay {
  id: string;
  name: string | null;
  plan_id: string | null;
  day_number: number | null;
  day_type: string | null;
}

export interface Exercice {
  id: string;
  name: string | null;
  picture: string | null;
  description: string | null;
}

export interface ExerciceMuscle {
    id: string;
    exercice_id: string;
    muscle_group_id: string
}

export interface DayExercice {
  id: string;
  workout_day_id: string | null;
  exercice_id: string | null;
  order_num: number | null;
  target_sets: number | null;
  target_reps: number | null;
}

export interface ExerciceLog {
  id: string;
  user_id: string;
  exercice_id: string;
  plan_id: string;
  date: string;
  set_number: number;
  reps: number;
  weight: number;
}

export interface MuscleGroup {
  id: string;
  name: string | null;
}

export interface DayType {
    id: string;
    name: string | null;
}

export interface DayTypeMuscleGroup{
  id: string;
  day_type_id: string;
  muscle_group_id: string
}