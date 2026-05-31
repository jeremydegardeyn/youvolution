import { UserProfile, Message } from '../types';

const TOGETHER_API_KEY = process.env.EXPO_PUBLIC_TOGETHER_API_KEY;
const MODEL = 'Qwen/Qwen2.5-7B-Instruct-Turbo';
const VISION_MODEL = 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo';
const BASE_URL = 'https://api.together.xyz/v1/chat/completions';

async function togetherChat(messages: { role: string; content: string }[], maxTokens = 800, temperature = 0.7): Promise<string> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Together API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'Sorry, I had trouble responding. Please try again.';
}

export function calculateTDEE(profile: Partial<UserProfile>): number {
  const { weight_lbs, height_inches, age, activity_level } = profile;
  if (!weight_lbs || !height_inches || !age) return 2000;

  // Mifflin-St Jeor (assuming male for now — we can add sex field later)
  const weightKg = weight_lbs * 0.453592;
  const heightCm = height_inches * 2.54;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const tdee = Math.round(bmr * (multipliers[activity_level ?? 'sedentary'] ?? 1.2));

  // If goal is weight loss, subtract 300-500 cal
  const isWeightLoss = profile.fitness_goals?.some(g => g.includes('lose weight'));
  return isWeightLoss ? tdee - 400 : tdee;
}

function buildSystemPrompt(profile: Partial<UserProfile>): string {
  const profileSummary = profile.full_name
    ? `
About the person you are coaching (always address them as "you", never by name or in third person):
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
    : 'The user has not yet completed their profile.';

  return `You are YOUvolution, a warm, encouraging AI wellness coach designed for everyday people — not gym fanatics or bodybuilders. Your users are often 40-65 years old and just starting their health journey, or returning after a long break.

CRITICAL RULES:
- You are NOT a medical provider. Always recommend consulting a doctor for medical concerns.
- Frame everything as wellness and fitness coaching, never medical advice.
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
    role: m.role,
    content: m.content,
  }));

  return togetherChat([
    { role: 'system', content: buildSystemPrompt(profile) },
    ...history,
    { role: 'user', content: userMessage },
  ], 800, 0.7);
}

export async function generateWeeklyPlan(profile: Partial<UserProfile>): Promise<string> {
  const tdee = calculateTDEE(profile);
  const proteinTarget = Math.round((profile.weight_lbs ?? 150) * 0.7);
  const prompt = `Based on this user's profile, generate a practical 7-day wellness plan.

Calculated targets (use these exact numbers):
- Daily calories: ${tdee}
- Daily protein: ${proteinTarget}g
- Activity level: ${profile.activity_level ?? 'sedentary'}
- Goals: ${profile.fitness_goals?.join(', ') ?? 'general wellness'}

Return ONLY valid JSON in this exact format with no extra text:
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
- Include all 7 days in both meal_plan and workout_plan arrays
- Max 3-4 workout days (rest days use type: "rest" and no exercises array)
- Use foods from their preferences list
- Keep workouts beginner-friendly
- Avoid injury-aggravating exercises
- Breakfast must be appropriate morning foods (eggs, yogurt, oatmeal, toast, protein shake, fruit, granola etc) — never lunch or dinner foods
- Lunch and dinner can be more substantial meals
- Snacks should be simple (protein bar, fruit, nuts, yogurt, shake)
- Vary the meals so the same food doesn't repeat every day`;

  return togetherChat([
    { role: 'system', content: buildSystemPrompt(profile) },
    { role: 'user', content: prompt },
  ], 2500, 0.5);
}

export async function analyzeMealPhoto(base64Image: string): Promise<{ description: string; calories: number; protein: number; clarification?: string }> {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
              {
                type: 'text',
                text: 'You are a nutrition coach analyzing a meal photo. Identify what food is in the image and estimate its nutrition. Reply with ONLY valid JSON, no extra text: {"description": "brief meal description", "calories_low": number, "calories_high": number, "protein_g": number, "clarification": "one short question to improve accuracy, or empty string"}',
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vision API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '{}';
    const json = JSON.parse(text.replace(/```json?/g, '').replace(/```/g, '').trim());

    return {
      description: json.description ?? 'Meal from photo',
      calories: Math.round((json.calories_low + json.calories_high) / 2),
      protein: json.protein_g ?? 0,
      clarification: json.clarification || undefined,
    };
  } catch (err) {
    console.error('Vision error:', err);
    throw err;
  }
}

export async function estimateMeal(description: string): Promise<{ calories: number; protein: number; clarification?: string }> {
  try {
    const text = await togetherChat([
      {
        role: 'system',
        content: 'You estimate meal nutrition. Return ONLY valid JSON with no extra text: {"calories_low": number, "calories_high": number, "protein_g": number, "clarification": "optional question to improve accuracy or empty string"}',
      },
      { role: 'user', content: `Estimate nutrition for: ${description}` },
    ], 150, 0.3);

    const json = JSON.parse(text.replace(/```json?/g, '').replace(/```/g, '').trim());
    return {
      calories: Math.round((json.calories_low + json.calories_high) / 2),
      protein: json.protein_g ?? 0,
      clarification: json.clarification || undefined,
    };
  } catch {
    return { calories: 500, protein: 20 };
  }
}
