// Webhook Handler for Courier Events
// Process incoming webhooks from Courier for real-time event handling

import express from 'express';
import crypto from 'crypto';
import { CourierClient } from "@trycourier/courier";

const router = express.Router();
const courier = CourierClient({
  authorizationToken: process.env.COURIER_AUTH_TOKEN
});

// Webhook signature verification
function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Main webhook handler
router.post('/webhooks/courier', async (req, res) => {
  const signature = req.headers['x-courier-signature'];
  const secret = process.env.COURIER_WEBHOOK_SECRET;
  
  // Verify webhook signature
  if (!verifyWebhookSignature(JSON.stringify(req.body), signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { type, data } = req.body;
  
  try {
    switch (type) {
      case 'message:sent':
        await handleMessageSent(data);
        break;
        
      case 'message:delivered':
        await handleMessageDelivered(data);
        break;
        
      case 'message:opened':
        await handleMessageOpened(data);
        break;
        
      case 'message:clicked':
        await handleMessageClicked(data);
        break;
        
      case 'message:undeliverable':
        await handleMessageUndeliverable(data);
        break;
        
      case 'inbox:read':
        await handleInboxRead(data);
        break;
        
      case 'inbox:archived':
        await handleInboxArchived(data);
        break;
        
      case 'preferences:updated':
        await handlePreferencesUpdated(data);
        break;
        
      case 'automation:completed':
        await handleAutomationCompleted(data);
        break;
        
      case 'automation:failed':
        await handleAutomationFailed(data);
        break;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Handle message sent event
async function handleMessageSent(data) {
  const { messageId, recipientId, template, channel, timestamp } = data;
  
  // Log to analytics
  await logAnalyticsEvent('message_sent', {
    message_id: messageId,
    user_id: recipientId,
    template: template,
    channel: channel,
    timestamp: timestamp
  });
  
  // Update user engagement tracking
  await updateUserEngagement(recipientId, 'message_sent', channel);
}

// Handle message delivered event
async function handleMessageDelivered(data) {
  const { messageId, recipientId, channel, provider, timestamp } = data;
  
  // Log successful delivery
  await logAnalyticsEvent('message_delivered', {
    message_id: messageId,
    user_id: recipientId,
    channel: channel,
    provider: provider,
    timestamp: timestamp
  });
  
  // Update delivery metrics
  await updateDeliveryMetrics(channel, provider, true);
}

// Handle message opened event
async function handleMessageOpened(data) {
  const { messageId, recipientId, template, channel, timestamp } = data;
  
  // This is a strong engagement signal
  await logAnalyticsEvent('message_opened', {
    message_id: messageId,
    user_id: recipientId,
    template: template,
    channel: channel,
    timestamp: timestamp
  });
  
  // Update user profile with engagement
  await courier.profiles.merge({
    recipientId: recipientId,
    profile: {
      last_email_opened: timestamp,
      email_engagement: 'active',
      engagement_score: await calculateEngagementScore(recipientId)
    }
  });
  
  // Check for follow-up actions
  await checkForFollowUpActions(recipientId, template);
}

// Handle message clicked event
async function handleMessageClicked(data) {
  const { messageId, recipientId, template, link, timestamp } = data;
  
  // Track click as conversion event
  await logAnalyticsEvent('message_clicked', {
    message_id: messageId,
    user_id: recipientId,
    template: template,
    clicked_link: link,
    timestamp: timestamp
  });
  
  // Update user profile
  await courier.profiles.merge({
    recipientId: recipientId,
    profile: {
      last_click: timestamp,
      clicked_links: [link],
      engagement_level: 'high'
    }
  });
  
  // Trigger click-based automations
  if (link.includes('/pricing')) {
    await triggerPricingInterestFlow(recipientId);
  } else if (link.includes('/demo')) {
    await triggerDemoRequestFlow(recipientId);
  }
}

// Handle undeliverable message
async function handleMessageUndeliverable(data) {
  const { messageId, recipientId, channel, reason, provider } = data;
  
  console.error(`Message undeliverable: ${messageId}`, reason);
  
  // Log failure
  await logAnalyticsEvent('message_failed', {
    message_id: messageId,
    user_id: recipientId,
    channel: channel,
    reason: reason,
    provider: provider
  });
  
  // Handle based on reason
  switch (reason) {
    case 'invalid_email':
    case 'hard_bounce':
      await handleInvalidEmail(recipientId);
      break;
      
    case 'soft_bounce':
    case 'temporary_failure':
      await scheduleRetry(messageId, recipientId);
      break;
      
    case 'unsubscribed':
      await handleUnsubscribe(recipientId, channel);
      break;
      
    default:
      await notifyOpsTeam(messageId, reason);
  }
  
  // Update delivery metrics
  await updateDeliveryMetrics(channel, provider, false);
}

// Handle inbox read event
async function handleInboxRead(data) {
  const { messageId, recipientId, timestamp } = data;
  
  // Track task completion
  await logAnalyticsEvent('inbox_task_completed', {
    message_id: messageId,
    user_id: recipientId,
    timestamp: timestamp
  });
  
  // Update onboarding progress
  const profile = await courier.profiles.get(recipientId);
  const taskId = data.metadata?.task_id;
  
  if (taskId) {
    await courier.profiles.merge({
      recipientId: recipientId,
      profile: {
        [`task_${taskId}_completed`]: true,
        [`task_${taskId}_completed_at`]: timestamp,
        onboarding_progress: calculateProgress(profile)
      }
    });
    
    // Check for milestone completion
    await checkMilestones(recipientId, taskId);
  }
}

// Handle inbox archived event
async function handleInboxArchived(data) {
  const { messageId, recipientId, timestamp } = data;
  
  await logAnalyticsEvent('inbox_message_archived', {
    message_id: messageId,
    user_id: recipientId,
    timestamp: timestamp
  });
}

// Handle preferences updated
async function handlePreferencesUpdated(data) {
  const { recipientId, preferences, timestamp } = data;
  
  // Log preference changes
  await logAnalyticsEvent('preferences_updated', {
    user_id: recipientId,
    preferences: preferences,
    timestamp: timestamp
  });
  
  // Update user profile
  await courier.profiles.merge({
    recipientId: recipientId,
    profile: {
      notification_preferences: preferences,
      preferences_updated_at: timestamp
    }
  });
  
  // Adjust future communications
  await adjustCommunicationStrategy(recipientId, preferences);
}

// Handle automation completed
async function handleAutomationCompleted(data) {
  const { automationId, recipientId, runId, completedSteps } = data;
  
  await logAnalyticsEvent('automation_completed', {
    automation_id: automationId,
    user_id: recipientId,
    run_id: runId,
    steps_completed: completedSteps.length
  });
  
  // Check for next automation in sequence
  await triggerNextAutomation(recipientId, automationId);
}

// Handle automation failed
async function handleAutomationFailed(data) {
  const { automationId, recipientId, runId, error, failedStep } = data;
  
  console.error(`Automation failed: ${automationId}`, error);
  
  await logAnalyticsEvent('automation_failed', {
    automation_id: automationId,
    user_id: recipientId,
    run_id: runId,
    error: error,
    failed_step: failedStep
  });
  
  // Notify ops team for critical automations
  if (isCriticalAutomation(automationId)) {
    await notifyOpsTeam(automationId, error);
  }
  
  // Attempt recovery
  await attemptAutomationRecovery(recipientId, automationId, failedStep);
}

// Helper functions
async function updateUserEngagement(userId, action, channel) {
  const engagementKey = `${channel}_${action}_count`;
  const profile = await courier.profiles.get(userId);
  const currentCount = profile[engagementKey] || 0;
  
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      [engagementKey]: currentCount + 1,
      last_engagement: new Date().toISOString()
    }
  });
}

async function calculateEngagementScore(userId) {
  const profile = await courier.profiles.get(userId);
  let score = 0;
  
  // Email engagement
  if (profile.email_opened_count > 0) score += 20;
  if (profile.email_clicked_count > 0) score += 30;
  
  // Inbox engagement
  if (profile.inbox_read_count > 0) score += 25;
  
  // Recency bonus
  const lastEngagement = new Date(profile.last_engagement);
  const daysSinceEngagement = (Date.now() - lastEngagement) / (1000 * 60 * 60 * 24);
  if (daysSinceEngagement < 1) score += 25;
  else if (daysSinceEngagement < 7) score += 15;
  
  return Math.min(score, 100);
}

async function checkForFollowUpActions(userId, template) {
  const followUpMap = {
    'welcome-email': 'onboarding-day-2',
    'trial-halfway': 'trial-urgency',
    'feature-announcement': 'feature-tutorial'
  };
  
  const nextTemplate = followUpMap[template];
  if (nextTemplate) {
    // Schedule follow-up for engaged users
    setTimeout(() => {
      courier.send({
        message: {
          to: { user_id: userId },
          template: nextTemplate,
          data: {
            triggered_by: 'engagement'
          }
        }
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}

async function handleInvalidEmail(userId) {
  // Mark email as invalid
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      email_valid: false,
      email_bounce_type: 'hard'
    }
  });
  
  // Try alternative channels
  const profile = await courier.profiles.get(userId);
  
  if (profile.phone_number) {
    await courier.send({
      message: {
        to: { user_id: userId },
        template: 'email-invalid-sms-fallback',
        channels: ['sms']
      }
    });
  }
}

async function scheduleRetry(messageId, userId) {
  // Implement exponential backoff
  const retryDelays = [
    5 * 60 * 1000,      // 5 minutes
    30 * 60 * 1000,     // 30 minutes
    2 * 60 * 60 * 1000, // 2 hours
    24 * 60 * 60 * 1000 // 24 hours
  ];
  
  const profile = await courier.profiles.get(userId);
  const retryCount = profile[`message_${messageId}_retry_count`] || 0;
  
  if (retryCount < retryDelays.length) {
    setTimeout(async () => {
      // Retry sending
      await courier.messages.retry(messageId);
      
      // Update retry count
      await courier.profiles.merge({
        recipientId: userId,
        profile: {
          [`message_${messageId}_retry_count`]: retryCount + 1
        }
      });
    }, retryDelays[retryCount]);
  }
}

async function checkMilestones(userId, completedTask) {
  const milestones = {
    'complete-profile': { points: 10, achievement: 'Profile Pro' },
    'invite-team': { points: 20, achievement: 'Team Builder' },
    'create-project': { points: 30, achievement: 'Project Master' }
  };
  
  const milestone = milestones[completedTask];
  if (milestone) {
    await courier.send({
      message: {
        to: { user_id: userId },
        template: 'milestone-achieved',
        data: {
          achievement: milestone.achievement,
          points: milestone.points
        },
        channels: ['inbox', 'email']
      }
    });
  }
}

async function triggerNextAutomation(userId, completedAutomation) {
  const automationSequence = {
    'onboarding-welcome-flow': 'onboarding-activation-flow',
    'trial-nurture-sequence': 'trial-conversion-sequence',
    'feature-education-flow': 'advanced-features-flow'
  };
  
  const nextAutomation = automationSequence[completedAutomation];
  if (nextAutomation) {
    await courier.automations.invoke({
      automation: nextAutomation,
      profile: { user_id: userId }
    });
  }
}

async function logAnalyticsEvent(event, data) {
  // Send to your analytics platform
  console.log(`Analytics: ${event}`, data);
  
  // Example: Send to Mixpanel, Amplitude, etc.
  // analytics.track(event, data);
}

async function updateDeliveryMetrics(channel, provider, success) {
  // Update delivery metrics in your database
  // This helps track provider performance
}

async function notifyOpsTeam(id, issue) {
  // Send alert to ops team
  await courier.send({
    message: {
      to: {
        slack: {
          channel: '#ops-alerts',
          access_token: process.env.SLACK_TOKEN
        }
      },
      template: 'ops-alert',
      data: {
        alert_id: id,
        issue: issue,
        timestamp: new Date().toISOString()
      }
    }
  });
}

function calculateProgress(profile) {
  const tasks = ['complete-profile', 'invite-team', 'create-project'];
  const completed = tasks.filter(task => profile[`task_${task}_completed`]).length;
  return (completed / tasks.length) * 100;
}

function isCriticalAutomation(automationId) {
  const criticalAutomations = [
    'enterprise-onboarding-flow',
    'payment-processing-flow',
    'security-alert-flow'
  ];
  return criticalAutomations.includes(automationId);
}

async function attemptAutomationRecovery(userId, automationId, failedStep) {
  // Implement recovery logic
  // Could retry the automation, skip the failed step, or trigger an alternative flow
}

async function triggerPricingInterestFlow(userId) {
  await courier.automations.invoke({
    automation: 'pricing-interest-nurture',
    profile: { user_id: userId }
  });
}

async function triggerDemoRequestFlow(userId) {
  await courier.automations.invoke({
    automation: 'demo-scheduling-flow',
    profile: { user_id: userId }
  });
}

async function handleUnsubscribe(userId, channel) {
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      [`${channel}_unsubscribed`]: true,
      [`${channel}_unsubscribed_at`]: new Date().toISOString()
    }
  });
}

async function adjustCommunicationStrategy(userId, preferences) {
  // Adjust frequency, channels, and timing based on preferences
  const strategy = {
    frequency: preferences.frequency || 'normal',
    channels: preferences.channels || ['email'],
    quiet_hours: preferences.quiet_hours || false
  };
  
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      communication_strategy: strategy
    }
  });
}

export default router;