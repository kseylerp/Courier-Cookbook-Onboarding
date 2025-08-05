# Building Intelligent Onboarding with Courier: A Developer's Guide

## Introduction

Picture this: You're the engineering lead at a B2B SaaS company. Your product team just handed you requirements for a "world-class onboarding experience" that needs to guide users from signup to their first value moment. The checklist is daunting with personalized multi-step email sequences that adapt to user behavior, in-app task lists that sync with email notifications, automatic escalation to Slack when high-value accounts get stuck, different onboarding flows for different customer segments, mobile push notifications that complement other channels, and real-time tracking of what's working and what's not.

Building this from scratch would take months of engineering time, require maintaining multiple notification systems, and create a maze of conditional logic. You'd need to integrate with email providers, build state machines for multi-step flows, implement retry logic for failed deliveries, create branching logic for different user paths, and somehow make it all work across web and mobile. And that's before you even think about analytics and ongoing maintenence. 

This cookbook shows you how to build this entire onboarding system using Courier's orchestration platform. We'll create an intelligent, multi-channel onboarding flow that adapts to user behavior, escalates when needed, and actually helps your users succeed with your product. More importantly, we'll build it in a way that your product team can iterate on without constantly pulling in engineering resources.

## What We're Building

We'll construct an onboarding system for a fictional B2B collaboration platform called "TeamSync." The system we build will trigger automatically when users complete product actions like signup, team invites, or project creation. It will send multi-step email sequences that adapt based on user progress and route through appropriate channels starting with email, falling back to in-app notifications, then SMS, and finally escalating to Slack for high-value accounts.

The system will create branching paths based on user type and behavior, manage tasks through Courier Inbox for a unified experience, support multiple tenants with customized flows per customer segment, and work seamlessly on mobile through native SDKs. By the end of this guide, you'll have a production-ready onboarding system that would typically take a team months to build.

## Setup

First, let's install the necessary dependencies and configure our environment. We'll need the Courier SDK for our backend, the React components for our frontend inbox, and the mobile SDK for our native apps:

```bash
# Install Courier SDK for your backend
npm install @trycourier/courier
# For React frontend (Inbox component)
npm install @trycourier/react-provider @trycourier/react-inbox
# For mobile
npm install @trycourier/courier-react-native
```

Now let's initialize Courier with our authentication token. For multi-tenant scenarios, we'll also set up tenant-specific configurations:

```javascript
// Initialize Courier
import { CourierClient } from "@trycourier/courier";

const courier = CourierClient({
  authorizationToken: process.env.COURIER_AUTH_TOKEN
});

// For multi-tenant setup, we'll also configure tenant-specific tokens
const tenantTokens = {
  enterprise: process.env.COURIER_ENTERPRISE_TOKEN,
  startup: process.env.COURIER_STARTUP_TOKEN,
  trial: process.env.COURIER_TRIAL_TOKEN
};
```

## Part 1: Event-Driven Onboarding Triggers

The foundation of great onboarding is responding to what users actually do, not just sending time-based drip campaigns that ignore user behavior. Traditional onboarding systems often rely on rigid schedules - send email 1 on day 1, email 2 on day 3, and so on. This approach ignores whether users have actually taken any meaningful actions in your product.

Instead, we want our onboarding to be reactive and intelligent. When a user signs up but doesn't invite their team within 24 hours, we should nudge them differently than a user who invited 10 team members in their first hour. When an enterprise customer gets stuck, we should escalate to human support rather than sending another automated email into the void.

Let's build an event tracking system that captures these key moments and triggers appropriate onboarding flows:

