// Segment Integration for Event-Driven Onboarding
// Use Segment as the event source for Courier notifications

import Analytics from 'analytics-node';
import { CourierClient } from "@trycourier/courier";

class SegmentCourierIntegration {
  constructor(segmentWriteKey, courierApiKey) {
    this.analytics = new Analytics(segmentWriteKey);
    this.courier = CourierClient({
      authorizationToken: courierApiKey
    });
    
    // Map Segment events to Courier automations
    this.eventMappings = {
      'User Signed Up': 'onboarding-welcome-flow',
      'Trial Started': 'trial-onboarding-flow',
      'Team Member Invited': 'team-growth-notification',
      'Project Created': 'first-project-celebration',
      'Integration Connected': 'integration-success-flow',
      'Subscription Upgraded': 'plan-upgrade-flow',
      'Feature Used': 'feature-education-flow',
      'Payment Method Added': 'payment-confirmation',
      'Milestone Reached': 'milestone-celebration'
    };
  }

  // Track event in Segment and trigger Courier
  async track(userId, event, properties = {}) {
    // Send to Segment
    this.analytics.track({
      userId: userId,
      event: event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        source: 'onboarding-system'
      }
    });

    // Trigger Courier automation if mapped
    if (this.eventMappings[event]) {
      await this.triggerCourierAutomation(userId, event, properties);
    }

