import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { UserProfile, WeeklyPlan, MealLog } from '../types';
import { supabase } from '../lib/supabase';
import { appEvents, PLAN_UPDATED, MEAL_LOGGED } from '../lib/events';
import { format, startOfWeek } from 'date-fns';

interface Props {
  profile: UserProfile;
  onChatPress: () => void;
}

export default function HomeScreen({ profile, onChatPress }: Props) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const today = new Date();
  const dayName = format(today, 'EEEE');
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.full_name?.split(' ')[0] ?? 'there';

  const fetchData = async () => {
    const weekStart = format(startOfWeek(today), 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');

    const [planRes, logsRes] = await Promise.all([
      supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_start', weekStart)
        .single(),
      supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', profile.id)
        .gte('logged_at', `${todayStr}T00:00:00`)
        .order('logged_at', { ascending: false }),
    ]);

    if (planRes.data) setPlan(planRes.data);
    if (logsRes.data) setTodayLogs(logsRes.data);
    setLoadingPlan(false);
  };

  useEffect(() => {
    fetchData();
    const unsubPlan = appEvents.on(PLAN_UPDATED, fetchData);
    const unsubMeal = appEvents.on(MEAL_LOGGED, fetchData);
    return () => { unsubPlan(); unsubMeal(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const todayMeal = plan?.meal_plan?.find(d => d.day === dayName);
  const todayWorkout = plan?.workout_plan?.find(d => d.day === dayName);
  const totalCaloriesToday = todayLogs.reduce((sum, l) => sum + (l.estimated_calories ?? 0), 0);
  const totalProteinToday = todayLogs.reduce((sum, l) => sum + (l.estimated_protein ?? 0), 0);
  const calorieTarget = plan?.calorie_target ?? profile.maintenance_calories ?? 2000;
  const proteinTarget = plan?.protein_target ?? 150;
  const caloriePercent = Math.min((totalCaloriesToday / calorieTarget) * 100, 100);
  const proteinPercent = Math.min((totalProteinToday / proteinTarget) * 100, 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{firstName} 👋</Text>
        </View>
        <Text style={styles.date}>{format(today, 'EEE, MMM d')}</Text>
      </View>

      {/* Quick chat CTA */}
      <TouchableOpacity style={styles.chatCard} onPress={onChatPress}>
        <Text style={styles.chatCardTitle}>Chat with your coach</Text>
        <Text style={styles.chatCardSub}>Log a meal, ask a question, update your plan...</Text>
        <Text style={styles.chatCardArrow}>→</Text>
      </TouchableOpacity>

      {/* Today's Progress */}
      <Text style={styles.sectionTitle}>Today's Progress</Text>
      <View style={styles.card}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Calories</Text>
          <Text style={styles.progressValue}>{totalCaloriesToday} / {calorieTarget}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${caloriePercent}%`, backgroundColor: Colors.primary }]} />
        </View>
        <View style={[styles.progressRow, { marginTop: Spacing.md }]}>
          <Text style={styles.progressLabel}>Protein</Text>
          <Text style={styles.progressValue}>{totalProteinToday}g / {proteinTarget}g</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${proteinPercent}%`, backgroundColor: Colors.secondary }]} />
        </View>
      </View>

      {/* Today's Meal Plan */}
      <Text style={styles.sectionTitle}>Today's Meals</Text>
      {loadingPlan ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
      ) : todayMeal ? (
        <View style={styles.card}>
          <MealRow label="Breakfast" meal={todayMeal.breakfast} />
          <MealRow label="Lunch" meal={todayMeal.lunch} />
          <MealRow label="Dinner" meal={todayMeal.dinner} />
          {todayMeal.snack && <MealRow label="Snack" meal={todayMeal.snack} />}
          <View style={styles.mealMeta}>
            <Text style={styles.mealMetaText}>~{todayMeal.estimated_calories} cal · ~{todayMeal.estimated_protein}g protein</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No plan yet for this week.</Text>
          <TouchableOpacity onPress={onChatPress}>
            <Text style={styles.emptyAction}>Ask your coach to generate one →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Workout */}
      <Text style={styles.sectionTitle}>Today's Workout</Text>
      {todayWorkout ? (
        <View style={[styles.card, todayWorkout.type === 'rest' && styles.restCard]}>
          {todayWorkout.type === 'rest' ? (
            <>
              <Text style={styles.restTitle}>🛌 Rest Day</Text>
              <Text style={styles.restSub}>{todayWorkout.notes ?? 'Your body grows stronger during rest. Enjoy it!'}</Text>
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
                  {ex.sets && <Text style={styles.exerciseMeta}>{ex.sets} sets × {ex.reps}</Text>}
                </View>
              ))}
              {todayWorkout.notes && <Text style={styles.workoutNote}>{todayWorkout.notes}</Text>}
            </>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No workout plan for this week.</Text>
          <TouchableOpacity onPress={onChatPress}>
            <Text style={styles.emptyAction}>Ask your coach to generate one →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logged meals today */}
      {todayLogs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>What you've eaten today</Text>
          <View style={styles.card}>
            {todayLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logDesc}>{log.description}</Text>
                {log.estimated_calories && (
                  <Text style={styles.logCal}>~{log.estimated_calories} cal</Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Talk to a real coach */}
      <Text style={styles.sectionTitle}>Need More Help?</Text>
      <TouchableOpacity
        style={styles.coachCard}
        onPress={() => Linking.openURL('mailto:coach@youvolution.app?subject=Coaching%20Request&body=Hi%2C%20I%27d%20like%20to%20connect%20with%20a%20nutrition%20coach.')}
      >
        <View style={styles.coachCardLeft}>
          <Text style={styles.coachAvatar}>👩‍⚕️</Text>
        </View>
        <View style={styles.coachCardContent}>
          <Text style={styles.coachCardTitle}>Talk to a Real Coach</Text>
          <Text style={styles.coachCardSub}>Connect with a human nutrition coach for personalized guidance beyond AI.</Text>
          <Text style={styles.coachCardCta}>Send a message →</Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MealRow({ label, meal }: { label: string; meal: string }) {
  return (
    <View style={styles.mealRow}>
      <Text style={styles.mealLabel}>{label}</Text>
      <Text style={styles.mealText}>{meal}</Text>
    </View>
  );
}

function workoutEmoji(type: string) {
  switch (type) {
    case 'strength': return '🏋️';
    case 'cardio': return '🏃';
    case 'walk': return '🚶';
    case 'flexibility': return '🤸';
    default: return '💪';
  }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSizes.base, color: Colors.textSecondary },
  name: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.text },
  date: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 6 },
  chatCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  chatCardTitle: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700', marginBottom: 4 },
  chatCardSub: { color: 'rgba(255,255,255,0.8)', fontSize: FontSizes.sm },
  chatCardArrow: { color: Colors.white, fontSize: 20, position: 'absolute', right: Spacing.md, top: '50%' },
  sectionTitle: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  progressValue: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: Colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  mealRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mealLabel: { width: 72, fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  mealText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  mealMeta: { marginTop: Spacing.sm },
  mealMetaText: { fontSize: FontSizes.xs, color: Colors.textMuted },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  emptyAction: { color: Colors.primary, fontWeight: '600' },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  workoutType: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  workoutDuration: { fontSize: FontSizes.sm, color: Colors.textMuted, alignSelf: 'center' },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exerciseName: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  exerciseMeta: { fontSize: FontSizes.sm, color: Colors.textMuted },
  workoutNote: { marginTop: Spacing.sm, fontSize: FontSizes.xs, color: Colors.textMuted, fontStyle: 'italic' },
  restCard: { backgroundColor: '#F0FDF4' },
  restTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.secondary, marginBottom: Spacing.xs },
  restSub: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logDesc: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  logCal: { fontSize: FontSizes.sm, color: Colors.textMuted },
  coachCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: Colors.border, gap: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  coachCardLeft: { justifyContent: 'center' },
  coachAvatar: { fontSize: 40 },
  coachCardContent: { flex: 1 },
  coachCardTitle: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  coachCardSub: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  coachCardCta: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
});