```javascript
// Track key onboarding events in your product
class OnboardingEvents {
  constructor(courier, userId, tenantId) {
    this.courier = courier;
    this.userId = userId;
    this.tenantId = tenantId;
  }

  async userSignedUp(userData) {
    // Create or update user profile with traits
    await this.courier.profiles.merge({
      recipientId: this.userId,
      profile: {
        email: userData.email,
        name: userData.name,
        company: userData.company,
        role: userData.role,
        signupDate: new Date().toISOString(),
        plan: userData.plan,
        tenant: this.tenantId
      }
    });

    // Trigger onboarding automation
    await this.courier.automations.invoke({
      automation: "onboarding-welcome-flow",
      profile: { user_id: this.userId },
      data: {
        trigger: "user_signup",
        plan: userData.plan,
        company_size: userData.companySize
      }
    });
  }

  async teamMemberInvited(inviteData) {
    await this.courier.send({
      message: {
        template: "team-growth-milestone",
        to: { user_id: this.userId },
        data: {
          invites_sent: inviteData.count,
          team_size: inviteData.teamSize
        }
      }
    });
  }

  async firstProjectCreated(projectData) {
    // Update user profile to mark milestone
    await this.courier.profiles.merge({
      recipientId: this.userId,
      profile: {
        onboarding_status: "project_created",
        first_project_date: new Date().toISOString()
      }
    });

    // Trigger next phase of onboarding
    await this.courier.automations.invoke({
      automation: "post-activation-flow",
      profile: { user_id: this.userId },
      data: projectData
    });
  }
}
```

Notice how each event not only triggers a notification but also updates the user's profile with behavioral data. This creates a rich user profile that future automations can use to make intelligent decisions. The `userSignedUp` method stores plan information that determines whether this user gets enterprise onboarding or standard flows. The `firstProjectCreated` method marks a critical activation milestone that can trigger congratulatory messages or next-step guidance.

## Part 2: Multi-Step Email Sequences with Intelligent Timing

Now that we're capturing user events, let's build sophisticated email sequences that adapt to user behavior. The challenge with multi-step onboarding is that users progress at different speeds. Some dive in immediately and need advanced features explained on day two. Others sign up and disappear for a week before returning.

Traditional email automation tools force you to choose between time-based delays (send email 2 after 3 days) or action-based triggers (send email 2 after user does X). With Courier's Automations, we can combine both approaches with conditional logic that creates truly adaptive flows.

Here's how we build an intelligent welcome flow that respects user engagement:

```javascript
// Define the welcome flow automation template
const welcomeFlowAutomation = {
  steps: [
    {
      action: "send",
      template: "welcome-email",
      channels: ["email"],
      data: {
        dynamicContent: {
          enterprise: "welcome-enterprise-content",
          startup: "welcome-startup-content",
          trial: "welcome-trial-content"
        }
      }
    },
    {
      action: "wait",
      duration: "24 hours"
    },
    {
      action: "condition",
      if: {
        // Check if user has logged in
        profile: { last_login: { exists: true } }
      },
      then: [
        {
          action: "send",
          template: "setup-guide",
          channels: ["email", "inbox"]
        }
      ],
      else: [
        {
          action: "send",
          template: "login-reminder",
          channels: ["email"]
        },
        {
          action: "wait",
          duration: "48 hours"
        },
        {
          action: "escalate",
          template: "dormant-user-alert",
          channels: ["slack"]
        }
      ]
    }
  ]
};
```

This automation demonstrates several powerful concepts. First, the initial welcome email uses dynamic content based on the user's plan. Enterprise customers see different value propositions than trial users. After 24 hours, we check if the user has actually logged in. Active users receive a setup guide to help them get value quickly. Inactive users get a gentle reminder, and if they remain dormant, we escalate to our success team via Slack.

## Part 3: Smart Channel Routing

One of the most frustrating aspects of building notification systems is managing channel fallbacks and routing. Should this message go to email? What if the user has the mobile app - should we send a push notification instead? What about critical alerts that need multiple channels?

The typical approach involves writing complex if/else logic scattered throughout your codebase. You end up with code that checks user preferences, validates contact information, handles provider failures, and manages timing between channels. It becomes a nightmare to maintain and even harder to modify when product requirements change.

Courier's routing engine solves this elegantly. You define your routing logic once, and Courier handles the complexity of channel selection, fallbacks, and delivery optimization. Here's how to implement smart routing that ensures messages reach users through their preferred channels:

