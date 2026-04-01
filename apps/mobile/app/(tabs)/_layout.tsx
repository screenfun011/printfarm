import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }} />
      <Tabs.Screen name="printers" options={{ title: 'Štampači', tabBarIcon: ({ color }) => <Ionicons name="print" size={22} color={color} /> }} />
      <Tabs.Screen name="files" options={{ title: 'Fajlovi', tabBarIcon: ({ color }) => <Ionicons name="document" size={22} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Poslovi', tabBarIcon: ({ color }) => <Ionicons name="list" size={22} color={color} /> }} />
      <Tabs.Screen name="ai" options={{ title: 'AI', tabBarIcon: ({ color }) => <Ionicons name="eye" size={22} color={color} /> }} />
    </Tabs>
  )
}
