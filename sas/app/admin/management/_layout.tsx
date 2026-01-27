import React from 'react';
import { Stack } from 'expo-router';

export default function ManagementLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="students" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="timetable" />
    </Stack>
  );
}
