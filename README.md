# Alpha Planner

A productivity app combining Pomodoro timer, task management, and gamification. Built with React Native and Expo.

## Features

- **Pomodoro Timer** — Customizable focus/break sessions with background support and notifications
- **Task Management** — Create, organize, and track tasks with subtasks, priorities, and categories
- **4 Task Views** — List, Kanban board, Calendar, and Timeline
- **Gamification** — XP system, 10 levels, 24 achievements, and daily streaks
- **Dark Mode** — Full light/dark/system theme support

## Tech Stack

- React Native 0.81 / Expo SDK 54
- TypeScript (strict)
- Zustand for state management
- React Native Reanimated for animations
- UI Kitten (Eva Design System)

## Getting Started

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Start development server:
   ```bash
   yarn start
   ```

3. Run on device/simulator:
   ```bash
   yarn android   # Android
   yarn ios       # iOS
   ```

## Project Structure

```
app/            # Screens and navigation (Expo Router)
components/     # Reusable UI components
stores/         # Zustand state management
services/       # Background tasks and notifications
constants/      # Theme, animations, gamification config
types/          # TypeScript type definitions
utils/          # Helper functions
hooks/          # Custom React hooks
```

## Build

```bash
eas build --platform android --profile preview
eas build --platform ios --profile preview
```
