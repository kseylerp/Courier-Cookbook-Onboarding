// Multi-Step Email Sequences with Intelligent Timing
// Define complex automation flows with conditional logic

const welcomeFlowAutomation = {
  automation_id: "onboarding-welcome-flow",
  name: "Welcome Flow - Main Onboarding",
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
        },
        {
          action: "wait",
          duration: "48 hours"
        },
        {
          action: "condition",
          if: {
            profile: { project_created: { equals: true } }
          },
          then: [
            {
              action: "send",
              template: "advanced-features",
              channels: ["email"]
            }
          ],
          else: [
            {
              action: "send",
              template: "project-creation-guide",
              channels: ["email", "push"]
            }
          ]
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

const postActivationFlow = {
  automation_id: "post-activation-flow",
  name: "Post-Activation Engagement",
  steps: [
    {
      action: "send",
      template: "congrats-first-project",
      channels: ["email", "inbox"]
    },
    {
      action: "wait",
      duration: "3 days"
    },
    {
      action: "send",
      template: "pro-tips",
      channels: ["email"]
    },
    {
      action: "wait",
      duration: "7 days"
    },
    {
      action: "condition",
      if: {
        profile: { team_size: { greater_than: 1 } }
      },
      then: [
        {
          action: "send",
          template: "team-collaboration-guide",
          channels: ["email"]
        }
      ],
      else: [
        {
          action: "send",
          template: "invite-team-benefits",
          channels: ["email"]
        }
      ]
    }
  ]
};

const reEngagementFlow = {
  automation_id: "re-engagement-flow",
  name: "Win-Back Inactive Users",
  trigger: {
    type: "inactivity",
    days: 14
  },
  steps: [
    {
      action: "send",
      template: "we-miss-you",
      channels: ["email"]
    },
    {
      action: "wait",
      duration: "3 days"
    },
    {
      action: "condition",
      if: {
        profile: { last_login: { date_greater_than: "3 days ago" } }
      },
      then: [
        {
          action: "stop"
        }
      ],
      else: [
        {
          action: "send",
          template: "special-offer",
          channels: ["email", "sms"]
        },
        {
          action: "wait",
          duration: "7 days"
        },
        {
          action: "send",
          template: "final-reminder",
          channels: ["email"]
        }
      ]
    }
  ]
};

export { welcomeFlowAutomation, postActivationFlow, reEngagementFlow };