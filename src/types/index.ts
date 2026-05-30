export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  age?: number;
  height_inches?: number;
  weight_lbs?: number;
  goal_weight_lbs?: number;
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
  fitness_goals?: string[];
  food_preferences?: string[];
  food_dislikes?: string[];
  injuries?: string[];
  gym_access?: boolean;
  maintenance_calories?: number;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string;
  meal_plan: MealDay[];
  workout_plan: WorkoutDay[];
  calorie_target: number;
  protein_target: number;
  created_at: string;
}

export interface MealDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack?: string;
  estimated_calories: number;
  estimated_protein: number;
}

export interface WorkoutDay {
  day: string;
  type: 'strength' | 'cardio' | 'rest' | 'walk' | 'flexibility';
  exercises?: Exercise[];
  duration_minutes?: number;
  notes?: string;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  notes?: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  weight_lbs: number;
  recorded_at: string;
  notes?: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  description: string;
  estimated_calories?: number;
  estimated_protein?: number;
  logged_at: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}
