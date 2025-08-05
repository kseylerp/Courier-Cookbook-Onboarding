// User Preferences Management
// Allow users to control their notification experience

import { CourierClient } from "@trycourier/courier";

class UserPreferencesManager {
  constructor() {
    this.courier = CourierClient({
      authorizationToken: process.env.COURIER_AUTH_TOKEN
    });
    
    // Default preference structure
    this.defaultPreferences = {
      channels: {
        email: true,
        sms: false,
        push: true,
        inbox: true,
        slack: false
      },
      categories: {
        marketing: true,
        product_updates: true,
        onboarding: true,
        security: true,
        billing: true,
        team_activity: true
      },
      frequency: {
        digest: 'daily', // 'realtime', 'daily', 'weekly', 'never'
        max_per_day: 10,
        quiet_hours: {
          enabled: true,
          start: '21:00',
          end: '09:00',
          timezone: 'America/New_York'
        }
      },
      language: 'en',
      unsubscribed: false
    };
  }

  // Get user preferences
  async getUserPreferences(userId) {
    try {
      const response = await this.courier.preferences.get(userId);
      
      // Merge with defaults to ensure all fields exist
      return this.mergeWithDefaults(response);
    } catch (error) {
      console.error('Error fetching preferences:', error);
      
      // Return defaults if no preferences exist
      return this.defaultPreferences;
    }
  }

  // Update user preferences
  async updatePreferences(userId, updates) {
    try {
      // Validate preferences
      const validated = this.validatePreferences(updates);
      
      // Update in Courier
      const response = await this.courier.preferences.update(
        userId,
        validated
      );
      
      // Update user profile with preference metadata
      await this.courier.profiles.merge({
        recipientId: userId,
        profile: {
          preferences_updated_at: new Date().toISOString(),
          preferences_version: Date.now()
        }
      });
      
      // Apply preferences immediately
      await this.applyPreferences(userId, validated);
      
      return response;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  // Update channel preference
  async updateChannelPreference(userId, channel, enabled) {
    const preferences = await this.getUserPreferences(userId);
    preferences.channels[channel] = enabled;
    
    return await this.updatePreferences(userId, preferences);
  }

  // Update category preference
  async updateCategoryPreference(userId, category, enabled) {
    const preferences = await this.getUserPreferences(userId);
    preferences.categories[category] = enabled;
    
    return await this.updatePreferences(userId, preferences);
  }

  // Set notification frequency
  async setNotificationFrequency(userId, frequency) {
    const validFrequencies = ['realtime', 'daily', 'weekly', 'never'];
    
    if (!validFrequencies.includes(frequency)) {
      throw new Error(`Invalid frequency: ${frequency}`);
    }
    
    const preferences = await this.getUserPreferences(userId);
    preferences.frequency.digest = frequency;
    
    // If setting to digest mode, configure digest automation
    if (frequency !== 'realtime') {
      await this.configureDigest(userId, frequency);
    }
    
    return await this.updatePreferences(userId, preferences);
  }

  // Configure quiet hours
  async setQuietHours(userId, quietHours) {
    const preferences = await this.getUserPreferences(userId);
    preferences.frequency.quiet_hours = {
      ...preferences.frequency.quiet_hours,
      ...quietHours
    };
    
    return await this.updatePreferences(userId, preferences);
  }

  // Unsubscribe user from all notifications
  async unsubscribeAll(userId, reason = '') {
    const preferences = await this.getUserPreferences(userId);
    preferences.unsubscribed = true;
    
    // Log unsubscribe reason
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: {
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: reason
      }
    });
    
    // Disable all channels
    Object.keys(preferences.channels).forEach(channel => {
      preferences.channels[channel] = false;
    });
    
    return await this.updatePreferences(userId, preferences);
  }

