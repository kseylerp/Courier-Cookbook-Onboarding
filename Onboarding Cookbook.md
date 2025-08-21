# A Recipe for Building Multi-Channel Onboarding with Courier

## Introduction

As someone shipping product that hopelly people will use, you know better than most that a easy-to-follow onboarding process can make the difference between solid MAU growth and users who fail to launch. But building a proper onboarding system means juggling multiple notification channels, tracking user progress, personalizing content based on user type, and somehow making it all work across web and mobile.

The traditional approach involves stitching together email providers, building state machines for multi-step flows, implementing retry logic, and creating branching logic for different user paths. This guide details the way to build a complete onboarding system using Courier's platform which can handle all the complex orchestration while you focus on the user experience.

## What We'll Build

We'll create an onboarding system that:
- Triggers automatically based on user actions (signup, invites, first project)
- Sends multi-step sequences that adapt to user behavior
- Routes through the right channels (email, in-app, push, SMS)
- Personalizes content based on user traits
- Escalates to your team when high-value accounts fall through the cracks
- Tracks what's working through built-in analytics

Throughout this guide, we'll use a fictional B2B SaaS platform as our example, but these patterns apply to any product that needs sophisticated onboarding. You'll see real Courier SDK code that you can adapt to your needs, along with explanations of why each piece matters for your users.

<img width="1152" height="637" alt="Screenshot 2025-08-20 at 3 56 33 PM" src="https://github.com/user-attachments/assets/6b967b1f-c3e5-41c3-b77b-e8f57c4313a1" />

## Setup

First, let's get the foundations in place. Install the Courier SDK for your platform:

```bash
npm install @trycourier/courier                  # Backend SDK
npm install @trycourier/react-inbox              # React components
npm install @trycourier/courier-react-native     # Mobile SDK
npm install @trycourier/courier-js               # JS Client SDK
```
***Note**: For this example we are using mostly React and React Native for it's ease of use across platforms but you can install SDKs for a number of languages, including native iOS and Android.*

Now initialize Courier with your authentication token:

```javascript
const { CourierClient } = require("@trycourier/courier");
const courier = new CourierClient({ 
  authorizationToken: process.env.COURIER_AUTH_TOKEN
});
```

