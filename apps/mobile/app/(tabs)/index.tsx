import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { authStore } from '@/lib/auth-store'
import { authApi } from '@/lib/api-client'
import { usePrinters } from '@/modules/printers/hooks'
import { useJobs } from '@/modules/jobs/hooks'

export default function DashboardScreen() {
  const { data: printers } = usePrinters()
  const { data: jobs } = useJobs()

  const activePrinters = printers?.filter(p => p.status === 'printing').length ?? 0
  const activeJobs = jobs?.filter(j => j.status === 'printing').length ?? 0

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      authStore.clearAuth()
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{printers?.length ?? '—'}</Text>
          <Text style={styles.cardLabel}>Štampači</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{activePrinters}</Text>
          <Text style={styles.cardLabel}>Aktivni</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{activeJobs}</Text>
          <Text style={styles.cardLabel}>Poslovi</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Odjavi se</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardValue: { fontSize: 28, fontWeight: 'bold', color: '#2563eb' },
  cardLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  logoutBtn: { marginTop: 'auto', backgroundColor: '#fee2e2', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: '600' },
})
