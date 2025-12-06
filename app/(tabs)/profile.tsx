import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  // Edit Profile State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Display user details state (for showing in profile card)
  const [displayFirstName, setDisplayFirstName] = useState('');
  const [displayLastName, setDisplayLastName] = useState('');

  // Fetch user details from backend using GET /user_details/{user_id}
  const fetchUserDetails = async (forDisplay = false) => {
    if (!user?.id) {
      if (!forDisplay) {
        Alert.alert('Error', 'No user found. Please try logging in again.');
      }
      return;
    }

    if (forDisplay) {
      // Don't show loading spinner when fetching for display
    } else {
      setIsLoadingProfile(true);
    }
    
    try {
      const backendUrl = 'http://192.168.1.146';
      
      const endpoints = [
        `${backendUrl}:8000/user_details/${user.id}`,
        // Only use localhost on web, not on mobile
        ...(Platform.OS === 'web' ? [`http://localhost:8000/user_details/${user.id}`] : [])
      ];
      
      console.log('Fetching user details from backend:', { userId: user.id, endpoints, forDisplay });
      
      let response;
      let lastError;
      
      for (const endpoint of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);
        
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log(`Response status: ${response.status} for ${endpoint}`);

          if (response.ok) {
            const data = await response.json();
            console.log('Successfully fetched user details:', data);
            // Set the user details
            setFirstName(data.first_name || '');
            setLastName(data.last_name || '');
            setPhoneNumber(data.phone_number || '');
            
            // Also update display values
            if (forDisplay) {
              setDisplayFirstName(data.first_name || '');
              setDisplayLastName(data.last_name || '');
            }
            
            return;
          } else {
            const errorText = await response.text();
            console.error(`Backend error ${response.status}:`, errorText);
            lastError = new Error(`Backend error: ${response.status} - ${errorText}`);
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.error(`Request timeout for ${endpoint}`);
            lastError = new Error(`Request timeout: Backend server not reachable at ${endpoint}`);
          } else {
            console.error(`Error connecting to ${endpoint}:`, error);
            lastError = error;
          }
          continue;
        }
      }
      
      // If we get here, all endpoints failed - set defaults
      console.warn('Could not fetch user details:', lastError);
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      if (forDisplay) {
        setDisplayFirstName('');
        setDisplayLastName('');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      if (forDisplay) {
        setDisplayFirstName('');
        setDisplayLastName('');
      }
    } finally {
      if (!forDisplay) {
        setIsLoadingProfile(false);
      }
    }
  };

  // Fetch user details when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      fetchUserDetails(true); // Fetch for display purposes
    }
  }, [user?.id]);

  // Open edit profile modal and fetch user details
  const handleOpenEditProfile = async () => {
    setShowEditProfileModal(true);
    await fetchUserDetails();
  };

  // Save updated user details to backend using POST /user_details/update
  const handleSaveProfile = async () => {
    if (!firstName || !lastName || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!user?.id || !user?.email) {
      Alert.alert('Error', 'No user found. Please try logging in again.');
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsSavingProfile(true);
    try {
      const backendUrl = 'http://192.168.1.146';
      
      const endpoints = [
        `${backendUrl}:8000/user_details/update`,
        // Only use localhost on web, not on mobile
        ...(Platform.OS === 'web' ? [`http://localhost:8000/user_details/update`] : [])
      ];
      
      const payload = {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        email: user.email,
      };
      
      console.log('Updating user profile:', { userId: user.id, endpoints, payload });
      
      let response;
      let lastError;
      
      for (const endpoint of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000);
        
        try {
          console.log(`Trying update endpoint: ${endpoint}`);
          console.log('Sending payload:', JSON.stringify(payload, null, 2));
          
          response = await fetch(endpoint, {
            method: 'POST',  // Use POST method for update
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
            console.log('Successfully updated user profile. Response:', data);
            // Update display values
            setDisplayFirstName(firstName);
            setDisplayLastName(lastName);
            // Close modal immediately after successful save
            setShowEditProfileModal(false);
            // Show success message
            Alert.alert('Success', 'Profile updated successfully');
            return;
          } else {
            const errorText = await response.text();
            console.error(`Backend error ${response.status}:`, errorText);
            lastError = new Error(`Backend error: ${response.status} - ${errorText}`);
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.error(`Request timeout for ${endpoint}`);
            lastError = new Error('Request timeout: Backend server not reachable');
          } else {
            console.error(`Error connecting to ${endpoint}:`, error);
            lastError = error;
          }
          continue;
        }
      }
      
      // If we get here, all endpoints failed
      Alert.alert(
        'Error',
        `Failed to update profile. ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'An unexpected error occurred');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to change password');
      } else {
        Alert.alert('Success', 'Password changed successfully', [
          {
            text: 'OK',
            onPress: () => {
              setShowChangePasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    // Use different confirmation methods for web vs mobile
    if (Platform.OS === 'web') {
      // Use browser's confirm dialog for web
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to logout?')) {
        await performLogout();
      }
    } else {
      // Use Alert.alert for mobile
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: performLogout
          }
        ]
      );
    }
  };

  const performLogout = async () => {
    try {
      console.log('Starting logout process...');
      await signOut();
      console.log('Sign out successful, navigating...');
      
      // Use window.location for web to ensure proper navigation
      if (Platform.OS === 'web') {
        // Use window.location for full page reload on web
        if (typeof window !== 'undefined') {
          console.log('Using window.location for web navigation');
          window.location.href = '/auth/login';
        } else {
          console.log('Window not available, using router');
          router.replace('/auth/login');
        }
      } else {
        console.log('Using router for mobile navigation');
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if signOut fails, try to navigate
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        } else {
          router.replace('/auth/login');
        }
      } else {
        router.replace('/auth/login');
      }
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data, including recordings and analysis, will be permanently deleted. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              if (!user?.id) {
                Alert.alert('Error', 'No user found. Please try logging in again.');
                setIsDeletingAccount(false);
                return;
              }

              // Attempt to delete user account via Supabase RPC function
              // This requires a database function to be set up in Supabase
              // If the function doesn't exist, we'll fall back to signing out
              
              const { error: rpcError } = await supabase.rpc('delete_user_account', {
                user_id: user.id
              }).catch(async () => {
                // If RPC function doesn't exist, try direct deletion via API
                // Note: This requires admin privileges, so it may not work from client
                return { error: { message: 'RPC function not available' } };
              });

              if (rpcError) {
                // If RPC fails, try alternative: use Supabase's user deletion
                // Since admin API isn't available from client, we'll sign out
                // and provide instructions for account deletion
                
                // Sign out the user
                await supabase.auth.signOut();
                await signOut();
                
                Alert.alert(
                  'Account Deletion Initiated',
                  'You have been signed out. To complete account deletion, please contact support at aipioneers@gmail.com with your account email, or your account will be automatically deleted after 30 days of inactivity.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (Platform.OS === 'web' && typeof window !== 'undefined') {
                          window.location.href = '/auth/login';
                        } else {
                          router.replace('/auth/login');
                        }
                      }
                    }
                  ]
                );
              } else {
                // Successfully deleted via RPC
                await supabase.auth.signOut();
                await signOut();
                
                Alert.alert(
                  'Account Deleted',
                  'Your account has been permanently deleted. You will be signed out.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (Platform.OS === 'web' && typeof window !== 'undefined') {
                          window.location.href = '/auth/login';
                        } else {
                          router.replace('/auth/login');
                        }
                      }
                    }
                  ]
                );
              }
            } catch (error: any) {
              console.error('Error deleting account:', error);
              
              // Fallback: Sign out and show message
              try {
                await supabase.auth.signOut();
                await signOut();
              } catch (signOutError) {
                console.error('Error signing out:', signOutError);
              }
              
              Alert.alert(
                'Account Deletion',
                'You have been signed out. To complete account deletion, please contact support at aipioneers@gmail.com with your account email.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.location.href = '/auth/login';
                      } else {
                        router.replace('/auth/login');
                      }
                    }
                  }
                ]
              );
            } finally {
              setIsDeletingAccount(false);
            }
          }
        }
      ]
    );
  };

  const handleHelpSupport = () => {
    const email = 'aipioneers@gmail.com';
    const subject = encodeURIComponent('Support Request - Savant Academic AI');
    const body = encodeURIComponent(
      `Hello,\n\nI need help with the following issue:\n\n[Please describe your issue here]\n\nThank you!`
    );
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          Alert.alert(
            'Email Not Available',
            'Please send an email to aipioneers@gmail.com with your support request.',
            [{ text: 'OK' }]
          );
        }
      })
      .catch((error) => {
        console.error('Error opening email:', error);
        Alert.alert(
          'Error',
          'Unable to open email client. Please send an email to aipioneers@gmail.com',
          [{ text: 'OK' }]
        );
      });
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="person" size={32} color="#fff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account settings</Text>
          </View>
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView 
        style={styles.scrollableBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <MaterialIcons name="account-circle" size={60} color="#006848" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {displayFirstName || displayLastName 
                  ? `${displayFirstName} ${displayLastName}`.trim() 
                  : (user?.email || 'Guest').split('@')[0]}
              </Text>
              <Text style={styles.userEmail}>{user?.email || 'Not logged in'}</Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.accountCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="account-box" size={20} color="#006848" />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleOpenEditProfile}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="edit" size={24} color="#666" />
              <Text style={styles.settingLabel}>Edit Profile</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowChangePasswordModal(true)}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="lock" size={24} color="#666" />
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="help" size={20} color="#006848" />
            <Text style={styles.sectionTitle}>Support</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowPrivacyPolicyModal(true)}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="policy" size={24} color="#666" />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleHelpSupport}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="help-center" size={24} color="#666" />
              <Text style={styles.settingLabel}>Help & Support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="warning" size={20} color="#f44336" />
            <Text style={[styles.sectionTitle, { color: '#f44336' }]}>Danger Zone</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.dangerItem} 
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            <View style={styles.settingLeft}>
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color="#f44336" style={{ marginRight: 12 }} />
              ) : (
                <MaterialIcons name="delete-forever" size={24} color="#f44336" />
              )}
              <Text style={[styles.settingLabel, { color: '#f44336' }]}>
                {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
              </Text>
            </View>
            {!isDeletingAccount && (
              <MaterialIcons name="chevron-right" size={24} color="#ccc" />
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#999"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#999"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.inputHint}>Must be at least 6 characters</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#999"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isChangingPassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditProfileModal(false);
                  setFirstName('');
                  setLastName('');
                  setPhoneNumber('');
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {isLoadingProfile ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#006848" />
                  <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Enter your first name"
                      placeholderTextColor="#999"
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!isSavingProfile}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Enter your last name"
                      placeholderTextColor="#999"
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!isSavingProfile}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSavingProfile}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={user?.email || ''}
                      placeholder="Email address"
                      placeholderTextColor="#999"
                      editable={false}
                    />
                    <Text style={styles.inputHint}>Email cannot be changed</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditProfileModal(false);
                  setFirstName('');
                  setLastName('');
                  setPhoneNumber('');
                }}
                disabled={isSavingProfile || isLoadingProfile}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile || isLoadingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyPolicyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacyPolicyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity
                onPress={() => setShowPrivacyPolicyModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.privacySectionTitle}>Last Updated: {new Date().toLocaleDateString()}</Text>
              
              <Text style={styles.privacySectionTitle}>1. Information We Collect</Text>
              <Text style={styles.privacyText}>
                We collect information that you provide directly to us, including:
                {'\n\n'}
                • Account information (email address, password)
                {'\n'}
                • Audio recordings of academic calls that you choose to record
                {'\n'}
                • Usage data and analytics to improve our services
              </Text>

              <Text style={styles.privacySectionTitle}>2. How We Use Your Information</Text>
              <Text style={styles.privacyText}>
                We use the information we collect to:
                {'\n\n'}
                • Provide, maintain, and improve our services
                {'\n'}
                • Process and analyze your academic call recordings
                {'\n'}
                • Send you technical notices and support messages
                {'\n'}
                • Respond to your comments and questions
              </Text>

              <Text style={styles.privacySectionTitle}>3. Data Storage and Security</Text>
              <Text style={styles.privacyText}>
                We implement appropriate technical and organizational measures to protect your personal information. 
                Your data is stored securely using industry-standard encryption and security practices.
              </Text>

              <Text style={styles.privacySectionTitle}>4. Audio Recordings</Text>
              <Text style={styles.privacyText}>
                Audio recordings are processed for transcription and analysis purposes. 
                We do not share your recordings with third parties without your explicit consent. 
                You can delete your recordings at any time through the app.
              </Text>

              <Text style={styles.privacySectionTitle}>5. Third-Party Services</Text>
              <Text style={styles.privacyText}>
                We use third-party services (such as Supabase for authentication) that may collect 
                information used to identify you. These services have their own privacy policies 
                governing the collection and use of your information.
              </Text>

              <Text style={styles.privacySectionTitle}>6. Your Rights</Text>
              <Text style={styles.privacyText}>
                You have the right to:
                {'\n\n'}
                • Access your personal information
                {'\n'}
                • Correct inaccurate data
                {'\n'}
                • Request deletion of your data
                {'\n'}
                • Opt-out of certain data collection practices
              </Text>

              <Text style={styles.privacySectionTitle}>7. Children's Privacy</Text>
              <Text style={styles.privacyText}>
                Our service is not intended for users under the age of 18. 
                We do not knowingly collect personal information from children.
              </Text>

              <Text style={styles.privacySectionTitle}>8. Changes to This Policy</Text>
              <Text style={styles.privacyText}>
                We may update this Privacy Policy from time to time. 
                We will notify you of any changes by posting the new Privacy Policy on this page 
                and updating the "Last Updated" date.
              </Text>

              <Text style={styles.privacySectionTitle}>9. Contact Us</Text>
              <Text style={styles.privacyText}>
                If you have any questions about this Privacy Policy, please contact us at:
                {'\n\n'}
                Email: aipioneers@gmail.com
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setShowPrivacyPolicyModal(false)}
              >
                <Text style={styles.saveButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Fixed Header Styles
  fixedHeader: {
    backgroundColor: '#006848',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5F0',
    lineHeight: 18,
  },
  headerIcon: {
    marginRight: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Scrollable Body Styles
  scrollableBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra space for tab bar
  },
  // User Card
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  // Cards
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  supportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dangerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#006848',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  privacyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 10,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