See the [authentication docs](https://www.courier.com/docs/reference/auth/intro/) for more setup options.

## Part 1: Event-Driven Onboarding

### Why Events Matter

Traditional onboarding sends emails on a fixed schedule - day 1, day 3, day 7. But your users don't follow schedules. Some dive in immediately and need advanced features explained. Others sign up and disappear for a week. Event-driven onboarding responds to what users actually do, creating a more relevant experience.

When you track user events, you can:
- Send the right message at the right time
- Skip irrelevant steps for power users
- Re-engage dormant users with targeted content
- Build user profiles that inform future communications

<img width="1284" height="772" alt="Screenshot 2025-08-20 at 4 39 56 PM" src="https://github.com/user-attachments/assets/a83a6683-2459-45da-ac00-c5cd6a2977d2" />

In this example we will use our [Twilio Segment](https://www.courier.com/docs/external-integrations/cdp/segment/segment-to-courier) integration with events:
```
analytics.group
analytics.identify
analytics.track
```

### Building Your Event System

To begin, we're interested in using the ```analytics.track``` method to trigger different flows based on ```sign-up```, ```login```, and ```project_start```. Using the Segment method, you can pull in these events for IF/Else conditional logic later on. 

```javascript
// In your app - track the key events
analytics.track("sign-up", { 
    productType: "saas", 
    segment: "midmarket"
});

// Later when user takes actions
analytics.track("login", { user_id: userId });
analytics.track("project_start", { user_id: userId, project_name: "My First Project" });
```

### Building Rich User Profiles

Every event updates the user profile, creating a complete picture of their journey. This accumulated data helps you make smarter decisions about what to send next:

- **Behavioral data**: Track actions like last_login, projects_created, team_invites_sent
- **Segment data**: Store plan_type, company_size, industry for personalization
- **Progress data**: Monitor onboarding_status, activation_date, feature_usage

These profiles become the foundation for all your routing and personalization decisions.

## Part 2: Multi-Step Sequences

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

### Smart Timing Options

Courier supports various timing strategies to respect user preferences:

- **Simple delays**: `wait: "24 hours"` - straightforward and effective
- **Business hours**: Send during work hours in user's timezone
- **Batched delivery**: Group notifications to reduce noise
- **Smart send times**: Use engagement data to find optimal delivery windows

### Escalation for High-Value Accounts

Your sequences can also include escalation logic for when automation isn't enough. For enterprise customers or high-value accounts, you might want human intervention when they get stuck. This can be built right into your automation flows.

**How it works in Courier:**
You add escalation as conditional steps in your automation. After a wait period or activity check, add a send step with an `if` condition to evaluate the user's status. If they meet your escalation criteria (enterprise plan + no activation), the step triggers a notification to your team:

```json
{
  "action": "send",
  "template": "team-escalation-alert",
  "recipient": "success-team",
  "if": "profile.plan === 'enterprise' && profile.activated === false",
  "profile": {
    "slack": {
      "access_token": "xoxb-xxxxx",
      "channel": "success-alerts"
    }
  },
  "data": {
    "customer_name": "{{profile.company}}",
    "days_since_signup": "{{profile.days_since_signup}}",
    "last_activity": "{{profile.last_login}}",
    "crm_link": "{{profile.crm_url}}"
  },
  "override": {
    "slack": {
      "body": {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "🚨 *Enterprise customer needs help*"
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Customer:* {{customer_name}}"
              },
              {
                "type": "mrkdwn",
                "text": "*Days since signup:* {{days_since_signup}}"
              },
              {
                "type": "mrkdwn",
                "text": "*Last activity:* {{last_activity}}"
              }
            ]
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "View in CRM"
                },
                "url": "{{crm_link}}"
              }
            ]
          }
        ]
      }
    }
  }
}
```

The key is being selective about what triggers escalation - account value, time since signup without key actions, or explicit help requests are good indicators. Your Slack message includes all the context your team needs: customer details, their progress, and direct links to help them.

This approach keeps high-value customers from falling through the cracks while avoiding alert fatigue from lower-priority users. You can also route different segments to different teams - enterprise to success managers, mid-market to support, etc.

See the [automations documentation](https://www.courier.com/docs/platform/automations/) for more complex flow examples including escalation patterns.

## Part 3: Smart Channel Routing

### Why Channel Strategy Matters

Not every message should go to email. Your power users might prefer Slack notifications. Mobile users need push notifications. Some messages are urgent enough for SMS. The challenge is routing each message through the right channel without building complex if/else logic throughout your codebase.

Courier's routing engine handles this complexity for you. You define your routing strategy once, and Courier automatically:
- Checks which channels are available for each user
- Respects user preferences
- Falls back to alternative channels if delivery fails
- Prevents channel fatigue with smart throttling

### How Preferences and Routing Work Together

Here's where Courier gets really powerful. Your users can set their notification preferences (through Courier's embeddable preference center or your own UI), and these preferences automatically influence routing decisions. Courier gives both developers and users control over the channels they want to allow for each topic and urgency level.

<img width="813" height="508" alt="preferences-topic-settings" src="https://github.com/user-attachments/assets/4f7fe622-6eca-4fae-bc01-29c7d5914f2d" />
 
Think of it as a two-layer system:
1. **User preferences**: "I prefer email for updates, push for urgent stuff"
2. **Your routing logic**: "Try their preferred channel first, then fallback"

When a message is sent, Courier evaluates both layers. If a user has explicitly opted out of email, Courier won't even attempt that channel - it'll skip straight to your fallback options.

### Single vs. All Channel Routing

The `method` parameter in your routing config is crucial:

```javascript
// SINGLE: Try channels in order until one succeeds
routing: {
  method: "single",
  channels: ["email", "push", "sms"]
}
// Result: Sends to email. If that fails/bounces, tries push. 
// If push fails, tries SMS. Stops at first success.

// ALL: Send to every available channel simultaneously  
routing: {
  method: "all",
  channels: ["email", "push", "inbox"]
}
// Result: User gets the message in email AND push AND inbox
// Great for critical alerts where redundancy matters
```

### Understanding Failover

Courier's failover is smarter than just "try the next channel." Here's what actually happens:

1. **Provider-level failover**: If SendGrid is down, Courier can automatically switch to your backup email provider (if configured)
2. **Channel-level failover**: If email bounces or isn't available, move to the next channel in your list
3. **Timeout handling**: Each channel gets a time window to succeed before moving on

Here's a complete example showing how it all works together:

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
      method: "single",  // Try channels in order
      channels: ["email", "inbox", "sms"]
    },
    timeout: {
      channel: 3600000,  // Wait up to 1 hour per channel
      provider: 300000   // Wait up to 5 min per provider
    },
    providers: {
      // Optional: specify backup providers
      email: {
        override: "sendgrid",
        if_unavailable: "smtp"
      }
    }
  }
});
```

What happens in this flow:
1. Courier checks user preferences - are they okay with email?
2. Tries SendGrid first (primary email provider)
3. If SendGrid fails within 5 minutes, tries SMTP backup
4. If email completely fails within 1 hour, moves to inbox
5. If inbox fails, tries SMS as last resort
6. Each step respects user preferences and availability


### Channel Best Practices

| Channel | Best For | Avoid For | User Expectation |
|---------|----------|-----------|------------------|
| Email | Detailed content, records | Urgent alerts | Check periodically |
| Push | Time-sensitive updates | Long content | Immediate attention |
| SMS | Critical alerts only | Marketing | Very urgent only |
| In-app | Task lists, history | Time sensitive alerts | Check when in app (web/mobile) |
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

### Creating Multi-Channel Templates

Courier is both a developer-friendly tool and a platform for non-technical teams. The visual template designer typifies this contrast better than most features. Instead of writing HTML, CSS, and channel-specific code, you can drag and drop components to build beautiful, responsive templates that automatically work across email, push notifications, SMS, and in-app messages. Developers can set up the data connections and conditional logic, while designers and product managers can iterate on the visual design and copy without touching code. This collaboration speeds up your onboarding development significantly.

<img width="998" height="713" alt="Courier Template Design Studio 1 (1)" src="https://github.com/user-attachments/assets/6787cdf7-60b5-4ac7-956c-8fb67d236b55" />

**What makes it special:**
- **Multi-channel by design**: Create once, deploy everywhere
- **Real data preview**: See exactly how templates render with actual user data
- **Version control**: Track changes and rollback if needed
- **Brand consistency**: Reusable components ensure consistent styling

Here's how to build a personalized template that works across all your channels:

**Design in the Visual Editor**
In Courier's template designer:
- Drag text blocks, buttons, and images for your layout
- Add Handlebars placeholders directly in the visual editor: `{{name}}`, `{{company}}`
- Set up conditional blocks: `{{#if is_enterprise}}...{{/if}}`
- Configure channel-specific versions (email gets full content, push gets summary)

**Map Segment Data to Template Variables**
When Segment sends user traits, they automatically fill your template placeholders:

```javascript
// Segment sends this data
analytics.identify(userId, {
  name: "Sarah Chen",
  company: "TechCorp", 
  plan: "enterprise",
  industry: "fintech"
});
```

Your template in the visual designer uses these traits:
```handlebars
Hi {{analytics.traits.name}},

Welcome to our platform! Since {{analytics.traits.company}} is in the 
{{analytics.traits.industry}} space, here are some relevant resources...

{{#if (eq analytics.traits.plan "enterprise")}}
  Your dedicated success manager will reach out within 24 hours.
{{else}}
  Here are three quick wins to get started:
{{/if}}
```
**Trigger Your Onboarding Flow**
Once you've designed your templates, you set up an automation in Courier that defines the sequence and timing. Then when a user signs up (or hits other milestones), that event triggers the automation to start. From there, Courier handles everything, from sending the welcome email and waiting for user activity, to checking conditions and routing to the right channels. 

The workflow runs automatically using the templates you designed and the real user data from Segment. One template design works across all channels, and the whole sequence adapts based on what each user actually does.

## Part 5: In-App Tasks with Courier Inbox

### Beyond Email: Interactive Onboarding

Emails get lost. Users forget what they need to do. There's no sense of progress. That's why modern products include in-app task lists for onboarding - giving users a persistent checklist they can work through at their own pace.

Courier Inbox is essentially a notification center that lives inside your application. Think of it like the notifications you see in Facebook or Slack, but embedded in your product. Users can see all their messages, mark them as read, archive them, and take actions directly from the interface. The best part is that it syncs in real-time across all platforms, like when you mark something as read on web and it's instantly read on mobile too.

Courier Inbox provides this out of the box:
- Tasks appear instantly in your app
- Read/unread states sync across devices
- Users can mark items complete or archive
- Progress is visible and motivating
- Everything integrates with your existing notifications (ex. email read = 
inbox read state)

Most teams create their onboarding tasks through Courier's platform interface, then simply embed the Inbox component in their React or React Native apps. The Inbox automatically pulls in all messages sent to the "inbox" channel, handles state management, and provides a clean Gmail-like interface for users.

### Setting Up Onboarding Tasks

After sending tasks to the inbox from your backend (using `courier.send()` with `channels: ["inbox"]`), display them in your React app using the [React SDK](https://github.com/trycourier/courier-react):

```jsx
import React from 'react';
import { CourierProvider } from "@trycourier/react-provider";
import { Inbox } from "@trycourier/react-inbox";

function App() {
  return (
    <CourierProvider
      clientKey={process.env.REACT_APP_COURIER_CLIENT_KEY}
      userId={currentUser.id}>
      <OnboardingTasks />
    </CourierProvider>
  );
}

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

export default App;
```

The beauty of this approach is that you can customize tasks based on user types. Enterprise users might see "Schedule onboarding call" and "Configure SSO" while developers get "Generate API keys" and "Review webhook docs." When users complete tasks, you can track their progress in user profiles and trigger success messages or next-step automations when they finish their onboarding checklist.

The Inbox component handles all the complexity - real-time updates, persistence, and state management. Your users get a Gmail-like experience for their onboarding tasks.

### Mobile Integration

The same onboarding tasks work seamlessly on mobile using the [React Native SDK](https://github.com/trycourier/courier-react-native):

```jsx
import React from 'react';
import { View } from 'react-native';
import { CourierProvider, useInbox } from '@trycourier/courier-react-native';

function App() {
  return (
    <CourierProvider
      clientKey={process.env.COURIER_CLIENT_KEY}
      userId={currentUser.id}>
      <OnboardingScreen />
    </CourierProvider>
  );
}

function OnboardingScreen() {
  const { messages } = useInbox();
  
  const onboardingTasks = messages.filter(
    msg => msg.metadata?.tags?.includes('onboarding')
  );
  
  return (
    <View>
      {onboardingTasks.map(task => (
        <TaskCard
          key={task.messageId}
          title={task.title}
          completed={task.read}
          onPress={() => {
            navigateToFeature(task.data.action);
            task.markAsRead();
          }}
        />
      ))}
    </View>
  );
}
```

**Cross-platform benefits:**
- Tasks created on web appear instantly in mobile app
- Progress syncs in real-time across all platforms
- Push notifications can complement in-app tasks
- Same data, native experience on each platform

Both the [React SDK](https://github.com/trycourier/courier-react) and [React Native SDK](https://github.com/trycourier/courier-react-native) provide the same inbox functionality, ensuring your onboarding experience is consistent whether users are on desktop or mobile.

See the [Inbox documentation](https://www.courier.com/docs/platform/inbox/) for styling and customization options.

## Part 6: Multi-Tenant Configuration

### One System, Many Experiences

If you're building B2B SaaS, you know that different customer segments need different experiences. Enterprise customers expect their branding, custom workflows, and dedicated support. Startups want self-service and community. Trial users need convincing.

Courier's tenant system lets you create these differentiated experiences without maintaining separate codebases:
- Each tenant can have custom branding
- Different email templates and messaging
- Unique automation flows
- Specific channel preferences


### Understanding Tenant Hierarchy

Courier's tenant system supports complex organizational structures that mirror how businesses actually operate:

```
Organization (tenant0)
└── Workspace (tenantQ)
    └── Team (tenantP)
        ├── Project (tenantR1)
        │   └── Environment (tenantR1D1)
        └── Project (tenantR2)
            ├── Environment (tenantR2D1)
            └── Environment (tenantR2D2)
```

This hierarchy enables several powerful features:

**Inheritance**: Settings flow from parent to child with override capabilities. An organization might set default branding that workspaces inherit, but teams can override with their specific colors.

**Scoped notifications**: Send to all members of a tenant and its children using audience targeting. A workspace-level alert automatically reaches all teams and projects within it.

**Context preservation**: Maintain organizational boundaries in notification delivery through user profiles, ensuring the right people get the right messages with appropriate branding.

### Multi-Dimensional Users

Users exist in multiple contexts simultaneously. A developer might receive notifications as an individual (personal preferences), a team member (team notifications), and a workspace participant (organization-wide alerts). When sending notifications, you specify the tenant context to ensure the right preferences and branding are applied:

```json
{
  "message": {
    "to": {
      "user_id": "user1",
      "context": {
        "tenant_id": "production-workspace"
      }
    },
    "content": {
      "title": "Deployment completed",
      "body": "Your app in {$.tenant.name} is now live"
    }
  }
}
```

### Setting Up Your Tenant Strategy

You'll configure your tenant brands and segments through Courier's platform interface. This lets you set up custom logos, colors, messaging tone, and channel preferences for each level of your organizational hierarchy without writing code. Once configured, your templates and automations automatically use the right branding based on the tenant context.

When organizing your tenant strategy, think about how each customer segment should experience your product. Enterprise customers typically expect custom logos and colors, formal messaging, dedicated success managers, and premium channels like Slack integration. Growth customers might get standard branding with some customization, friendly educational messaging, priority support queues, and email plus in-app notifications. Trial users often receive default branding, value-focused urgent messaging, self-service support, and email-only communications.

### Practical Tenant Patterns

| Use Case | Implementation | Benefit |
|----------|----------------|----------|
| White-label | Custom brand per customer | Feels native to their product |
| Tier-based | Brand per pricing tier | Differentiated experience |
| Regional | Brand per geography | Localized messaging |
| Industry | Brand per vertical | Relevant examples/terms |

Start simple - maybe just enterprise vs. everyone else. You can always add more granularity as you grow.

See the [tenant documentation](https://www.courier.com/docs/platform/tenants/) for advanced patterns.


## Part 7: Analytics and Observability

### Measuring What Matters

Instead of stitching together data from multiple tools, Courier provides comprehensive analytics for your notification infrastructure. You get message performance, channel effectiveness, and provider reliability all in one place - while your product analytics handle the broader user journey.

<img width="1643" height="679" alt="Screenshot 2025-08-21 at 1 15 52 PM" src="https://github.com/user-attachments/assets/db66777e-83cf-45f2-9cf2-4d4bd8631d62" />

### What Courier Tracks

**Message and Channel Performance**
Every message is automatically tracked across all channels - deliveries, opens, clicks, and bounces. You'll see which templates work best, how each channel performs (email open rates, push engagement, SMS delivery), and where issues occur. Real-time monitoring shows delivery rates and system health at a glance, critical for catching onboarding failures before they impact activation.

**Provider Monitoring**
Track provider reliability to know when SendGrid is having issues or when backup providers are needed. The platform shows performance trends over time, filtered by message type or user segment.

**Integration with Your Analytics Stack**
Courier can send engagement events (opens, clicks) back to tools like Segment, connecting message performance to your broader user activation metrics. This gives you the complete picture of how onboarding messages impact retention.

### Optimizing Your Onboarding

Key metrics to watch:

- **Template performance**: Low open rates = subject line issues; high opens with low clicks = content problems
- **Channel effectiveness**: Find which channels work best for different segments and adjust routing accordingly  
- **Delivery health**: Spot provider issues early and know when to activate backup options

Remember: Courier handles notification metrics while your product analytics track the full user journey. Together, they show you exactly where to optimize.

See the [analytics documentation](https://www.courier.com/docs/platform/analytics/) for more details on available metrics and reporting features.

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

Make sure to verify that each user segment gets the right content, time delays work as expected, conditional logic branches correctly, channel fallbacks trigger when needed, tasks appear in the inbox, mobile push works on real devices, escalations fire for stuck users, and analytics track all events properly.

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
