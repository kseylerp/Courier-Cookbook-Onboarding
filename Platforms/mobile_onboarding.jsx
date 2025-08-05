// Mobile Onboarding with React Native
// Native mobile experience with push notifications and Courier Inbox

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import { CourierProvider, CourierInbox } from '@trycourier/courier-react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Main Mobile Onboarding Component
function MobileOnboarding({ userId, clientKey }) {
  return (
    <CourierProvider
      clientKey={clientKey}
      userId={userId}
      wsUrl="wss://realtime.courier.com">
      
      <OnboardingScreen />
    </CourierProvider>
  );
}

function OnboardingScreen() {
  const { messages, markAsRead, markAsUnread } = CourierInbox.useInbox();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Filter onboarding tasks
  const onboardingTasks = messages.filter(msg => 
    msg.metadata?.tags?.includes('onboarding')
  );
  
  // Calculate progress
  useEffect(() => {
    const completedTasks = onboardingTasks.filter(t => t.read).length;
    const totalTasks = onboardingTasks.length || 1;
    setProgress((completedTasks / totalTasks) * 100);
  }, [onboardingTasks]);

  return (
    <ScrollView style={styles.container}>
      <OnboardingHeader progress={progress} />
      
      <View style={styles.taskList}>
        {onboardingTasks.map((task, index) => (
          <TaskCard
            key={task.messageId}
            task={task}
            index={index}
            onComplete={() => {
              markAsRead(task.messageId);
              setCurrentStep(index + 1);
            }}
          />
        ))}
      </View>
      
      {progress === 100 && <CompletionCelebration />}
    </ScrollView>
  );
}

// Task Card Component
function TaskCard({ task, index, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = task.read;
  
  const handleTaskPress = () => {
    if (!isCompleted) {
      // Navigate to task screen or open in-app browser
      if (task.data?.action_url) {
        // Use your navigation library
        // navigation.navigate(task.data.action_url);
      }
      onComplete();
    }
  };
  
  return (
    <TouchableOpacity 
      style={[styles.taskCard, isCompleted && styles.completedCard]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <View style={[styles.taskNumber, isCompleted && styles.completedNumber]}>
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>
        
        <View style={styles.taskContent}>
          <Text style={[styles.taskTitle, isCompleted && styles.completedTitle]}>
            {task.title}
          </Text>
          {task.data?.estimated_time && (
            <Text style={styles.taskTime}>⏱ {task.data.estimated_time}</Text>
          )}
        </View>
        
        {isCompleted && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
      
      {expanded && (
        <View style={styles.taskDetails}>
          <Text style={styles.taskDescription}>
            {task.data?.description}
          </Text>
          
          {!isCompleted && (
            <TouchableOpacity 
              style={styles.startButton}
              onPress={handleTaskPress}
            >
              <Text style={styles.startButtonText}>Start Task</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Progress Header Component
function OnboardingHeader({ progress }) {
  return (
    <View style={styles.header}>
      <Text style={styles.welcomeText}>Welcome to TeamSync!</Text>
      <Text style={styles.subtitleText}>Let's get you started</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
      </View>
    </View>
  );
}

// Completion Celebration Component
function CompletionCelebration() {
  return (
    <View style={styles.celebration}>
      <Text style={styles.celebrationEmoji}>🎉</Text>
      <Text style={styles.celebrationTitle}>Congratulations!</Text>
      <Text style={styles.celebrationText}>
        You've completed your onboarding. Welcome aboard!
      </Text>
      
      <TouchableOpacity style={styles.continueButton}>
        <Text style={styles.continueButtonText}>Continue to App</Text>
      </TouchableOpacity>
    </View>
  );
}

// Push Notification Setup
const configurePushNotifications = async (courier, userId) => {
  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    Alert.alert('Push Notifications', 'Please enable notifications for the best experience');
    return;
  }
  
  // Get push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Save token to Courier profile
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      [Platform.OS === 'ios' ? 'ios_push_token' : 'android_push_token']: token,
      push_enabled: true,
      device_platform: Platform.OS,
      device_version: Platform.Version
    }
  });
  
  // Configure notification handlers
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  
  // Handle notification interactions
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    
    // Navigate based on notification data
    if (data.action_url) {
      // navigation.navigate(data.action_url);
    }
  });
  
  return () => subscription.remove();
};

// Onboarding State Manager
class OnboardingStateManager {
  static async saveProgress(userId, step, data) {
    const key = `onboarding_${userId}`;
    const existing = await AsyncStorage.getItem(key);
    const progress = existing ? JSON.parse(existing) : {};
    
    progress[step] = {
      completed: true,
      completedAt: new Date().toISOString(),
      data: data
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(progress));
  }
  
  static async getProgress(userId) {
    const key = `onboarding_${userId}`;
    const progress = await AsyncStorage.getItem(key);
    return progress ? JSON.parse(progress) : {};
  }
  
  static async resetProgress(userId) {
    const key = `onboarding_${userId}`;
    await AsyncStorage.removeItem(key);
  }
  
  static async isOnboardingComplete(userId) {
    const progress = await this.getProgress(userId);
    const requiredSteps = [
      'profile_complete',
      'team_invited',
      'project_created',
      'push_enabled'
    ];
    
    return requiredSteps.every(step => progress[step]?.completed);
  }
}

// Interactive Onboarding Flow
function InteractiveOnboarding({ userId }) {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [userData, setUserData] = useState({});
  
  const screens = {
    welcome: <WelcomeScreen onNext={() => setCurrentScreen('profile')} />,
    profile: <ProfileSetupScreen 
                onNext={(data) => {
                  setUserData({...userData, ...data});
                  setCurrentScreen('team');
                }} 
              />,
    team: <TeamInviteScreen 
            onNext={(data) => {
              setUserData({...userData, ...data});
              setCurrentScreen('notifications');
            }}
            onSkip={() => setCurrentScreen('notifications')}
          />,
    notifications: <NotificationSetupScreen 
                     onComplete={async () => {
                       await OnboardingStateManager.saveProgress(userId, 'completed', userData);
                       setCurrentScreen('done');
                     }}
                   />,
    done: <OnboardingComplete userData={userData} />
  };
  
  return (
    <View style={styles.container}>
      {screens[currentScreen]}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 5,
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  taskList: {
    padding: 15,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  completedCard: {
    opacity: 0.7,
    backgroundColor: '#f8f9fa',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  completedNumber: {
    backgroundColor: '#28a745',
  },
  numberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#6c757d',
  },
  taskTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#28a745',
    fontWeight: 'bold',
  },
  taskDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  celebration: {
    padding: 30,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 10,
  },
  celebrationText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export { 
  MobileOnboarding, 
  OnboardingScreen, 
  configurePushNotifications,
  OnboardingStateManager,
  InteractiveOnboarding 
};