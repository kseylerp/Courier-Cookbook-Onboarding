// Personalized Onboarding with Conditional Paths
// Create adaptive experiences based on user characteristics

class PersonalizedOnboarding {
  constructor(courier) {
    this.courier = courier;
  }

  async determineUserPath(userId) {
    const profile = await this.courier.profiles.get(userId);
    
    // Define paths based on user traits
    const paths = {
      enterprise: {
        condition: profile.company_size > 100,
        flow: "enterprise-onboarding",
        features: ["sso_setup", "team_hierarchy", "compliance_docs", "dedicated_support"],
        messaging_tone: "formal",
        support_level: "white-glove"
      },
      power_user: {
        condition: profile.role === "admin" && profile.technical_level === "high",
        flow: "technical-onboarding", 
        features: ["api_docs", "webhook_setup", "advanced_config", "developer_tools"],
        messaging_tone: "technical",
        support_level: "self-serve-advanced"
      },
      smb: {
        condition: profile.company_size > 10 && profile.company_size <= 100,
        flow: "smb-onboarding",
        features: ["quick_setup", "integrations", "team_collaboration", "growth_tools"],
        messaging_tone: "friendly",
        support_level: "standard"
      },
      startup: {
        condition: profile.company_size <= 10,
        flow: "startup-onboarding",
        features: ["basic_setup", "core_features", "growth_hacks", "community"],
        messaging_tone: "casual",
        support_level: "community"
      },
      standard: {
        condition: true, // default
        flow: "standard-onboarding",
        features: ["basic_setup", "first_project", "invite_team"],
        messaging_tone: "friendly",
        support_level: "standard"
      }
    };

    // Select appropriate path
    const selectedPath = Object.values(paths).find(path => path.condition) || paths.standard;
    
    // Store path selection in profile
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: {
        onboarding_path: selectedPath.flow,
        messaging_tone: selectedPath.messaging_tone,
        support_level: selectedPath.support_level
      }
    });
    
    // Trigger path-specific automation
    await this.courier.automations.invoke({
      automation: selectedPath.flow,
      profile: { user_id: userId },
      data: {
        features_to_highlight: selectedPath.features,
        personalization: {
          company_name: profile.company,
          user_name: profile.name,
          use_case: profile.primary_use_case,
          industry: profile.industry
        }
      }
    });

    return selectedPath;
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
            },
            {
              type: "list",
              content: {
                parent: "Your personalized checklist:",
                children: [
                  "{{#each features}}{{this}}{{/each}}"
                ]
              }
            }
          ]
        }
      },
      inbox: {
        title: "Welcome to TeamSync, {{name}}!",
        preview: "Let's get {{company}} set up in just a few steps",
        body: "{{#if is_enterprise}}Your dedicated success manager will reach out within 24 hours{{else}}Check out our quick start guide{{/if}}"
      },
      sms: {
        body: "Welcome to TeamSync, {{name}}! Get started: {{setup_link}}"
      }
    };

    return personalizedTemplate;
  }

  async personalizeByBehavior(userId, behavior) {
    // Adapt onboarding based on user behavior
    const behaviorProfiles = {
      fast_mover: {
        condition: behavior.actions_in_first_hour > 10,
        adjustments: {
          email_frequency: "accelerated",
          content_depth: "advanced",
          next_steps: ["api_access", "bulk_import", "automation_setup"]
        }
      },
      explorer: {
        condition: behavior.features_explored > 5,
        adjustments: {
          email_frequency: "normal",
          content_depth: "comprehensive",
          next_steps: ["feature_deep_dives", "use_cases", "best_practices"]
        }
      },
      cautious: {
        condition: behavior.actions_in_first_day < 3,
        adjustments: {
          email_frequency: "gentle",
          content_depth: "basic",
          next_steps: ["guided_tour", "video_tutorials", "live_demo"]
        }
      }
    };

    const behaviorProfile = Object.values(behaviorProfiles).find(p => p.condition);
    
    if (behaviorProfile) {
      await this.courier.profiles.merge({
        recipientId: userId,
        profile: {
          behavior_type: behaviorProfile.type,
          email_frequency: behaviorProfile.adjustments.email_frequency,
          recommended_next_steps: behaviorProfile.adjustments.next_steps
        }
      });
    }

    return behaviorProfile;
  }
}

export default PersonalizedOnboarding;