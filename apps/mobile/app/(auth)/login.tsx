import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { authApi } from '@/lib/api-client'
import { authStore } from '@/lib/auth-store'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requireTotp, setRequireTotp] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    try {
      const res = await authApi.login({ email, password, totpCode: totpCode || undefined })
      if ('requireTotp' in res) {
        setRequireTotp(true)
      } else {
        authStore.setAuth(res.token, res.user)
      }
    } catch (err: any) {
      Alert.alert('Greška', err.message ?? 'Prijava nije uspela')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PrintFarm</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Lozinka" value={password} onChangeText={setPassword} secureTextEntry />
      {requireTotp && (
        <TextInput style={styles.input} placeholder="TOTP kod" value={totpCode} onChangeText={setTotpCode} keyboardType="number-pad" />
      )}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Učitavam...' : 'Prijava'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