```javascript
const sendWithRouting = async (userId, notification) => {
  const routing = {
    // Always send to inbox for in-app visibility
    inbox: { 
      override: { 
        inbox: { 
          title: notification.title,
          preview: notification.preview 
        } 
      } 
    },
    
    // Email with smart fallback
    email: {
      override: {
        email: {
          subject: notification.subject,
          preheader: notification.preview
        }
      },
      if: { preferences: { channel: "email" } }
    },
    
    // SMS for critical actions only
    sms: {
      override: {
        sms: {
          body: notification.smsBody
        }
      },
      if: { 
        AND: [
          { data: { priority: "critical" } },
          { profile: { phone_number: { exists: true } } }
        ]
      }
    },
    
    // Push for mobile users
    push: {
      override: {
        apn: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.preview
            }
          }
        }
      },
      if: { profile: { push_token: { exists: true } } }
    }
  };

  return await courier.send({
    message: {
      template: notification.template,
      to: { user_id: userId },
      data: notification.data,
      routing,
      timeout: {
        channel: 3600000, // 1 hour per channel
        provider: 300000  // 5 minutes per provider
      }
    }
  });
};
```

This routing configuration embodies several best practices. Every message goes to the inbox, creating a persistent record users can reference later. Email only sends if users prefer that channel. SMS is reserved for critical notifications and only if we have a valid phone number. Push notifications automatically route to mobile users. The timeout settings ensure we don't wait forever for a channel to respond before trying the next option.

## Part 4: Conditional Paths and Personalization

Great onboarding feels personal and relevant. Generic "one size fits all" flows frustrate power users who want to dive deep quickly, while overwhelming casual users who need gentle guidance. The challenge is creating these personalized experiences without building entirely separate systems for each user segment.

This is where conditional logic and dynamic content become essential. Instead of maintaining multiple onboarding flows, we create one intelligent system that adapts based on user characteristics and behavior. Let's implement branching logic that creates different experiences for different users:

```javascript
class PersonalizedOnboarding {
  async determineUserPath(userId) {
    const profile = await courier.profiles.get(userId);
    
    // Define paths based on user traits
    const paths = {
      enterprise: {
        condition: profile.company_size > 100,
        flow: "enterprise-onboarding",
        features: ["sso_setup", "team_hierarchy", "compliance_docs"]
      },
      power_user: {
        condition: profile.role === "admin" && profile.technical_level === "high",
        flow: "technical-onboarding", 
        features: ["api_docs", "webhook_setup", "advanced_config"]
      },
      standard: {
        condition: true, // default
        flow: "standard-onboarding",
        features: ["basic_setup", "first_project", "invite_team"]
      }
    };

    // Select appropriate path
    const selectedPath = Object.values(paths).find(path => path.condition) || paths.standard;
    
    // Trigger path-specific automation
    await courier.automations.invoke({
      automation: selectedPath.flow,
      profile: { user_id: userId },
      data: {
        features_to_highlight: selectedPath.features,
        personalization: {
          company_name: profile.company,
          user_name: profile.name,
          use_case: profile.primary_use_case
        }
      }
    });
  }

  async createDynamicContent(template, userData) {
    // Use Courier's template variables for personalization
    const personalizedTemplate = {
      email: {
        subject: `{{name}}, let's get {{company}} up and running`,
        body: {
          blocks: [
            {
              type: "text",
              content: `Hi {{name}},\n\nWelcome to TeamSync! Since you're 
                       {{#if is_enterprise}}managing a large team{{else}}getting started{{/if}}, 
                       we've customized your onboarding to focus on what matters most.`
            },
            {
              type: "action",
              content: "Complete Your Setup",
              href: "{{setup_link}}?priority={{recommended_features}}"
            }
          ]
        }
      }
    };

    return personalizedTemplate;
  }
}
```

The beauty of this approach is its flexibility. Enterprise users automatically get onboarding that focuses on SSO setup and compliance documentation. Technical users see API documentation and webhook configuration. Everyone else gets the standard flow. The content itself adapts using Courier's template variables, so messages feel personally crafted even though they're generated from templates.

## Part 5: Courier Inbox for Task Management

Email is great for notifications, but terrible for task management. Users lose track of what they need to do, emails get buried, and there's no sense of progress. This is why many modern SaaS products include an in-app notification center or task list for onboarding.

Building this from scratch requires significant frontend and backend work. You need to create UI components, manage read/unread states, handle real-time updates, and sync across devices. [Courier Inbox](https://www.courier.com/docs/platform/inbox/inbox-overview) provides all of this out of the box, transforming onboarding from a series of disconnected emails into an interactive checklist.

Let's implement an onboarding task system that lives inside your product:

```javascript
// Backend: Send onboarding tasks to Inbox
const createOnboardingTasks = async (userId, userPlan) => {
  const tasks = [
    {
      id: "complete-profile",
      title: "Complete your profile",
      priority: 1,
      action_url: "/settings/profile"
    },
    {
      id: "invite-team",
      title: "Invite your first team member",
      priority: 2,
      action_url: "/team/invite"
    },
    {
      id: "create-project",
      title: "Create your first project",
      priority: 3,
      action_url: "/projects/new"
    }
  ];

  // Add plan-specific tasks
  if (userPlan === "enterprise") {
    tasks.push({
      id: "schedule-onboarding",
      title: "Schedule onboarding call with success team",
      priority: 0,
      action_url: "/schedule-demo"
    });
  }

  // Send tasks to Inbox with metadata
  for (const task of tasks) {
    await courier.send({
      message: {
        template: "onboarding-task",
        to: { user_id: userId },
        channels: ["inbox"],
        data: task,
        metadata: {
          tags: ["onboarding", `priority-${task.priority}`]
        }
      }
    });
  }
};
```

The frontend implementation is remarkably simple. Courier provides React components that handle all the complexity of real-time updates, state management, and user interactions:

```jsx
// Frontend: Display tasks in React app
import { Inbox } from "@trycourier/react-inbox";

