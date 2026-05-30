import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { UserProfile, WeightEntry } from '../types';
import { supabase } from '../lib/supabase';
import { format, differenceInDays } from 'date-fns';

interface Props {
  profile: UserProfile;
  onProfileUpdate: () => void;
}

export default function ProgressScreen({ profile, onProfileUpdate }: Props) {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [logWeight, setLogWeight] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeights = async () => {
    const { data } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', profile.id)
      .order('recorded_at', { ascending: false })
      .limit(30);
    if (data) setWeights(data);
  };

  useEffect(() => { fetchWeights(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWeights();
    setRefreshing(false);
  };

  const handleLogWeight = async () => {
    const w = parseFloat(logWeight);
    if (!w || w < 50 || w > 600) return Alert.alert('Please enter a valid weight');
    await Promise.all([
      supabase.from('weight_entries').insert({
        user_id: profile.id,
        weight_lbs: w,
        recorded_at: new Date().toISOString(),
      }),
      supabase.from('profiles').update({ weight_lbs: w, updated_at: new Date().toISOString() }).eq('id', profile.id),
    ]);
    setLogWeight('');
    await fetchWeights();
    onProfileUpdate();
    Alert.alert('Logged!', `${w} lbs recorded.`);
  };

  const currentWeight = weights[0]?.weight_lbs ?? profile.weight_lbs ?? 0;
  const startWeight = weights[weights.length - 1]?.weight_lbs ?? profile.weight_lbs ?? 0;
  const goalWeight = profile.goal_weight_lbs;
  const totalChange = currentWeight - startWeight;
  const daysTracking = weights.length > 1
    ? differenceInDays(new Date(weights[0].recorded_at), new Date(weights[weights.length - 1].recorded_at))
    : 0;
  const toGoal = goalWeight ? currentWeight - goalWeight : null;

  const heightFt = profile.height_inches ? Math.floor(profile.height_inches / 12) : null;
  const heightIn = profile.height_inches ? profile.height_inches % 12 : null;
  const bmi = profile.height_inches && currentWeight
    ? ((currentWeight / (profile.height_inches * profile.height_inches)) * 703).toFixed(1)
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Your Progress</Text>

      {/* Stats cards */}
      <View style={styles.statsGrid}>
        <StatCard label="Current Weight" value={`${currentWeight} lbs`} color={Colors.primary} />
        {goalWeight && <StatCard label="Goal Weight" value={`${goalWeight} lbs`} color={Colors.secondary} />}
        <StatCard
          label="Total Change"
          value={`${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} lbs`}
          color={totalChange <= 0 ? Colors.secondary : Colors.accent}
        />
        {toGoal !== null && (
          <StatCard label="To Goal" value={`${toGoal.toFixed(1)} lbs`} color={Colors.primary} />
        )}
      </View>

      {/* Goal progress bar */}
      {goalWeight && startWeight && startWeight !== goalWeight && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goal Progress</Text>
          <View style={styles.goalBar}>
            <View style={[styles.goalFill, {
              width: `${Math.min(Math.max(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100, 0), 100)}%`
            }]} />
          </View>
          <View style={styles.goalLabels}>
            <Text style={styles.goalLabel}>{startWeight} lbs start</Text>
            <Text style={styles.goalLabel}>{goalWeight} lbs goal</Text>
          </View>
          {daysTracking > 0 && (
            <Text style={styles.paceText}>
              {Math.abs(totalChange / daysTracking * 7).toFixed(1)} lbs/week average
              {' '}· {daysTracking} days tracked
            </Text>
          )}
        </View>
      )}

      {/* Log weight */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log Today's Weight</Text>
        <View style={styles.logRow}>
          <TextInput
            style={styles.weightInput}
            value={logWeight}
            onChangeText={setLogWeight}
            placeholder={`${currentWeight || 180}`}
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
          />
          <Text style={styles.unit}>lbs</Text>
          <TouchableOpacity style={styles.logBtn} onPress={handleLogWeight}>
            <Text style={styles.logBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Profile</Text>
        {heightFt && <ProfileRow label="Height" value={`${heightFt}'${heightIn}"`} />}
        {bmi && <ProfileRow label="BMI" value={bmi} />}
        <ProfileRow label="Age" value={profile.age ? `${profile.age} years` : '—'} />
        <ProfileRow label="Activity Level" value={capitalize(profile.activity_level ?? '—')} />
        <ProfileRow label="Gym Access" value={profile.gym_access ? 'Yes' : 'Home only'} />
        {profile.fitness_goals?.length ? (
          <ProfileRow label="Goals" value={profile.fitness_goals.join(', ')} />
        ) : null}
        {profile.food_preferences?.length ? (
          <ProfileRow label="Likes" value={profile.food_preferences.slice(0, 4).join(', ')} />
        ) : null}
        {profile.injuries?.length ? (
          <ProfileRow label="Limitations" value={profile.injuries.join(', ')} />
        ) : null}
      </View>

      {/* Weight history */}
      {weights.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weight History</Text>
          {weights.slice(0, 10).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{format(new Date(entry.recorded_at), 'MMM d, yyyy')}</Text>
              <Text style={styles.historyWeight}>{entry.weight_lbs} lbs</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingTop: Spacing.lg },
  pageTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  statValue: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  goalBar: { height: 12, backgroundColor: Colors.surfaceVariant, borderRadius: 6, overflow: 'hidden', marginBottom: Spacing.xs },
  goalFill: { height: 12, backgroundColor: Colors.secondary, borderRadius: 6 },
  goalLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { fontSize: FontSizes.xs, color: Colors.textMuted },
  paceText: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: Spacing.sm, fontStyle: 'italic' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weightInput: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: 12, padding: 14, fontSize: FontSizes.lg, color: Colors.text },
  unit: { fontSize: FontSizes.base, color: Colors.textSecondary },
  logBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  logBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.base },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileLabel: { fontSize: FontSizes.sm, color: Colors.textMuted },
  profileValue: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  historyDate: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  historyWeight: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
});
