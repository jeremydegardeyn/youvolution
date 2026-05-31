import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { UserProfile, WeeklyPlan } from '../types';
import { supabase } from '../lib/supabase';
import { format, startOfWeek, addDays } from 'date-fns';
import { appEvents, PLAN_UPDATED } from '../lib/events';

interface Props {
  profile: UserProfile;
  onChatPress: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklyPlanScreen({ profile, onChatPress }: Props) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'EEEE'));
  const [tab, setTab] = useState<'meals' | 'workouts'>('meals');

  const fetchPlan = useCallback(async () => {
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', profile.id)
      .eq('week_start', weekStart)
      .single();
    if (data) setPlan(data);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    fetchPlan();
    const unsub = appEvents.on(PLAN_UPDATED, fetchPlan);
    return () => unsub();
  }, [fetchPlan]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPlan();
    setRefreshing(false);
  };

  const todayMeal = plan?.meal_plan?.find(d => d.day === selectedDay);
  const todayWorkout = plan?.workout_plan?.find(d => d.day === selectedDay);

  const weekStart = startOfWeek(new Date());

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (!plan) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <Text style={styles.emptyTitle}>No plan for this week yet</Text>
        <Text style={styles.emptySubtitle}>Ask your coach to generate one!</Text>
        <TouchableOpacity style={styles.generateBtn} onPress={onChatPress}>
          <Text style={styles.generateBtnText}>Go to Coach →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Week header */}
      <View style={styles.weekHeader}>
        <Text style={styles.weekLabel}>Week of {format(weekStart, 'MMM d')}</Text>
        <View style={styles.targets}>
          <Text style={styles.targetChip}>{plan.calorie_target} cal/day</Text>
          <Text style={styles.targetChip}>{plan.protein_target}g protein</Text>
        </View>
      </View>

      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayRow}>
        {DAYS.map((day, i) => {
          const date = addDays(weekStart, i + 1);
          const isToday = format(new Date(), 'EEEE') === day;
          const isSelected = selectedDay === day;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, isSelected && styles.dayChipSelected, isToday && !isSelected && styles.dayChipToday]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayChipShort, isSelected && styles.dayChipTextSelected]}>{day.slice(0, 3)}</Text>
              <Text style={[styles.dayChipNum, isSelected && styles.dayChipTextSelected]}>{format(date, 'd')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Meals / Workouts tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'meals' && styles.tabBtnActive]} onPress={() => setTab('meals')}>
          <Text style={[styles.tabBtnText, tab === 'meals' && styles.tabBtnTextActive]}>🍽️ Meals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'workouts' && styles.tabBtnActive]} onPress={() => setTab('workouts')}>
          <Text style={[styles.tabBtnText, tab === 'workouts' && styles.tabBtnTextActive]}>🏋️ Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Meal detail */}
      {tab === 'meals' && (
        <View style={styles.card}>
          {todayMeal ? (
            <>
              <MealRow emoji="☀️" label="Breakfast" meal={todayMeal.breakfast} />
              <MealRow emoji="🌤️" label="Lunch" meal={todayMeal.lunch} />
              <MealRow emoji="🌙" label="Dinner" meal={todayMeal.dinner} />
              {todayMeal.snack && <MealRow emoji="🍎" label="Snack" meal={todayMeal.snack} />}
              <View style={styles.mealTotals}>
                <Text style={styles.mealTotalsText}>~{todayMeal.estimated_calories} cal · ~{todayMeal.estimated_protein}g protein</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyDay}>No meals planned for {selectedDay}</Text>
          )}
        </View>
      )}

      {/* Workout detail */}
      {tab === 'workouts' && (
        <View style={styles.card}>
          {todayWorkout ? (
            todayWorkout.type === 'rest' ? (
              <>
                <Text style={styles.restTitle}>🛌 Rest Day</Text>
                <Text style={styles.restSub}>{todayWorkout.notes ?? 'Recovery is where the magic happens. Take it easy today!'}</Text>
              </>
            ) : (
              <>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutType}>{workoutEmoji(todayWorkout.type)} {capitalize(todayWorkout.type)}</Text>
                  {todayWorkout.duration_minutes && (
                    <Text style={styles.workoutDuration}>{todayWorkout.duration_minutes} min</Text>
                  )}
                </View>
                {todayWorkout.exercises?.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    {ex.sets && <Text style={styles.exerciseMeta}>{ex.sets} × {ex.reps}</Text>}
                  </View>
                ))}
                {todayWorkout.notes && <Text style={styles.workoutNote}>{todayWorkout.notes}</Text>}
              </>
            )
          ) : (
            <Text style={styles.emptyDay}>No workout planned for {selectedDay}</Text>
          )}
        </View>
      )}

      {/* Full week overview */}
      <Text style={styles.sectionTitle}>Week at a Glance</Text>
      <View style={styles.card}>
        {DAYS.map(day => {
          const meal = plan.meal_plan?.find(d => d.day === day);
          const workout = plan.workout_plan?.find(d => d.day === day);
          const isToday = format(new Date(), 'EEEE') === day;
          return (
            <TouchableOpacity key={day} style={[styles.glanceRow, isToday && styles.glanceRowToday]} onPress={() => setSelectedDay(day)}>
              <Text style={[styles.glanceDay, isToday && { color: Colors.primary, fontWeight: '700' }]}>{day.slice(0, 3)}</Text>
              <Text style={styles.glanceMeal} numberOfLines={1}>{meal?.dinner ?? '—'}</Text>
              <Text style={styles.glanceWorkout}>{workout ? workoutEmoji(workout.type) : '—'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MealRow({ emoji, label, meal }: { emoji: string; label: string; meal: string }) {
  return (
    <View style={styles.mealRow}>
      <Text style={styles.mealEmoji}>{emoji}</Text>
      <View style={styles.mealContent}>
        <Text style={styles.mealLabel}>{label}</Text>
        <Text style={styles.mealText}>{meal}</Text>
      </View>
    </View>
  );
}

function workoutEmoji(type: string) {
  switch (type) {
    case 'strength': return '🏋️';
    case 'cardio': return '🏃';
    case 'walk': return '🚶';
    case 'flexibility': return '🤸';
    case 'rest': return '🛌';
    default: return '💪';
  }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingTop: Spacing.md },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  weekLabel: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  targets: { flexDirection: 'row', gap: Spacing.xs },
  targetChip: { backgroundColor: Colors.primaryLight, color: Colors.white, fontSize: FontSizes.xs, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  dayScroll: { marginBottom: Spacing.md },
  dayRow: { gap: Spacing.xs, paddingHorizontal: 2 },
  dayChip: { width: 44, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  dayChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipToday: { borderColor: Colors.primary },
  dayChipShort: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600' },
  dayChipNum: { fontSize: FontSizes.base, color: Colors.text, fontWeight: '700' },
  dayChipTextSelected: { color: Colors.white },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.white },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  mealRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mealEmoji: { fontSize: 20, width: 28 },
  mealContent: { flex: 1 },
  mealLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealText: { fontSize: FontSizes.base, color: Colors.text, marginTop: 2 },
  mealTotals: { marginTop: Spacing.sm },
  mealTotalsText: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'right' },
  emptyDay: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  workoutType: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  workoutDuration: { fontSize: FontSizes.sm, color: Colors.textMuted, alignSelf: 'center' },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exerciseName: { fontSize: FontSizes.base, color: Colors.text, fontWeight: '500' },
  exerciseMeta: { fontSize: FontSizes.sm, color: Colors.textMuted },
  workoutNote: { marginTop: Spacing.sm, fontSize: FontSizes.xs, color: Colors.textMuted, fontStyle: 'italic' },
  restTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.secondary, marginBottom: Spacing.xs },
  restSub: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  glanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  glanceRowToday: { backgroundColor: '#EEF2FF', marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  glanceDay: { width: 36, fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
  glanceMeal: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  glanceWorkout: { fontSize: 18, width: 28, textAlign: 'center' },
  emptyTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSizes.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  generateBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: Spacing.xl },
  generateBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.base },
});