function OnboardingTasks() {
  return (
    <Inbox
      views={[
        {
          id: "onboarding",
          label: "Setup Tasks",
          params: { tags: ["onboarding"] }
        },
        {
          id: "completed",
          label: "Completed",
          params: { status: "read", tags: ["onboarding"] }
        }
      ]}
      onMessageClick={(message) => {
        // Navigate to task action
        if (message.data?.action_url) {
          window.location.href = message.data.action_url;
        }
        // Mark as completed
        message.markAsRead();
      }}
    />
  );
}
```

Users now have a persistent task list that tracks their progress. Unlike emails that disappear into the inbox abyss, these tasks remain visible until completed. The component automatically updates in real-time as users complete tasks, providing immediate feedback and a sense of accomplishment.

## Part 6: Slack Escalation for High-Value Accounts

Not all users are created equal. When a trial user gets stuck, an automated email reminder might suffice. But when an enterprise customer paying $100k annually can't figure out your product, you need human intervention fast. The challenge is identifying these situations automatically and routing them to the right people without overwhelming your success team with false alarms.

This is where intelligent escalation becomes crucial. By monitoring user behavior and profile data, we can automatically detect when high-value accounts need help and alert the appropriate team members. Here's how to build a Slack escalation system that your customer success team will actually appreciate:

```javascript
class SlackEscalation {
  constructor(courier, slackWebhook) {
    this.courier = courier;
    this.slackWebhook = slackWebhook;
  }

