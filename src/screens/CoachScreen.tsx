import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { Message, UserProfile, MealLog } from '../types';
import { supabase } from '../lib/supabase';
import { chatWithCoach, estimateMeal, generateWeeklyPlan } from '../lib/ai';
import { format, startOfWeek } from 'date-fns';

interface Props {
  profile: UserProfile;
}

const QUICK_PROMPTS = [
  '🍽️ Log a meal',
  '📋 Generate my weekly plan',
  '⚖️ Log my weight',
  '💬 How am I doing?',
  '🥗 Meal ideas for today',
  '📞 Contact nutrition coach',
];

export default function CoachScreen({ profile }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data);
    setInitialLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    const msg: Omit<Message, 'id'> = {
      user_id: profile.id,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('messages').insert(msg).select().single();
    return data;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      user_id: profile.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    await saveMessage('user', text);

    try {
      let reply = '';

      // Detect intent for special actions
      const lower = text.toLowerCase();

      if (lower.includes('generate') && (lower.includes('plan') || lower.includes('week'))) {
        reply = await handleGeneratePlan();
      } else if (lower.includes('log') && lower.includes('weight')) {
        reply = "Sure! What's your current weight in lbs?";
      } else if (lower.includes('contact') && lower.includes('coach')) {
        reply = handleCoachContact();
      } else {
        // Check if this looks like a meal log
        const mealKeywords = ['ate', 'had', 'eating', 'lunch', 'breakfast', 'dinner', 'snack', 'drank', 'drink'];
        const isMealLog = mealKeywords.some(kw => lower.includes(kw));

        if (isMealLog) {
          const estimate = await estimateMeal(text);
          await logMeal(text, estimate.calories, estimate.protein);
          const clarificationNote = estimate.clarification ? `\n\nQuick question: ${estimate.clarification}` : '';
          reply = `Got it! I logged that as approximately **${estimate.calories} calories** and **${estimate.protein}g protein**.${clarificationNote}\n\nRunning total today is being updated on your home screen.`;
        } else {
          reply = await chatWithCoach(messages, profile, text);
        }

        // Check if response contains a weight number after "log weight" flow
        const weightMatch = text.match(/(\d+\.?\d*)\s*lbs?/i);
        if (weightMatch && messages[messages.length - 1]?.content?.includes("current weight")) {
          await logWeight(parseFloat(weightMatch[1]));
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        user_id: profile.id,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      await saveMessage('assistant', reply);
    } catch (err) {
      Alert.alert('Error', 'Could not reach the coach. Check your connection.');
    }

    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleGeneratePlan = async (): Promise<string> => {
    try {
      const raw = await generateWeeklyPlan(profile);
      const cleaned = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      await supabase.from('weekly_plans').upsert({
        user_id: profile.id,
        week_start: weekStart,
        meal_plan: parsed.meal_plan,
        workout_plan: parsed.workout_plan,
        calorie_target: parsed.calorie_target,
        protein_target: parsed.protein_target,
        created_at: new Date().toISOString(),
      });

      return `✅ Your weekly plan is ready and saved!\n\n${parsed.summary}\n\nHead to the Home tab to see today's meals and workout. I'll be here if you want to swap anything out!`;
    } catch {
      return "I had trouble generating your plan. Could you tell me a bit more about your food preferences or any schedule constraints this week?";
    }
  };

  const logMeal = async (description: string, calories: number, protein: number) => {
    const hour = new Date().getHours();
    let meal_type: MealLog['meal_type'] = 'snack';
    if (hour >= 5 && hour < 11) meal_type = 'breakfast';
    else if (hour >= 11 && hour < 15) meal_type = 'lunch';
    else if (hour >= 17 && hour < 21) meal_type = 'dinner';

    await supabase.from('meal_logs').insert({
      user_id: profile.id,
      description,
      estimated_calories: calories,
      estimated_protein: protein,
      meal_type,
      logged_at: new Date().toISOString(),
    });
  };

  const logWeight = async (weight: number) => {
    await Promise.all([
      supabase.from('weight_entries').insert({
        user_id: profile.id,
        weight_lbs: weight,
        recorded_at: new Date().toISOString(),
      }),
      supabase.from('profiles').update({ weight_lbs: weight, updated_at: new Date().toISOString() }).eq('id', profile.id),
    ]);
  };

  const handleCoachContact = (): string => {
    return `You can reach our nutrition coach directly at:\n\n📧 **coach@youvolution.app**\n\nJust send an email with your name and a brief description of what you'd like help with. Typical response time is 24-48 hours.\n\nNote: This is a wellness coaching service, not medical advice.`;
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMessage("I took a photo of my meal — can you estimate the calories? [Photo meal log]");
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && <View style={styles.avatar}><Text style={styles.avatarText}>Y</Text></View>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
          <Text style={[styles.timestamp, isUser && { color: 'rgba(255,255,255,0.6)' }]}>
            {format(new Date(item.created_at), 'h:mm a')}
          </Text>
        </View>
      </View>
    );
  };

  if (initialLoading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Hi {profile.full_name?.split(' ')[0]}! 👋</Text>
              <Text style={styles.emptySubtitle}>
                I'm your YOUvolution coach. Ask me anything, log your meals, or tap a quick action below.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.typingIndicator}>
              <View style={styles.avatar}><Text style={styles.avatarText}>Y</Text></View>
              <View style={styles.bubbleAssistant}>
                <Text style={styles.bubbleText}>Thinking...</Text>
              </View>
            </View>
          ) : null
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Quick prompts */}
      {messages.length === 0 && (
        <View>
          <FlatList
            horizontal
            data={QUICK_PROMPTS}
            keyExtractor={i => i}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPrompts}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.quickChip} onPress={() => sendMessage(item)}>
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.cameraBtn} onPress={handleImagePick}>
          <Text style={styles.cameraBtnText}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Message your coach..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  messageList: { padding: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  msgRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.xs },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.white, fontSize: FontSizes.sm, fontWeight: '700' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  bubbleText: { fontSize: FontSizes.base, color: Colors.text, lineHeight: 22 },
  bubbleTextUser: { color: Colors.white },
  timestamp: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  typingIndicator: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.sm },
  emptyState: { padding: Spacing.lg, alignItems: 'center' },
  emptyTitle: { fontSize: FontSizes['2xl'], fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSizes.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  quickPrompts: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  quickChip: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  quickChipText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? Spacing.md : Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.xs },
  cameraBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  cameraBtnText: { fontSize: 22 },
  textInput: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: FontSizes.base, color: Colors.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.border },
  sendBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