  // Resubscribe user
  async resubscribe(userId) {
    const preferences = await this.getUserPreferences(userId);
    preferences.unsubscribed = false;
    
    // Re-enable default channels
    preferences.channels.email = true;
    preferences.channels.inbox = true;
    
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: {
        unsubscribed: false,
        resubscribed_at: new Date().toISOString()
      }
    });
    
    return await this.updatePreferences(userId, preferences);
  }

  // Get preference groups for UI
  async getPreferenceGroups(userId) {
    const preferences = await this.getUserPreferences(userId);
    
    return {
      channels: [
        {
          id: 'email',
          label: 'Email',
          description: 'Receive notifications via email',
          enabled: preferences.channels.email,
          icon: '📧'
        },
        {
          id: 'sms',
          label: 'SMS',
          description: 'Get text messages for important updates',
          enabled: preferences.channels.sms,
          icon: '📱',
          requiresPhone: true
        },
        {
          id: 'push',
          label: 'Push Notifications',
          description: 'Mobile app notifications',
          enabled: preferences.channels.push,
          icon: '🔔',
          requiresApp: true
        },
        {
          id: 'inbox',
          label: 'In-App Messages',
          description: 'Messages in your notification center',
          enabled: preferences.channels.inbox,
          icon: '📬'
        }
      ],
      categories: [
        {
          id: 'onboarding',
          label: 'Getting Started',
          description: 'Tips and guides to help you get started',
          enabled: preferences.categories.onboarding,
          required: false
        },
        {
          id: 'product_updates',
          label: 'Product Updates',
          description: 'New features and improvements',
          enabled: preferences.categories.product_updates,
          required: false
        },
        {
          id: 'marketing',
          label: 'News and Offers',
          description: 'Product news, tips, and special offers',
          enabled: preferences.categories.marketing,
          required: false
        },
        {
          id: 'security',
          label: 'Security Alerts',
          description: 'Important security notifications',
          enabled: preferences.categories.security,
          required: true // Can't be disabled
        },
        {
          id: 'billing',
          label: 'Billing',
          description: 'Payment and subscription notifications',
          enabled: preferences.categories.billing,
          required: true
        },
        {
          id: 'team_activity',
          label: 'Team Activity',
          description: 'Updates about your team members',
          enabled: preferences.categories.team_activity,
          required: false
        }
      ],
      frequency: {
        current: preferences.frequency.digest,
        options: [
          {
            value: 'realtime',
            label: 'Real-time',
            description: 'Get notified as soon as something happens'
          },
          {
            value: 'daily',
            label: 'Daily Digest',
            description: 'One summary email per day'
          },
          {
            value: 'weekly',
            label: 'Weekly Digest',
            description: 'Weekly summary of all activity'
          },
          {
            value: 'never',
            label: 'Pause All',
            description: 'Temporarily pause all notifications'
          }
        ],
        quietHours: preferences.frequency.quiet_hours
      }
    };
  }

  // Apply preferences to message sending
  async applyPreferences(userId, preferences) {
    // This method would be called before sending any message
    // to ensure it respects user preferences
    
    // Check if user is unsubscribed
    if (preferences.unsubscribed) {
      return { send: false, reason: 'user_unsubscribed' };
    }
    
    // Check quiet hours
    if (this.isQuietHours(preferences.frequency.quiet_hours)) {
      return { 
        send: false, 
        reason: 'quiet_hours',
        reschedule: this.getNextAvailableTime(preferences.frequency.quiet_hours)
      };
    }
    
    // Check daily limit
    const todayCount = await this.getTodayMessageCount(userId);
    if (todayCount >= preferences.frequency.max_per_day) {
      return { send: false, reason: 'daily_limit_reached' };
    }
    
    return { send: true };
  }

  // Configure digest automation
  async configureDigest(userId, frequency) {
    const scheduleMap = {
      'daily': '0 9 * * *',   // 9 AM daily
      'weekly': '0 9 * * 1'   // 9 AM Monday
    };
    
    const schedule = scheduleMap[frequency];
    
    if (schedule) {
      // Create or update digest automation
      await this.courier.automations.create({
        name: `${userId}-digest`,
        trigger: {
          type: 'scheduled',
          schedule: schedule
        },
        steps: [
          {
            action: 'digest',
            template: `${frequency}-digest`,
            recipient: userId
          }
        ]
      });
    }
  }

  // Check if currently in quiet hours
  isQuietHours(quietHoursConfig) {
    if (!quietHoursConfig.enabled) return false;
    
    const now = new Date();
    const timezone = quietHoursConfig.timezone;
    
    // Convert to user's timezone
    const userTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    const [startHour, startMinute] = quietHoursConfig.start.split(':').map(Number);
    const [endHour, endMinute] = quietHoursConfig.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    // Handle overnight quiet hours
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }
    
    return currentTime >= startTime && currentTime < endTime;
  }

  // Get next available time after quiet hours
  getNextAvailableTime(quietHoursConfig) {
    const [endHour, endMinute] = quietHoursConfig.end.split(':').map(Number);
    const nextAvailable = new Date();
    
    nextAvailable.setHours(endHour, endMinute, 0, 0);
    
    // If end time has passed today, schedule for tomorrow
    if (nextAvailable < new Date()) {
      nextAvailable.setDate(nextAvailable.getDate() + 1);
    }
    
    return nextAvailable;
  }

  // Get today's message count for user
  async getTodayMessageCount(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const logs = await this.courier.logs.list({
      recipient: userId,
      start: today.toISOString()
    });
    
    return logs.results.length;
  }

  // Validate preference structure
  validatePreferences(preferences) {
    const validated = { ...this.defaultPreferences };
    
    // Validate channels
    if (preferences.channels) {
      Object.keys(preferences.channels).forEach(channel => {
        if (typeof preferences.channels[channel] === 'boolean') {
          validated.channels[channel] = preferences.channels[channel];
        }
      });
    }
    
    // Validate categories
    if (preferences.categories) {
      Object.keys(preferences.categories).forEach(category => {
        if (typeof preferences.categories[category] === 'boolean') {
          // Don't allow disabling required categories
          if (category === 'security' || category === 'billing') {
            validated.categories[category] = true;
          } else {
            validated.categories[category] = preferences.categories[category];
          }
        }
      });
    }
    
    // Validate frequency
    if (preferences.frequency) {
      if (preferences.frequency.digest) {
        validated.frequency.digest = preferences.frequency.digest;
      }
      if (typeof preferences.frequency.max_per_day === 'number') {
        validated.frequency.max_per_day = Math.max(1, Math.min(100, preferences.frequency.max_per_day));
      }
      if (preferences.frequency.quiet_hours) {
        validated.frequency.quiet_hours = preferences.frequency.quiet_hours;
      }
    }
    
    return validated;
  }

  // Merge preferences with defaults
  mergeWithDefaults(preferences) {
    return {
      ...this.defaultPreferences,
      ...preferences,
      channels: {
        ...this.defaultPreferences.channels,
        ...preferences.channels
      },
      categories: {
        ...this.defaultPreferences.categories,
        ...preferences.categories
      },
      frequency: {
        ...this.defaultPreferences.frequency,
        ...preferences.frequency,
        quiet_hours: {
          ...this.defaultPreferences.frequency.quiet_hours,
          ...preferences.frequency?.quiet_hours
        }
      }
    };
  }
}

// Express routes for preference management
import express from 'express';
const router = express.Router();
const preferencesManager = new UserPreferencesManager();

// Get user preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const preferences = await preferencesManager.getUserPreferences(req.params.userId);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update preferences
router.put('/preferences/:userId', async (req, res) => {
  try {
    const updated = await preferencesManager.updatePreferences(
      req.params.userId,
      req.body
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get preference UI groups
router.get('/preferences/:userId/groups', async (req, res) => {
  try {
    const groups = await preferencesManager.getPreferenceGroups(req.params.userId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe
router.post('/preferences/:userId/unsubscribe', async (req, res) => {
  try {
    const result = await preferencesManager.unsubscribeAll(
      req.params.userId,
      req.body.reason
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resubscribe
router.post('/preferences/:userId/resubscribe', async (req, res) => {
  try {
    const result = await preferencesManager.resubscribe(req.params.userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { UserPreferencesManager, router as preferencesRouter };