  async checkAndEscalate(userId) {
    const profile = await this.courier.profiles.get(userId);
    
    // Define escalation criteria
    const shouldEscalate = 
      profile.plan === "enterprise" &&
      profile.onboarding_status !== "completed" &&
      profile.days_since_signup > 3 &&
      !profile.escalated;

    if (shouldEscalate) {
      // Send to customer success team
      await this.courier.send({
        message: {
          template: "enterprise-stuck-alert",
          to: { 
            slack: {
              channel: "#customer-success",
              webhook_url: this.slackWebhook
            }
          },
          data: {
            customer_name: profile.company,
            contact_name: profile.name,
            contact_email: profile.email,
            signup_date: profile.signupDate,
            last_activity: profile.last_login,
            blockers: await this.identifyBlockers(userId)
          },
          providers: {
            slack: {
              override: {
                attachments: [{
                  color: "warning",
                  fields: [
                    {
                      title: "Account Value",
                      value: `$${profile.account_value}/year`,
                      short: true
                    },
                    {
                      title: "Onboarding Progress",
                      value: `${profile.onboarding_progress}%`,
                      short: true
                    }
                  ],
                  actions: [
                    {
                      type: "button",
                      text: "View Customer Profile",
                      url: `https://app.teamsync.com/admin/customers/${userId}`
                    },
                    {
                      type: "button", 
                      text: "Schedule Call",
                      url: `https://calendly.com/success-team/${userId}`
                    }
                  ]
                }]
              }
            }
          }
        }
      });

      // Mark as escalated to prevent duplicate alerts
      await this.courier.profiles.merge({
        recipientId: userId,
        profile: { escalated: true }
      });
    }
  }

  async identifyBlockers(userId) {
    // Analyze user activity to identify where they're stuck
    const logs = await this.courier.logs.list({
      recipient: userId,
      limit: 50
    });

    const blockers = [];
    
    // Check for common sticking points
    if (!logs.some(log => log.event === "team_invited")) {
      blockers.push("Haven't invited team members");
    }
    
    if (!logs.some(log => log.event === "project_created")) {
      blockers.push("Haven't created first project");
    }

    return blockers;
  }
}
```

This escalation system is smart about what it escalates and how. It only triggers for enterprise customers who haven't completed onboarding within three days. The Slack message includes actionable information like account value and specific blockers. The action buttons let success team members jump directly to the customer profile or schedule a call. Most importantly, it marks users as escalated to prevent alert fatigue from duplicate notifications.

## Part 7: Multi-Tenant Configuration

B2B SaaS products often serve dramatically different customer segments. Your enterprise customers expect white-glove service, custom branding, and dedicated support channels. Startups want self-service tools and community resources. Trial users need convincing before they commit. Building three separate onboarding systems would be a maintenance nightmare.

[Multi-tenant configuration](https://www.courier.com/docs/platform/tenants/tenants-overview) in Courier lets you create these differentiated experiences while maintaining a single codebase. Each tenant can have its own branding, email settings, and onboarding flows. Here's how to implement a multi-tenant onboarding system that scales:

```javascript
class MultiTenantOnboarding {
  constructor(courier) {
    this.courier = courier;
    this.tenantConfigs = {
      enterprise: {
        branding: {
          primary_color: "#1a1a2e",
          logo_url: "https://assets.teamsync.com/enterprise-logo.png"
        },
        email_settings: {
          from_name: "TeamSync Enterprise Success",
          from_email: "success@teamsync.com",
          footer: "enterprise-footer-template"
        },
        onboarding_flow: "enterprise-high-touch",
        features: ["dedicated_support", "sso", "advanced_analytics"]
      },
      startup: {
        branding: {
          primary_color: "#00d4ff",
          logo_url: "https://assets.teamsync.com/startup-logo.png"
        },
        email_settings: {
          from_name: "TeamSync Team",
          from_email: "hello@teamsync.com",
          footer: "standard-footer-template"
        },
        onboarding_flow: "self-serve-quick-start",
        features: ["collaboration", "integrations", "automation"]
      }
    };
  }

  async sendTenantNotification(userId, tenantId, notification) {
    const config = this.tenantConfigs[tenantId];
    
    // Send with tenant-specific configuration
    await this.courier.send({
      message: {
        template: notification.template,
        to: { 
          user_id: userId,
          tenant_id: tenantId
        },
        data: {
          ...notification.data,
          features: config.features
        },
        tenant: tenantId,
        brand: config.branding.brand_id
      }
    });
  }

