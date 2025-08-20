# Building Multi-Channel Onboarding with Courier: A Developer's Guide

## Introduction

As developers, we know that great user onboarding is the difference between users who stick around and those who disappear after signup. But building a proper onboarding system means juggling multiple notification channels, tracking user progress, personalizing content based on user type, and somehow making it all work across web and mobile.

The traditional approach involves stitching together email providers, building state machines for multi-step flows, implementing retry logic, and creating branching logic for different user paths. This guide shows you how to build a complete onboarding system using Courier's platform - handling all the complex orchestration while you focus on the user experience.

## What We'll Build

We'll create an onboarding system that:
- Triggers automatically based on user actions (signup, invites, first project)
- Sends multi-step sequences that adapt to user behavior
- Routes through the right channels (email, in-app, push, SMS)
- Personalizes content based on user segments
- Escalates to your team when high-value users need help
- Works seamlessly across web and mobile
- Tracks what's working through built-in analytics

Throughout this guide, we'll use a fictional B2B SaaS platform as our example, but these patterns apply to any product that needs sophisticated onboarding. You'll see real Courier SDK code that you can adapt to your needs, along with explanations of why each piece matters for your users.

[PLACEHOLDER: High-level architecture diagram showing user events flowing through Courier to various channels]

## Setup

First, let's get the foundations in place. Install the Courier SDK for your platform:

```bash
npm install @trycourier/courier                  # Backend SDK
npm install @trycourier/react-inbox              # React components
npm install @trycourier/courier-react-native     # Mobile SDK
```

Now initialize Courier with your authentication token:

```javascript
const { CourierClient } = require("@trycourier/courier");
const courier = new CourierClient({ 
  authorizationToken: process.env.COURIER_AUTH_TOKEN
});
```

**Key configuration notes:**
- Store your auth token in environment variables, never in code
- For production, consider using different tokens for test/production environments
- The client handles retries and timeouts automatically