    // Update Courier profile with Segment traits
    await this.syncProfileToCourier(userId, properties);
  }

  // Identify user in Segment and sync to Courier
  async identify(userId, traits = {}) {
    // Send to Segment
    this.analytics.identify({
      userId: userId,
      traits: {
        ...traits,
        createdAt: traits.createdAt || new Date().toISOString()
      }
    });

    // Create/update Courier profile
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: this.mapSegmentTraitsToCourier(traits)
    });
  }

  // Group call for B2B companies
  async group(userId, groupId, traits = {}) {
    // Send to Segment
    this.analytics.group({
      userId: userId,
      groupId: groupId,
      traits: {
        ...traits,
        name: traits.company || traits.name,
        plan: traits.plan || 'free',
        industry: traits.industry
      }
    });

    // Update Courier profile with company info
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: {
        company_id: groupId,
        company_name: traits.company || traits.name,
        company_plan: traits.plan,
        company_size: traits.employees,
        company_industry: traits.industry,
        tenant_id: groupId // For multi-tenant setup
      }
    });

    // Trigger company-specific onboarding if new
    if (traits.isNewCompany) {
      await this.triggerCompanyOnboarding(groupId, traits);
    }
  }

  // Page tracking for behavioral triggers
  async page(userId, category, name, properties = {}) {
    // Send to Segment
    this.analytics.page({
      userId: userId,
      category: category,
      name: name,
      properties: properties
    });

    // Track engagement in Courier
    await this.trackEngagement(userId, 'page_view', {
      page_category: category,
      page_name: name,
      ...properties
    });

    // Trigger contextual help if on key pages
    await this.triggerContextualHelp(userId, name, properties);
  }

  // Webhook handler for Segment events
  async handleSegmentWebhook(req, res) {
    const { type, userId, anonymousId, event, properties, traits } = req.body;

    try {
      switch (type) {
        case 'identify':
          await this.handleIdentify(userId || anonymousId, traits);
          break;
          
        case 'track':
          await this.handleTrack(userId || anonymousId, event, properties);
          break;
          
        case 'group':
          await this.handleGroup(userId || anonymousId, req.body.groupId, traits);
          break;
          
        case 'page':
        case 'screen':
          await this.handlePageView(userId || anonymousId, properties);
          break;
          
        default:
          console.log(`Unhandled Segment event type: ${type}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing Segment webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Handle identify events from Segment
  async handleIdentify(userId, traits) {
    // Map and store user traits in Courier
    const courierProfile = this.mapSegmentTraitsToCourier(traits);
    
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: courierProfile
    });

    // Trigger onboarding if new user
    if (traits.createdAt && this.isNewUser(traits.createdAt)) {
      await this.courier.automations.invoke({
        automation: "onboarding-welcome-flow",
        profile: { user_id: userId },
        data: {
          source: 'segment',
          traits: traits
        }
      });
    }
  }

  // Handle track events from Segment
  async handleTrack(userId, event, properties) {
    // Check if event should trigger notification
    const automation = this.eventMappings[event];
    
    if (automation) {
      await this.courier.automations.invoke({
        automation: automation,
        profile: { user_id: userId },
        data: {
          event: event,
          properties: properties,
          source: 'segment'
        }
      });
    }

    // Special handling for key events
    await this.handleSpecialEvents(userId, event, properties);
  }

  // Handle special events that need custom logic
  async handleSpecialEvents(userId, event, properties) {
    switch (event) {
      case 'Trial Started':
        await this.startTrialSequence(userId, properties);
        break;
        
      case 'Feature Adopted':
        await this.celebrateFeatureAdoption(userId, properties);
        break;
        
      case 'Churn Risk Detected':
        await this.triggerRetentionFlow(userId, properties);
        break;
        
      case 'Milestone Reached':
        await this.sendMilestoneReward(userId, properties);
        break;
        
      case 'Support Ticket Created':
        await this.escalateToSupport(userId, properties);
        break;
    }
  }

  // Start trial-specific onboarding sequence
  async startTrialSequence(userId, properties) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + (properties.trialDays || 14));

    await this.courier.profiles.merge({
      recipientId: userId,
      profile: {
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        trial_plan: properties.plan || 'pro',
        conversion_likelihood: 'unknown'
      }
    });

    // Schedule trial emails
    await this.courier.automations.invoke({
      automation: "trial-nurture-sequence",
      profile: { user_id: userId },
      data: {
        trial_length: properties.trialDays || 14,
        features_to_highlight: this.getTrialFeatures(properties.plan)
      }
    });
  }

  // Map Segment traits to Courier profile fields
  mapSegmentTraitsToCourier(traits) {
    return {
      email: traits.email,
      phone_number: traits.phone,
      name: traits.name || `${traits.firstName} ${traits.lastName}`.trim(),
      first_name: traits.firstName,
      last_name: traits.lastName,
      company: traits.company,
      title: traits.title,
      avatar_url: traits.avatar,
      timezone: traits.timezone,
      locale: traits.locale,
      
      // Custom fields
      plan: traits.plan,
      mrr: traits.monthlyRevenue,
      ltv: traits.lifetimeValue,
      created_at: traits.createdAt,
      
      // Behavioral data
      last_seen: traits.lastSeen,
      session_count: traits.sessionCount,
      total_spent: traits.totalSpent,
      
      // Preferences
      email_frequency: traits.emailFrequency || 'normal',
      channels_preferred: traits.preferredChannels || ['email'],
      
      // Segment-specific
      segment_anonymous_id: traits.anonymousId,
      segment_group_id: traits.groupId
    };
  }

  // Sync Segment Personas to Courier for targeting
  async syncSegmentPersonas() {
    // This would integrate with Segment Personas API
    // to sync computed traits and audiences
    
    const personas = await this.getSegmentPersonas();
    
    for (const persona of personas) {
      const users = await this.getUsersInPersona(persona.id);
      
      for (const userId of users) {
        await this.courier.profiles.merge({
          recipientId: userId,
          profile: {
            personas: persona.name,
            persona_traits: persona.traits
          }
        });
      }
    }
  }

  // Track engagement back to Segment
  async trackEngagement(userId, action, properties = {}) {
    this.analytics.track({
      userId: userId,
      event: `Notification ${action}`,
      properties: {
        ...properties,
        channel: properties.channel || 'email',
        template: properties.template,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Trigger contextual help based on page views
  async triggerContextualHelp(userId, pageName, properties) {
    const helpTriggers = {
      '/settings/integrations': 'integration-help',
      '/team/invite': 'team-setup-guide',
      '/billing': 'billing-faq',
      '/api/docs': 'api-quickstart'
    };

    const helpTemplate = helpTriggers[pageName];
    
    if (helpTemplate) {
      // Check if user has been on page for more than 30 seconds
      setTimeout(async () => {
        const stillOnPage = await this.checkIfStillOnPage(userId, pageName);
        
        if (stillOnPage) {
          await this.courier.send({
            message: {
              template: helpTemplate,
              to: { user_id: userId },
              channels: ['inbox'],
              data: {
                page: pageName,
                context: properties
              }
            }
          });
        }
      }, 30000);
    }
  }

  // Helper methods
  isNewUser(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursSinceCreation = (now - created) / (1000 * 60 * 60);
    return hoursSinceCreation < 1;
  }

  getTrialFeatures(plan) {
    const features = {
      'pro': ['advanced_analytics', 'team_collaboration', 'integrations'],
      'enterprise': ['sso', 'api_access', 'dedicated_support', 'custom_contracts'],
      'starter': ['basic_features', 'email_support']
    };
    return features[plan] || features['starter'];
  }

  async triggerCompanyOnboarding(groupId, traits) {
    // Create company-wide onboarding campaign
    await this.courier.automations.invoke({
      automation: "company-onboarding",
      profile: { company_id: groupId },
      data: {
        company_name: traits.name,
        company_size: traits.employees,
        industry: traits.industry,
        plan: traits.plan
      }
    });
  }

  async checkIfStillOnPage(userId, pageName) {
    // Implementation would check user's current page
    // This is a placeholder
    return true;
  }

  async getSegmentPersonas() {
    // Placeholder for Segment Personas API integration
    return [];
  }

  async getUsersInPersona(personaId) {
    // Placeholder for getting users in a Segment Persona
    return [];
  }

  async triggerCourierAutomation(userId, event, properties) {
    const automation = this.eventMappings[event];
    
    if (automation) {
      await this.courier.automations.invoke({
        automation: automation,
        profile: { user_id: userId },
        data: {
          trigger_event: event,
          event_properties: properties,
          source: 'segment'
        }
      });
    }
  }

  async syncProfileToCourier(userId, properties) {
    // Extract relevant properties for profile update
    const profileUpdates = {};
    
    if (properties.email) profileUpdates.email = properties.email;
    if (properties.name) profileUpdates.name = properties.name;
    if (properties.company) profileUpdates.company = properties.company;
    if (properties.plan) profileUpdates.plan = properties.plan;
    
    if (Object.keys(profileUpdates).length > 0) {
      await this.courier.profiles.merge({
        recipientId: userId,
        profile: profileUpdates
      });
    }
  }

  async celebrateFeatureAdoption(userId, properties) {
    await this.courier.send({
      message: {
        template: "feature-adoption-celebration",
        to: { user_id: userId },
        data: {
          feature_name: properties.feature,
          usage_count: properties.usageCount
        }
      }
    });
  }

  async triggerRetentionFlow(userId, properties) {
    await this.courier.automations.invoke({
      automation: "retention-campaign",
      profile: { user_id: userId },
      data: {
        risk_score: properties.riskScore,
        last_active: properties.lastActive
      }
    });
  }

  async sendMilestoneReward(userId, properties) {
    await this.courier.send({
      message: {
        template: "milestone-reward",
        to: { user_id: userId },
        data: {
          milestone: properties.milestone,
          reward: properties.reward
        }
      }
    });
  }

  async escalateToSupport(userId, properties) {
    await this.courier.send({
      message: {
        template: "support-ticket-created",
        to: { 
          user_id: userId,
          slack: {
            channel: "#support"
          }
        },
        data: properties
      }
    });
  }
}

export default SegmentCourierIntegration;