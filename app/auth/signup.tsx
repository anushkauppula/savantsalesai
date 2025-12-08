import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const saveUserDetailsToBackend = async (userId: string, firstName: string, lastName: string, phoneNumber: string, email: string) => {
    const backendUrl = 'https://instructorai-backend.onrender.com';
    
    const endpoints = [
      `${backendUrl}/user_details`,
      // Only use localhost on web, not on mobile
      ...(Platform.OS === 'web' ? [`https://instructorai-backend.onrender.com/user_details`] : [])
    ];
    
    const payload = {
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      email: email,
    };
    
    console.log('Saving user details to backend:', { 
      userId, 
      endpoints,
      payload: {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        email: email,
      }
    });
    
    let response;
    let lastError;
    
    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 second timeout per endpoint
      
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`Response status: ${response.status} for ${endpoint}`);

        if (response.ok) {
          const data = await response.json();
          console.log('Successfully saved user details to backend. Response:', data);
          return { success: true, data };
        } else {
          const errorText = await response.text();
          console.error(`Backend error ${response.status}:`, errorText);
          lastError = new Error(`Backend error: ${response.status} - ${errorText}`);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error('Request timeout for endpoint:', endpoint);
          lastError = new Error('Request timeout: Backend server not reachable');
        } else {
          console.error('Error connecting to endpoint:', endpoint, error);
          lastError = error;
        }
        continue;
      }
    }
    
    // If we get here, all endpoints failed
    console.error('All endpoints failed. Last error:', lastError);
    return { success: false, error: lastError, attemptedEndpoints: endpoints };
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !phoneNumber || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting signup process...');
      const { error, data } = await signUp(email, password);
      
      console.log('Signup response:', { error, hasData: !!data, hasUser: !!data?.user, userId: data?.user?.id });
      
      if (error) {
        console.error('Signup error:', error);
        Alert.alert('Signup Failed', error.message);
      } else {
        // If signup successful, save user details to backend
        const userId = data?.user?.id;
        console.log('User ID from signup:', userId);
        
        if (userId) {
          console.log('Calling saveUserDetailsToBackend with:', { userId, firstName, lastName, phoneNumber, email });
          const backendResult = await saveUserDetailsToBackend(userId, firstName, lastName, phoneNumber, email);
          
          console.log('Backend save result:', backendResult);
          
          if (backendResult.success) {
            console.log('Successfully saved to backend, navigating to home page');
            // Navigate to home page after successful save
            router.replace('/(tabs)');
          } else {
            // Account created but backend save failed - still navigate but show error
            const errorMsg = backendResult.error instanceof Error ? backendResult.error.message : 'Unknown error';
            console.error('Backend save failed:', errorMsg);
            
            Alert.alert(
              'Account Created (Backend Save Failed)', 
              `Your account has been created successfully!\n\nHowever, we could not save your details to the backend database.\n\nError: ${errorMsg}\n\nYour account is still active. You can try updating your profile later.`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/(tabs)');
                  }
                }
              ]
            );
          }
        } else {
          // No user ID - shouldn't happen but handle it
          console.warn('No user ID returned from signup. Data:', data);
          Alert.alert('Success', 'Account created successfully!', [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)')
            }
          ]);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../northlogo.png')} 
              style={styles.logo}
              resizeMode="contain"
              onError={(error) => console.log('Image load error:', error)}
              onLoad={() => console.log('Image loaded successfully')}
            />
            <Text style={styles.logoText}>AI-Powered Instructor Assistant</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.signupButton, loading && styles.disabledButton]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#006848',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 200,
    height: 200,
  },
  logoText: {
    color: '#E8F5F0',
    fontSize: 23,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8F5F0',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  signupButton: {
    backgroundColor: '#006848',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 16,
    color: '#E8F5F0',
  },
  loginLink: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