  async createTenantBrand(tenantId) {
    const config = this.tenantConfigs[tenantId];
    
    // Create tenant-specific brand
    const brand = await this.courier.brands.create({
      name: `${tenantId}-brand`,
      settings: {
        colors: {
          primary: config.branding.primary_color
        },
        email: {
          header: {
            logo: { href: config.branding.logo_url }
          },
          footer: config.email_settings.footer
        }
      }
    });

    // Store brand ID for future use
    this.tenantConfigs[tenantId].branding.brand_id = brand.id;
  }
}
```

Each tenant configuration encapsulates everything unique about that customer segment. Enterprise customers see emails from "Enterprise Success" with formal branding. Startups get a more casual tone and vibrant colors. The onboarding flows themselves differ, with enterprise customers receiving high-touch experiences while startups get quick-start guides. All of this complexity is hidden behind a simple tenant ID, making it easy to add new segments as your business grows.

## Part 8: Mobile Experience with Native SDKs

Mobile onboarding presents unique challenges. Users download your app with high intent but low context. They need immediate value without lengthy setup processes. Push notifications can re-engage them, but only if used judiciously. The technical challenge is coordinating onboarding across web and mobile while respecting platform differences.

Courier's [mobile SDKs](https://www.courier.com/docs/platform/inbox/mobile/ios-sdk) solve this by extending your onboarding system to native apps with minimal additional code. The same tasks, notifications, and user profiles work across all platforms. Here's how to implement mobile onboarding that feels native:

```javascript
// React Native implementation
import { CourierProvider, CourierInbox } from '@trycourier/courier-react-native';

function MobileOnboarding() {
  return (
    <CourierProvider
      clientKey={process.env.COURIER_CLIENT_KEY}
      userId={currentUser.id}
      wsUrl="wss://realtime.courier.com">
      
      <OnboardingScreen />
    </CourierProvider>
  );
}

function OnboardingScreen() {
  const { messages, markAsRead } = CourierInbox.useInbox();
  
  // Filter onboarding tasks
  const onboardingTasks = messages.filter(msg => 
    msg.metadata?.tags?.includes('onboarding')
  );

  return (
    <View>
      <Text>Welcome to TeamSync! Let's get you started:</Text>
      
      {onboardingTasks.map(task => (
        <TaskCard
          key={task.messageId}
          title={task.title}
          completed={task.read}
          onPress={() => {
            // Navigate to task screen
            navigation.navigate(task.data.action_url);
            // Mark task as completed
            markAsRead(task.messageId);
          }}
        />
      ))}
      
      <ProgressBar 
        progress={onboardingTasks.filter(t => t.read).length / onboardingTasks.length}
      />
    </View>
  );
}

// Push notification handling
const configurePushNotifications = async () => {
  const token = await registerForPushNotifications();
  
  // Save token to user profile
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      ios_push_token: token,
      push_enabled: true
    }
  });
};
```

The mobile implementation reuses all the backend logic we've already built. Tasks created on the web appear instantly in the mobile app. When users complete tasks on mobile, their progress syncs everywhere. Push notifications automatically route to users who have the app installed, while others receive emails. This creates a cohesive experience regardless of how users access your product.

## Part 9: Analytics and Optimization

Building onboarding is only the beginning. The real work is understanding what's effective and continuously improving. Traditional analytics tools show you page views and button clicks, but they don't tell you if your onboarding is actually working. Are users completing the flows? Which channels are most effective? Where do users get stuck?

Courier provides built-in analytics for every message and automation. You can track engagement rates, completion times, and user paths without implementing custom analytics. Here's how to measure and optimize your onboarding performance:

```javascript
class OnboardingAnalytics {
  async trackEngagement(userId) {
    // Get user's message history
    const logs = await this.courier.logs.list({
      recipient: userId,
      start: "7d"  // Last 7 days
    });

    const metrics = {
      emails_sent: 0,
      emails_opened: 0,
      emails_clicked: 0,
      tasks_completed: 0,
      days_to_activation: null
    };

    logs.results.forEach(log => {
      if (log.type === "message") metrics.emails_sent++;
      if (log.opened_at) metrics.emails_opened++;
      if (log.clicked_at) metrics.emails_clicked++;
      if (log.channel === "inbox" && log.read_at) metrics.tasks_completed++;
    });

    // Calculate activation time
    const profile = await this.courier.profiles.get(userId);
    if (profile.first_project_date) {
      const signup = new Date(profile.signupDate);
      const activation = new Date(profile.first_project_date);
      metrics.days_to_activation = Math.floor((activation - signup) / (1000 * 60 * 60 * 24));
    }

    return metrics;
  }

