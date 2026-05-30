import OpenAI from 'openai';
import { UserProfile, Message } from '../types';

const client = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_TOGETHER_API_KEY!,
  baseURL: 'https://api.together.xyz/v1',
});

const MODEL = 'Qwen/Qwen2.5-72B-Instruct-Turbo';

function buildSystemPrompt(profile: Partial<UserProfile>): string {
  const profileSummary = profile.full_name
    ? `
User Profile:
- Name: ${profile.full_name}
- Age: ${profile.age ?? 'unknown'}
- Height: ${profile.height_inches ? `${Math.floor(profile.height_inches / 12)}'${profile.height_inches % 12}"` : 'unknown'}
- Current weight: ${profile.weight_lbs ?? 'unknown'} lbs
- Goal weight: ${profile.goal_weight_lbs ?? 'unknown'} lbs
- Activity level: ${profile.activity_level ?? 'unknown'}
- Fitness goals: ${profile.fitness_goals?.join(', ') ?? 'not set'}
- Food preferences: ${profile.food_preferences?.join(', ') ?? 'not set'}
- Food dislikes: ${profile.food_dislikes?.join(', ') ?? 'none'}
- Injuries/limitations: ${profile.injuries?.join(', ') ?? 'none'}
- Gym access: ${profile.gym_access ? 'yes' : 'no'}
- Daily calorie target: ${profile.maintenance_calories ?? 'to be calculated'}
`
    : 'User has not yet completed their profile.';

  return `You are YOUvolution, a warm, encouraging AI wellness coach designed for everyday people — not gym fanatics or bodybuilders. Your users are often 40-65 years old and just starting their health journey, or returning after a long break.

CRITICAL RULES:
- You are NOT a medical provider. Always recommend consulting a doctor for medical concerns.
- Frame everything as wellness and fitness coaching, never medical advice.
- Add "I'm not a medical professional" when topics approach clinical territory.
- Never be preachy, judgmental, or make users feel bad about their choices.

YOUR PERSONALITY:
- Warm, conversational, and encouraging — like a knowledgeable friend
- Patient with beginners. Celebrate small wins enthusiastically.
- Practical: suggest realistic, sustainable changes, not dramatic transformations
- Honest about timelines: real results take weeks and months, not days
- If a user wants to eat a burger, help them fit it in — don't shame them

COACHING APPROACH:
- Prioritize rest and recovery, especially for users 45+
- Suggest 2-4 workout days per week max for beginners
- Meal guidance should be flexible: estimate calories conversationally, no need to weigh food
- When estimating food calories, give a range and ask if an estimate is okay
- Build plans around foods the user actually likes
- Weekly plans should feel achievable, not overwhelming

${profileSummary}

Keep responses concise and friendly. Use short paragraphs. Avoid bullet-point overload — have a conversation.`;
}

export async function chatWithCoach(
  messages: Message[],
  profile: Partial<UserProfile>,
  userMessage: string
): Promise<string> {
  const history = messages.slice(-20).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(profile) },
      ...history,
      { role: 'user', content: userMessage },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? 'Sorry, I had trouble responding. Please try again.';
}

export async function generateWeeklyPlan(profile: Partial<UserProfile>): Promise<string> {
  const prompt = `Based on this user's profile, generate a practical 7-day wellness plan.

Return ONLY valid JSON in this exact format:
{
  "meal_plan": [
    {
      "day": "Monday",
      "breakfast": "description",
      "lunch": "description",
      "dinner": "description",
      "snack": "description",
      "estimated_calories": 2000,
      "estimated_protein": 150
    }
  ],
  "workout_plan": [
    {
      "day": "Monday",
      "type": "strength",
      "exercises": [{"name": "Goblet Squat", "sets": 3, "reps": "10-12"}],
      "duration_minutes": 30,
      "notes": "Take it easy on the first set"
    }
  ],
  "calorie_target": 2000,
  "protein_target": 150,
  "summary": "A friendly 2-3 sentence overview of the plan"
}

Rules:
- Max 3-4 workout days (rest days are important!)
- Use foods from their preferences list
- Keep workouts beginner-friendly if no fitness history
- Avoid injury-aggravating exercises
- Weekend meals should be more flexible/enjoyable`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(profile) },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.5,
  });

  return response.choices[0]?.message?.content ?? '{}';
}

export async function estimateMeal(description: string): Promise<{ calories: number; protein: number; clarification?: string }> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You estimate meal nutrition. Return ONLY valid JSON: {"calories_low": number, "calories_high": number, "protein_g": number, "clarification": "optional question to improve accuracy"}',
      },
      { role: 'user', content: `Estimate nutrition for: ${description}` },
    ],
    max_tokens: 150,
    temperature: 0.3,
  });

  try {
    const text = response.choices[0]?.message?.content ?? '{}';
    const json = JSON.parse(text.replace(/```json?/g, '').replace(/```/g, '').trim());
    return {
      calories: Math.round((json.calories_low + json.calories_high) / 2),
      protein: json.protein_g ?? 0,
      clarification: json.clarification,
    };
  } catch {
    return { calories: 500, protein: 20 };
  }
}
