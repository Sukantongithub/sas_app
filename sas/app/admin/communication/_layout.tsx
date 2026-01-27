import React from 'react';
import { Stack } from 'expo-router';

export default function CommunicationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
