import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { UserProfile } from '../types';

interface Props {
  userId: string;
  onComplete: (profile: Partial<UserProfile>) => Promise<void>;
}

type Step = {
  id: string;
  question: string;
  subtitle?: string;
  type: 'text' | 'number' | 'choice' | 'multi-choice';
  field: keyof UserProfile | 'height_ft' | 'height_in';
  choices?: { label: string; value: string | boolean }[];
  unit?: string;
  placeholder?: string;
};

const STEPS: Step[] = [
  {
    id: 'name',
    question: "First, what should I call you?",
    type: 'text',
    field: 'full_name',
    placeholder: 'Your first name',
  },
  {
    id: 'age',
    question: "How old are you?",
    subtitle: "This helps me tailor recovery time and workout intensity to what's right for your body.",
    type: 'number',
    field: 'age',
    placeholder: '45',
    unit: 'years old',
  },
  {
    id: 'height',
    question: "How tall are you?",
    type: 'number',
    field: 'height_ft',
    placeholder: '5',
    unit: 'feet',
  },
  {
    id: 'height_in',
    question: "And the inches?",
    type: 'number',
    field: 'height_in',
    placeholder: '9',
    unit: 'inches',
  },
  {
    id: 'weight',
    question: "What's your current weight?",
    subtitle: "Just a starting point — no judgment here.",
    type: 'number',
    field: 'weight_lbs',
    placeholder: '185',
    unit: 'lbs',
  },
  {
    id: 'goal_weight',
    question: "Do you have a goal weight in mind?",
    subtitle: "Skip this if your goal is more about feeling good than a specific number.",
    type: 'number',
    field: 'goal_weight_lbs',
    placeholder: '165',
    unit: 'lbs',
  },
  {
    id: 'goals',
    question: "What are you hoping to achieve?",
    subtitle: "Pick everything that feels right.",
    type: 'multi-choice',
    field: 'fitness_goals',
    choices: [
      { label: '⚖️ Lose weight', value: 'lose weight' },
      { label: '💪 Build muscle', value: 'build muscle' },
      { label: '❤️ Improve heart health', value: 'improve heart health' },
      { label: '🩸 Lower blood sugar', value: 'lower blood sugar' },
      { label: '🏃 Run a 5K or more', value: 'running goal' },
      { label: '🤸 Get more flexible', value: 'flexibility' },
      { label: '😴 Sleep better', value: 'sleep better' },
      { label: '⚡ Have more energy', value: 'more energy' },
    ],
  },
  {
    id: 'activity',
    question: "How active are you right now?",
    subtitle: "Be honest — there's no wrong answer.",
    type: 'choice',
    field: 'activity_level',
    choices: [
      { label: '🛋️ Pretty sedentary (mostly sitting)', value: 'sedentary' },
      { label: '🚶 Light activity (occasional walks)', value: 'light' },
      { label: '🏋️ Moderate (a few workouts/week)', value: 'moderate' },
      { label: '⚡ Pretty active (daily exercise)', value: 'active' },
    ],
  },
  {
    id: 'gym',
    question: "Do you have access to a gym or equipment?",
    type: 'choice',
    field: 'gym_access',
    choices: [
      { label: '🏠 Home only (bodyweight, maybe dumbbells)', value: false },
      { label: '🏋️ Yes, I have a gym or equipment', value: true },
    ],
  },
  {
    id: 'injuries',
    question: "Any injuries or physical limitations I should know about?",
    subtitle: "Helps me avoid exercises that could hurt you.",
    type: 'text',
    field: 'injuries',
    placeholder: 'e.g. bad knees, shoulder pain, lower back... or none',
  },
  {
    id: 'food_prefs',
    question: "What foods do you enjoy eating?",
    subtitle: "I'll build meal plans around what you actually like.",
    type: 'text',
    field: 'food_preferences',
    placeholder: 'e.g. chicken, rice, Greek yogurt, tacos, protein shakes...',
  },
  {
    id: 'food_dislikes',
    question: "Anything you really don't like or can't eat?",
    subtitle: "Allergies, strong dislikes, dietary restrictions.",
    type: 'text',
    field: 'food_dislikes',
    placeholder: 'e.g. fish, shellfish, dairy, spicy food... or nothing',
  },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [inputValue, setInputValue] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const progress = (step / STEPS.length) * 100;

  const handleNext = async () => {
    const newAnswers = { ...answers };

    if (current.type === 'text') {
      if (!inputValue.trim() && current.id !== 'injuries' && current.id !== 'food_dislikes') return;
      if (current.field === 'injuries' || current.field === 'food_preferences' || current.field === 'food_dislikes') {
        newAnswers[current.field as string] = inputValue.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        newAnswers[current.field as string] = inputValue.trim();
      }
    } else if (current.type === 'number') {
      const num = parseFloat(inputValue);
      if (!inputValue && current.id !== 'goal_weight') return;
      if (current.field === 'height_ft') {
        newAnswers['height_ft'] = num || 5;
      } else if (current.field === 'height_in') {
        const ft = newAnswers['height_ft'] || 5;
        newAnswers['height_inches'] = ft * 12 + (num || 0);
        delete newAnswers['height_ft'];
      } else {
        newAnswers[current.field as string] = num || undefined;
      }
    } else if (current.type === 'multi-choice') {
      newAnswers[current.field as string] = multiSelected;
      setMultiSelected([]);
    }

    setAnswers(newAnswers);
    setInputValue('');

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      await onComplete({ ...newAnswers, onboarding_complete: true });
      setSaving(false);
    }
  };

  const handleChoice = async (value: string | boolean) => {
    const newAnswers = { ...answers, [current.field as string]: value };
    setAnswers(newAnswers);
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      setSaving(true);
      await onComplete({ ...newAnswers, onboarding_complete: true });
      setSaving(false);
    }
  };

  const toggleMulti = (value: string) => {
    setMultiSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  if (saving) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.subtitle, { marginTop: Spacing.lg }]}>Building your personal plan...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.stepCount}>{step + 1} of {STEPS.length}</Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>{current.question}</Text>
        {current.subtitle && <Text style={styles.subtitle}>{current.subtitle}</Text>}

        {(current.type === 'text' || current.type === 'number') && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={current.placeholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType={current.type === 'number' ? 'numeric' : 'default'}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
            {current.unit && <Text style={styles.unit}>{current.unit}</Text>}
          </View>
        )}

        {current.type === 'choice' && current.choices?.map((c) => (
          <TouchableOpacity key={String(c.value)} style={styles.choiceBtn} onPress={() => handleChoice(c.value)}>
            <Text style={styles.choiceText}>{c.label}</Text>
          </TouchableOpacity>
        ))}

        {current.type === 'multi-choice' && (
          <>
            {current.choices?.map((c) => (
              <TouchableOpacity
                key={String(c.value)}
                style={[styles.choiceBtn, multiSelected.includes(String(c.value)) && styles.choiceSelected]}
                onPress={() => toggleMulti(String(c.value))}
              >
                <Text style={[styles.choiceText, multiSelected.includes(String(c.value)) && styles.choiceTextSelected]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {(current.type === 'text' || current.type === 'number') && (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {current.id === 'goal_weight' || current.id === 'injuries' || current.id === 'food_dislikes'
                ? 'Skip / Continue →'
                : 'Continue →'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  progressBar: { height: 4, backgroundColor: Colors.border },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  stepCount: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'right', padding: Spacing.md, paddingBottom: 0 },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.sm },
  question: { fontSize: FontSizes['2xl'], fontWeight: '700', color: Colors.text, lineHeight: 34, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSizes.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  unit: { fontSize: FontSizes.base, color: Colors.textSecondary, fontWeight: '500' },
  choiceBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: Spacing.xs,
  },
  choiceSelected: { borderColor: Colors.primary, backgroundColor: '#EEF2FF' },
  choiceText: { fontSize: FontSizes.base, color: Colors.text, fontWeight: '500' },
  choiceTextSelected: { color: Colors.primary },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  nextBtnText: { color: Colors.white, fontSize: FontSizes.base, fontWeight: '700' },
});
