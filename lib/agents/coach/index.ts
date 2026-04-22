import type { AgentDefinition } from '../types'
import { voiceInstructions } from '../voices'
import { FAILURE_HANDLING_BLOCK } from '../shared'
import { exerciseSummary } from './exercises'

export const coach: AgentDefinition = {
  id: 'coach',
  default_display_name: 'Coach',
  description:
    'Progressive-overload workouts from your equipment + session logging.',
  emoji: '💪',
  task_type: 'agent_run',
  voices: ['coach', 'assistant', 'analyst'],
  cadence_hint: 'session-reactive + weekly sunday 19:00 local',
  tools: ['read_memory', 'write_memory'],
  card_tools: ['card_workout_session', 'card_weekly_summary'],
  first_run_questions: [
    {
      id: 'goal',
      question: "What's your primary goal?",
      type: 'select',
      options: [
        'strength',
        'hypertrophy',
        'endurance',
        'general fitness',
        'sport-specific',
        'fat loss',
        'mobility/rehab',
      ],
    },
    {
      id: 'equipment',
      question: 'What equipment do you have?',
      type: 'multi_select',
      options: [
        'bodyweight only',
        'bands',
        'dumbbells',
        'barbell + plates',
        'full gym',
        'home rack',
        'cable machine',
        'kettlebells',
      ],
    },
    {
      id: 'dumbbell_weights',
      question: 'If dumbbells, what weights do you have? (free text)',
      type: 'text',
    },
    {
      id: 'days_per_week',
      question: 'How many days per week?',
      type: 'select',
      options: ['2', '3', '4', '5', '6'],
    },
    {
      id: 'session_length',
      question: 'How long per session?',
      type: 'select',
      options: ['20', '30', '45', '60+'],
    },
    {
      id: 'experience',
      question: 'Experience level?',
      type: 'select',
      options: ['new to lifting', '6-24 months', '2+ years'],
    },
    {
      id: 'injuries',
      question: 'Any injuries or things to avoid?',
      type: 'text',
    },
    {
      id: 'prefs',
      question: 'Exercises you love or hate?',
      type: 'text',
    },
    {
      id: 'display_name',
      question: 'Pick a name for me.',
      type: 'text',
      default: 'Coach',
    },
    {
      id: 'voice',
      question: 'Pick my voice.',
      type: 'select',
      options: ['coach', 'assistant', 'analyst'],
    },
  ],
  buildSystemPrompt: (ctx) => {
    const name = ctx.agentProfile?.display_name || 'Coach'
    const userName = ctx.profile?.name || 'friend'
    return `You are ${name}, a strength and conditioning coach for ${userName}.

Your job: generate today's workout based on their goal, equipment, experience, recent sessions, and any signals from memory (sleep quality, soreness, schedule changes). Progressive overload when earned, deload when signals warrant it.

Process:
1. Call read_memory (tag: "agent:coach") for goal, equipment, days/week, session length, experience, injuries. Separately call read_memory (content_type: "workout_session") to load recent session logs from the last 4 weeks.
2. Decide today's focus based on what they've done recently and their split
3. Generate the workout — USE ONLY exercises from the library below that match their equipment
4. Apply progressive overload: if they hit target on their last session for an exercise, increment appropriately (2-5 lb isolation, 5-10 lb compounds; bodyweight progresses via reps)
5. Render via card_workout_session
6. The session card will POST to /api/agents/coach/log-session when the user finishes; you don't need to call write_memory — the session logger will.

Weekly review mode: if the user asks for a weekly review, review last 7 days from memory, identify PRs, detect stalls (same weight/reps for 3 sessions = stall), flag deload if sleep/energy signals are low, render via card_weekly_summary.

Exercise library (use ONLY these):
${exerciseSummary()}

${FAILURE_HANDLING_BLOCK}

${voiceInstructions(ctx.agentProfile?.voice)}`
  },
  buildKickoffMessage: (ctx) => {
    const today = ctx.now.toISOString().slice(0, 10)
    return `Generate today's workout (${today}) based on my profile and recent session history. Render as a workout card.`
  },
}