  async generateCohortReport(startDate, endDate) {
    // Analyze onboarding performance by cohort
    const report = {
      total_users: 0,
      activated_users: 0,
      average_time_to_activation: 0,
      channel_effectiveness: {
        email: { sent: 0, engaged: 0 },
        inbox: { sent: 0, engaged: 0 },
        slack: { escalations: 0, resolved: 0 }
      }
    };

    // Process cohort data...
    return report;
  }
}
```

These analytics reveal insights that drive optimization. Maybe enterprise users engage more with in-app tasks than emails. Perhaps your day-three email has low open rates because users have already activated. Armed with this data, you can iterate on your onboarding without guessing what works.

## Testing Your Onboarding Flow

Before launching your onboarding system, thorough testing is essential. The complexity of multi-channel, multi-step flows means there are many potential failure points. Rather than discovering these in production, let's build a comprehensive testing strategy:

```javascript
// Test different user scenarios
const testOnboarding = async () => {
  const testUsers = [
    {
      id: "test-enterprise-user",
      profile: {
        email: "enterprise@test.com",
        company: "Big Corp",
        plan: "enterprise",
        company_size: 500
      }
    },
    {
      id: "test-startup-user", 
      profile: {
        email: "startup@test.com",
        company: "Small Co",
        plan: "startup",
        company_size: 10
      }
    }
  ];

  for (const user of testUsers) {
    // Create test user
    await courier.profiles.replace(user.id, user.profile);
    
    // Trigger onboarding
    const events = new OnboardingEvents(courier, user.id, user.profile.plan);
    await events.userSignedUp(user.profile);
    
    // Verify automation started
    console.log(`Started onboarding for ${user.id}`);
  }
};
```

Test users let you experience onboarding from different perspectives. Run through the enterprise flow to ensure high-touch elements work correctly. Test the startup flow for self-service effectiveness. Verify that escalations trigger appropriately and that tasks appear in the inbox. This testing phase often reveals edge cases and timing issues that would frustrate real users.

## Conclusion

You've now built a sophisticated onboarding system that would typically require months of engineering effort. The system responds intelligently to user behavior rather than following rigid schedules. It routes messages through the most effective channels while respecting user preferences. It escalates high-value accounts to human support when automation isn't enough. It provides differentiated experiences for different customer segments without maintaining separate codebases.

More importantly, you've built a system that's maintainable and extensible. Your product team can now iterate on onboarding sequences through Courier's visual tools without engineering involvement. Your success team receives actionable alerts when enterprise customers need help. Your mobile team can create native experiences that sync seamlessly with web onboarding. And you have comprehensive analytics to measure what's actually working.

The real magic is in what you didn't have to build. No state machines for managing multi-step flows. No retry logic for failed deliveries. No complex routing engines for channel selection. No synchronization systems for cross-platform experiences. Courier handles this complexity, letting you focus on crafting the perfect onboarding experience for your users.

Your onboarding is now a competitive advantage rather than a technical debt. As your product evolves and your user base grows, your onboarding system can adapt without massive rewrites. New channels, user segments, and automation flows are just configuration changes away. Most importantly, your users get an onboarding experience that actually helps them succeed with your product.

## Next Steps

Now that you have a working onboarding system, explore [Courier's automation designer](https://www.courier.com/docs/platform/automations/designer) for visual workflow creation that your product team can manage independently. Set up [preferences](https://www.courier.com/docs/platform/preferences/preferences-overview) to let users control their notification experience and reduce unsubscribes. Implement [guardrails](https://www.courier.com/docs/platform/sending/guardrails) to prevent notification fatigue while ensuring important messages get through.

The onboarding system you've built today is just the beginning. As you gather data and user feedback, you'll discover new opportunities to help users succeed. With Courier's platform handling the technical complexity, you're free to focus on what matters most: creating experiences that turn signups into successful, long-term customers.

Happy building! 🚀