See the [authentication docs](https://www.courier.com/docs/reference/auth/intro/) for more setup options.

## Part 1: Event-Driven Onboarding

### Why Events Matter

Traditional onboarding sends emails on a fixed schedule - day 1, day 3, day 7. But your users don't follow schedules. Some dive in immediately and need advanced features explained. Others sign up and disappear for a week. Event-driven onboarding responds to what users actually do, creating a more relevant experience.

When you track user events, you can:
- Send the right message at the right time
- Skip irrelevant steps for power users
- Re-engage dormant users with targeted content
- Build user profiles that inform future communications

[PLACEHOLDER: Flow diagram showing different user paths based on their actions]

### Building Your Event System

Here's how to capture and respond to key user events:

```javascript
// When a user signs up, create their profile
await courier.profiles.merge({
  recipientId: userId,
      profile: {
        email: userData.email,
        name: userData.name,
        company: userData.company,
        plan: userData.plan,
    signupDate: new Date().toISOString()
  }
});

// Then trigger your welcome flow
await courier.automations.invoke({
  automation: "onboarding-welcome",
  profile: { user_id: userId },
      data: {
        plan: userData.plan,
        company_size: userData.companySize
      }
    });
```

**Customizing for your product:**
```
// Pseudo-code for your event handlers
ON user_signup:
  CREATE profile with user data
  START onboarding automation based on plan type
  
ON team_invite_sent:
  UPDATE profile.team_size
  IF first invite: SEND collaboration tips
  
ON first_project_created:
  UPDATE profile.activation_status = true
  START advanced_features automation
```

### Building Rich User Profiles

Every event updates the user profile, creating a complete picture of their journey. This accumulated data helps you make smarter decisions about what to send next:

- **Behavioral data**: Track actions like last_login, projects_created, team_invites_sent
- **Segment data**: Store plan_type, company_size, industry for personalization
- **Progress data**: Monitor onboarding_status, activation_date, feature_usage

These profiles become the foundation for all your routing and personalization decisions.

## Part 2: Multi-Step Email Sequences

### Creating Adaptive Flows

Your onboarding shouldn't be a one-size-fits-all drip campaign. Users progress at different speeds, and your sequences need to adapt. Courier's automations let you combine time-based delays with behavioral triggers, creating flows that feel personalized without building separate systems for each user type.

The key is balancing:
- **Time-based steps**: "Wait 24 hours" gives users time to explore
- **Behavioral checks**: "If user has logged in" ensures relevance
- **Conditional paths**: Different messages for different user states

[PLACEHOLDER: Visual flow showing a multi-step sequence with branches based on user behavior]

### Building Your First Automation

Here's a practical automation that adapts to user behavior:

```javascript
// Define your automation in Courier (via API or dashboard)
const welcomeFlow = {
  steps: [
    {
      action: "send",
      template: "welcome-email",
      channels: ["email"]
    },
    {
      action: "wait",
      duration: "24 hours"
    },
    {
      action: "condition",
      if: {
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
        }
      ]
    }
  ]
};
```

**Customizing for your onboarding:**
```
// Pseudo-code showing the flow logic
STEP 1: Send welcome email
STEP 2: Wait 24 hours
STEP 3: Check user activity
  IF user logged in:
    Send setup guide to help them get started
  ELSE:
    Send gentle reminder
    Optional: Escalate if enterprise customer
```

### Smart Timing Options

Courier supports various timing strategies to respect user preferences:

- **Simple delays**: `wait: "24 hours"` - straightforward and effective
- **Business hours**: Send during work hours in user's timezone
- **Batched delivery**: Group notifications to reduce noise
- **Smart send times**: Use engagement data to find optimal delivery windows

See the [automations documentation](https://www.courier.com/docs/platform/automations/) for more complex flow examples.

## Part 3: Smart Channel Routing

### Why Channel Strategy Matters

Not every message should go to email. Your power users might prefer Slack notifications. Mobile users need push notifications. Some messages are urgent enough for SMS. The challenge is routing each message through the right channel without building complex if/else logic throughout your codebase.

Courier's routing engine handles this complexity for you. You define your routing strategy once, and Courier automatically:
- Checks which channels are available for each user
- Respects user preferences
- Falls back to alternative channels if delivery fails
- Prevents channel fatigue with smart throttling

[PLACEHOLDER: Diagram showing message routing through different channels with fallback logic]

### Implementing Your Routing Strategy

Here's how to implement intelligent routing:

```javascript
const { requestId } = await courier.send({
  message: {
    to: {
      user_id: userId,
      email: "user@example.com",
      phone_number: "+1234567890"
    },
    template: "onboarding-task",
    data: {
      task_name: "Complete your profile",
      priority: "high"
    },
    routing: {
      method: "single",
      channels: ["email", "inbox", "sms"]
    },
      timeout: {
      channel: 3600000  // Try each channel for up to 1 hour
      }
    }
  });
```

**Building your routing logic:**
```
// Pseudo-code for common routing patterns

// Pattern 1: User preference based
IF user prefers email: try email first
ELSE IF user has mobile app: try push
ELSE: fallback to inbox

// Pattern 2: Message priority based  
IF critical alert: 
  send to ALL channels (email + push + SMS)
IF normal priority:
  send to primary channel only
  
// Pattern 3: Time-sensitive
IF urgent AND business hours: try Slack
IF urgent AND after hours: try SMS
ELSE: queue for email
```

### Channel Best Practices

| Channel | Best For | Avoid For | User Expectation |
|---------|----------|-----------|------------------|
| Email | Detailed content, records | Urgent alerts | Check periodically |
| Push | Time-sensitive updates | Long content | Immediate attention |
| SMS | Critical alerts only | Marketing | Very urgent only |
| In-app | Task lists, history | Initial contact | Check when in app |
| Slack | Team notifications | Personal data | Work context |

Remember: Start simple with email + in-app, then add channels as needed. See the [routing documentation](https://www.courier.com/docs/platform/sending/routing/) for advanced patterns.

## Part 4: Personalization and Segmentation

### Making Onboarding Feel Personal

Generic onboarding frustrates everyone. Enterprise customers expect white-glove treatment. Developers want API docs upfront. Small teams need quick wins. The solution isn't building separate flows for each segment - it's creating one smart system that adapts.

With Courier, you can personalize based on:
- **Company attributes**: Size, industry, plan type
- **User role**: Admin, developer, end user
- **Behavior patterns**: Fast mover vs. cautious explorer
- **Progress markers**: Where they are in the journey

### Dynamic Segmentation in Practice

Here's how to route users to the right onboarding path:

```javascript
// Get user profile to determine segment
    const profile = await courier.profiles.get(userId);
    
// Determine which flow to trigger
let automationName = "standard-onboarding";

if (profile.company_size > 100) {
  automationName = "enterprise-onboarding";
} else if (profile.role === "developer") {
  automationName = "technical-onboarding";
}

// Trigger the appropriate automation
    await courier.automations.invoke({
  automation: automationName,
      profile: { user_id: userId },
      data: {
          company_name: profile.company,
          user_name: profile.name,
    features_to_highlight: getRelevantFeatures(profile)
  }
});
```

**Creating adaptive content:**
```
// Pseudo-code for your segmentation logic
FOR each new user:
  IF enterprise customer:
    Focus on: SSO setup, team management, compliance
    Assign: Dedicated success manager
    Channel: Email + Slack
    
  IF developer:
    Focus on: API docs, webhooks, integrations
    Skip: Basic tutorials
    Channel: Email + documentation links
    
  ELSE standard user:
    Focus on: Quick wins, basic features
    Provide: Self-serve resources
    Channel: Email + in-app guides
```

### Using Template Variables

Courier templates support Handlebars for dynamic content:

```handlebars
Hi {{name}},

{{#if is_enterprise}}
  Your dedicated success manager will reach out within 24 hours.
{{else}}
  Here are three quick wins to get started:
{{/if}}

{{#each recommended_features}}
  - {{this.name}}: {{this.description}}
{{/each}}
```

This approach lets you maintain one template that adapts to each user, rather than managing dozens of variations.

[PLACEHOLDER: Visual showing how one template renders differently for different user segments]

## Part 5: In-App Tasks with Courier Inbox

### Beyond Email: Interactive Onboarding

Emails get lost. Users forget what they need to do. There's no sense of progress. That's why modern products include in-app task lists for onboarding - giving users a persistent checklist they can work through at their own pace.

Courier Inbox provides this out of the box:
- Tasks appear instantly in your app
- Read/unread states sync across devices
- Users can mark items complete
- Progress is visible and motivating
- Everything integrates with your existing notifications

### Setting Up Onboarding Tasks

Backend: Send tasks to the inbox:

```javascript
// Send onboarding tasks to user's inbox
const tasks = [
  { title: "Complete your profile", action: "/settings/profile" },
  { title: "Invite team members", action: "/team/invite" },
  { title: "Create first project", action: "/projects/new" }
];

for (const task of tasks) {
  await courier.send({
    message: {
      to: { user_id: userId },
      template: "onboarding-task",
      channels: ["inbox"],
      data: {
        title: task.title,
        action_url: task.action
      },
      metadata: {
        tags: ["onboarding"]
      }
    }
  });
}
```

Frontend: Display tasks in your React app:

```jsx
import { Inbox } from "@trycourier/react-inbox";

function OnboardingTasks() {
  return (
    <Inbox
      views={[
        {
          id: "onboarding",
          label: "Setup Tasks",
          params: { tags: ["onboarding"] }
        }
      ]}
      onMessageClick={(message) => {
        // Navigate to the task
        window.location.href = message.data?.action_url;
        // Mark as complete
        message.markAsRead();
      }}
    />
  );
}
```

**Customizing for your product:**
```
// Add tasks based on user type
IF enterprise_user:
  ADD "Schedule onboarding call"
  ADD "Configure SSO"
  
IF developer:
  ADD "Generate API keys"
  ADD "Review webhook docs"
  
// Track completion for analytics
ON task_completed:
  UPDATE user_profile.tasks_completed
  IF all_tasks_done: TRIGGER success_message
```

The Inbox component handles all the complexity - real-time updates, persistence, and state management. Your users get a Gmail-like experience for their onboarding tasks.

See the [Inbox documentation](https://www.courier.com/docs/platform/inbox/) for styling and customization options.

## Part 6: Smart Escalation for High-Value Accounts

### Knowing When to Bring in Humans

Not all users are equal. When a trial user gets stuck, an automated email might be enough. But when an enterprise customer paying for your highest tier can't figure something out, you need human intervention fast.

The key is building smart escalation that:
- Identifies when users truly need help (not just haven't logged in)
- Routes to the right team member
- Provides context so your team can actually help
- Doesn't overwhelm your team with false positives

[PLACEHOLDER: Flow chart showing escalation decision points and routing]

### Building Your Escalation System

Here's a simple escalation check that alerts your team when needed:

```javascript
// Check if we need to escalate
const profile = await courier.profiles.get(userId);
const daysSinceSignup = getDaysSince(profile.signupDate);

// Your escalation criteria (customize based on your needs)
const needsHelp = 
  profile.plan === "enterprise" &&
  daysSinceSignup > 3 &&
  !profile.first_project_created;

if (needsHelp && !profile.escalated) {
  // Alert your success team via Slack
  await courier.send({
    message: {
      template: "customer-needs-help",
      to: { 
        slack: { 
          channel: "#customer-success",
          access_token: process.env.SLACK_TOKEN
        }
      },
      data: {
        customer_name: profile.company,
        contact_email: profile.email,
        days_stuck: daysSinceSignup,
        account_value: profile.account_value
      }
    }
  });
  
  // Mark as escalated to prevent duplicate alerts
  await courier.profiles.merge({
    recipientId: userId,
    profile: { escalated: true }
  });
}
```

**Customizing escalation for your business:**
```
// Consider these factors for YOUR escalation logic:

- Account value (enterprise vs. self-serve)
- Time since signup without key actions
- Number of failed attempts at something
- Explicit help requests or negative feedback
- Industry or use case (some need more help)

// Example patterns:
IF enterprise AND stuck > 2 days: escalate
IF trial ending AND low engagement: escalate
IF multiple support tickets: escalate
```

### Making Escalations Actionable

Your Slack/email alerts should include:
- Who needs help and why
- What they've tried so far
- Their account details
- Quick action links (view profile, schedule call)

Avoid alert fatigue by being selective about what triggers escalation. Start conservative and adjust based on your team's capacity.

See the [Slack integration docs](https://www.courier.com/docs/external-integrations/direct-message/slack/) for setup details.

## Part 7: Multi-Tenant Configuration

### One System, Many Experiences

If you're building B2B SaaS, you know that different customer segments need different experiences. Enterprise customers expect their branding, custom workflows, and dedicated support. Startups want self-service and community. Trial users need convincing.

Courier's tenant system lets you create these differentiated experiences without maintaining separate codebases:
- Each tenant can have custom branding
- Different email templates and messaging
- Unique automation flows
- Specific channel preferences

[PLACEHOLDER: Diagram showing how one codebase serves multiple tenant configurations]

### Setting Up Tenants

Create tenant-specific brands:

```javascript
// Create a brand for enterprise customers
const brand = await courier.brands.create({
  name: "enterprise-brand",
  settings: {
    colors: {
      primary: "#003366",
      secondary: "#0066CC"
    },
    email: {
      header: {
        logo: { 
          href: "https://assets.company.com/enterprise-logo.png" 
        }
      },
      footer: {
        content: "Enterprise Support: support@company.com"
      }
    }
  }
});

// Send with tenant context
await courier.send({
  message: {
    template: "welcome",
    to: { 
      user_id: userId,
      tenant_id: "enterprise-segment"
    },
    tenant: "enterprise-segment",
    brand: brand.id
  }
});
```

**Organizing your tenant strategy:**
```
// Map out your tenant segments
Tenants = {
  enterprise: {
    branding: custom logos and colors
    messaging: formal, detailed
    support: dedicated success manager
    channels: email + slack
  },
  
  growth: {
    branding: standard with minor customization
    messaging: friendly, educational  
    support: priority queue
    channels: email + in-app
  },
  
  trial: {
    branding: default
    messaging: value-focused, urgent
    support: self-service
    channels: email only
  }
}
```

### Practical Tenant Patterns

| Use Case | Implementation | Benefit |
|----------|----------------|----------|
| White-label | Custom brand per customer | Feels native to their product |
| Tier-based | Brand per pricing tier | Differentiated experience |
| Regional | Brand per geography | Localized messaging |
| Industry | Brand per vertical | Relevant examples/terms |

Start simple - maybe just enterprise vs. everyone else. You can always add more granularity as you grow.

See the [tenant documentation](https://www.courier.com/docs/platform/tenants/) for advanced patterns.

## Part 8: Mobile Experience

### Extending Onboarding to Mobile

Mobile onboarding is different. Users download your app with high intent but low patience. They need immediate value, not lengthy tutorials. Push notifications can re-engage them, but only if you've earned permission.

The challenge is coordinating onboarding across platforms:
- Tasks created on web should appear in the mobile app
- Progress should sync everywhere
- Push notifications should complement, not duplicate emails
- The experience should feel native to each platform

[PLACEHOLDER: Diagram showing cross-platform synchronization through Courier]

### Mobile Implementation

React Native setup:

```javascript
import { CourierProvider } from '@trycourier/courier-react-native';

function App() {
  return (
    <CourierProvider
      clientKey={process.env.COURIER_CLIENT_KEY}
      userId={currentUser.id}>
      <YourApp />
    </CourierProvider>
  );
}

// Register for push notifications
import { registerForPushNotifications } from './push-setup';

const setupPush = async () => {
  const token = await registerForPushNotifications();
  
  // Save token to user profile
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      ios_push_token: token, // or fcm_token for Android
      push_enabled: true
    }
  });
};
```

Display onboarding tasks in your app:

```javascript
import { useInbox } from '@trycourier/courier-react-native';

function OnboardingScreen() {
  const { messages, loading, error } = useInbox();
  
  const onboardingTasks = messages.filter(
    msg => msg.metadata?.tags?.includes('onboarding')
  );
  
  return (
    <TaskList>
      {onboardingTasks.map(task => (
        <Task
          key={task.messageId}
          title={task.title}
          completed={task.read}
          onPress={() => {
            navigateToFeature(task.data.action);
            task.markAsRead();
          }}
        />
      ))}
    </TaskList>
  );
}
```

**Mobile-specific considerations:**
```
// Handle push permissions carefully
IF first_app_launch:
  DON'T ask for push permission immediately
  WAIT until user sees value
  THEN request permission with context
  
// Sync state across platforms  
Tasks completed on mobile -> Update web instantly
Emails read -> Don't send push for same content
Progress on any platform -> Reflected everywhere

// Platform differences
iOS: Request push permission explicitly
Android: Permission granted by default
Both: Respect quiet hours and notification preferences
```

The mobile SDK handles WebSocket connections, offline caching, and real-time updates automatically. Your onboarding feels seamless across all platforms.

See the [mobile SDK docs](https://www.courier.com/docs/platform/inbox/mobile/) for platform-specific setup.

## Part 9: Analytics and Optimization

### Measuring What Matters

You can't improve what you don't measure. But tracking onboarding effectiveness usually means stitching together data from multiple tools, building custom dashboards, and still not knowing if your changes actually help.

Courier provides built-in analytics for your entire onboarding flow:
- **Delivery metrics**: What got sent, delivered, opened, clicked
- **Engagement tracking**: Which channels work best for which users  
- **Journey analytics**: Where users drop off and why
- **A/B testing**: Compare different approaches with real data

[PLACEHOLDER: Analytics dashboard showing funnel metrics and engagement rates]

### Tracking Your Onboarding Performance

Get insights from your message logs:

```javascript
// Analyze user engagement
const logs = await courier.logs.list({
  recipient: userId,
  start: "7d" // Last 7 days
});

// Calculate key metrics
let metrics = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0
};

logs.results.forEach(log => {
  metrics.sent++;
  if (log.status === "DELIVERED") metrics.delivered++;
  if (log.opened) metrics.opened++;
  if (log.clicked) metrics.clicked++;
});

// Get user's activation status
const profile = await courier.profiles.get(userId);
const isActivated = profile.first_project_date !== null;
```

**Building your metrics dashboard:**
```
// Track these key onboarding metrics:

1. Activation Rate
   = Users who complete first key action / Total signups
   Target: 40-60% within first week

2. Time to Value 
   = Time from signup to first meaningful action
   Target: < 24 hours for most products

3. Task Completion
   = Onboarding tasks completed / Total tasks
   Shows which steps users struggle with

4. Channel Performance
   Email open rate, Push engagement, In-app clicks
   Identifies most effective channels
```

### Using Data to Improve

| What You See | What It Means | What to Try |
|--------------|---------------|-------------|
| Low email opens | Subject lines not compelling | A/B test different subjects |
| High opens, low clicks | Content not relevant | Segment users better |
| Tasks started but not finished | Too complex | Break into smaller steps |
| Drop-off at specific step | Friction point | Simplify or provide help |
| Better mobile engagement | Users prefer mobile | Prioritize mobile experience |

Remember: Small improvements compound. A 5% better activation rate can mean thousands more successful users.

See the [analytics documentation](https://www.courier.com/docs/platform/analytics/) for advanced tracking.

## Testing Your Onboarding

### Before You Go Live

Testing multi-channel, multi-step flows can be complex. You need to verify that the right messages reach the right users at the right time. Here's a practical approach to testing your onboarding:

```javascript
// Create test users for different scenarios
const testUsers = [
  {
    id: "test-enterprise",
    profile: {
      email: "test-enterprise@example.com",
      company: "Test Corp",
      plan: "enterprise",
      company_size: 500
    }
  },
  {
    id: "test-trial",
    profile: {
      email: "test-trial@example.com",
      company: "Small Co",
      plan: "trial",
      company_size: 5
    }
  }
];

// Test each user path
for (const user of testUsers) {
  // Create the test profile
  await courier.profiles.replace(user.id, user.profile);
  
  // Trigger onboarding
  await courier.automations.invoke({
    automation: "onboarding-welcome",
    profile: { user_id: user.id },
    data: user.profile
  });
  
  console.log(`Testing ${user.id} onboarding flow...`);
}
```

**What to test:**
```
✓ Each user segment gets the right content
✓ Time delays work as expected
✓ Conditional logic branches correctly
✓ Channel fallbacks trigger when needed
✓ Tasks appear in the inbox
✓ Mobile push works (test on real devices)
✓ Escalations fire for stuck users
✓ Analytics track all events
```

### Testing Tips

1. **Use test email addresses**: Set up dedicated test accounts to see the actual emails
2. **Test on real devices**: Push notifications behave differently in simulators
3. **Simulate failures**: Test what happens when channels fail or users don't have contact info
4. **Check timing**: Verify delays and business hours routing work correctly
5. **Review analytics**: Ensure all events are being tracked properly

## Conclusion

### What You've Built

You now have a sophisticated onboarding system that would typically take months to build from scratch. Your system:

- **Responds intelligently** to what users actually do, not just fixed schedules
- **Routes through multiple channels** with automatic fallbacks
- **Personalizes content** based on user segments without separate codebases
- **Escalates appropriately** when high-value users need help
- **Works across platforms** with tasks and progress syncing everywhere
- **Provides clear metrics** so you know what's working

More importantly, you've built this in a way that's maintainable and extensible. Your product team can now iterate on flows through Courier's visual tools. Your success team gets actionable alerts. Your mobile team has native experiences that just work.

### What You Didn't Have to Build

The real value is in what Courier handles for you:
- No state machines for multi-step flows
- No retry logic or failure handling
- No channel-specific integrations
- No synchronization between platforms
- No custom analytics pipelines
- No complex routing engines

This lets you focus on what actually matters: helping your users succeed with your product.

### Next Steps

Start simple and iterate:

1. **Launch with basics**: Email + in-app tasks for all users
2. **Add segmentation**: Different paths for different user types
3. **Expand channels**: Add SMS/Slack where it makes sense
4. **Optimize with data**: Use analytics to improve activation rates
5. **Scale gradually**: Add more sophisticated flows as you learn

## Resources

- [Courier Quickstart](https://www.courier.com/docs/getting-started/quickstart/) - Get up and running
- [Automations Guide](https://www.courier.com/docs/platform/automations/) - Build complex flows
- [Inbox Documentation](https://www.courier.com/docs/platform/inbox/) - In-app notifications
- [API Reference](https://www.courier.com/docs/reference/) - Complete API details
- [SDKs](https://www.courier.com/docs/sdk-libraries/) - Language-specific libraries

Remember: Great onboarding is iterative. Start with something good, measure what works, and keep improving. Your users (and your metrics) will thank you.
