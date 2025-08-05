// Multi-Tenant Configuration
// Different customer segments with differentiated experiences

class MultiTenantOnboarding {
  constructor(courier) {
    this.courier = courier;
    this.tenantConfigs = {
      enterprise: {
        branding: {
          primary_color: "#1a1a2e",
          secondary_color: "#0f3460",
          logo_url: "https://assets.teamsync.com/enterprise-logo.png",
          font_family: "Inter, sans-serif"
        },
        email_settings: {
          from_name: "TeamSync Enterprise Success",
          from_email: "success@teamsync.com",
          reply_to: "enterprise-support@teamsync.com",
          footer: "enterprise-footer-template",
          signature: "Your Enterprise Success Team"
        },
        onboarding_flow: "enterprise-high-touch",
        features: ["dedicated_support", "sso", "advanced_analytics", "api_access"],
        channels: {
          primary: ["email", "slack", "phone"],
          fallback: ["sms", "inbox"]
        },
        sla: {
          response_time: "1 hour",
          escalation_time: "4 hours",
          support_hours: "24/7"
        }
      },
      startup: {
        branding: {
          primary_color: "#00d4ff",
          secondary_color: "#ff6b6b",
          logo_url: "https://assets.teamsync.com/startup-logo.png",
          font_family: "Poppins, sans-serif"
        },
        email_settings: {
          from_name: "TeamSync Team",
          from_email: "hello@teamsync.com",
          reply_to: "support@teamsync.com",
          footer: "standard-footer-template",
          signature: "The TeamSync Team"
        },
        onboarding_flow: "self-serve-quick-start",
        features: ["collaboration", "integrations", "automation", "templates"],
        channels: {
          primary: ["email", "inbox"],
          fallback: ["push"]
        },
        sla: {
          response_time: "24 hours",
          escalation_time: "72 hours",
          support_hours: "9-5 PST M-F"
        }
      },
      trial: {
        branding: {
          primary_color: "#6c63ff",
          secondary_color: "#f8b500",
          logo_url: "https://assets.teamsync.com/trial-logo.png",
          font_family: "Roboto, sans-serif"
        },
        email_settings: {
          from_name: "TeamSync",
          from_email: "try@teamsync.com",
          reply_to: "help@teamsync.com",
          footer: "trial-footer-template",
          signature: "TeamSync"
        },
        onboarding_flow: "trial-conversion-focused",
        features: ["core_features", "limited_integrations", "upgrade_prompts"],
        channels: {
          primary: ["email"],
          fallback: ["inbox"]
        },
        sla: {
          response_time: "48 hours",
          escalation_time: "N/A",
          support_hours: "Community support only"
        }
      },
      education: {
        branding: {
          primary_color: "#2ecc71",
          secondary_color: "#3498db",
          logo_url: "https://assets.teamsync.com/edu-logo.png",
          font_family: "Open Sans, sans-serif"
        },
        email_settings: {
          from_name: "TeamSync Education",
          from_email: "edu@teamsync.com",
          reply_to: "edu-support@teamsync.com",
          footer: "education-footer-template",
          signature: "TeamSync Education Team"
        },
        onboarding_flow: "education-semester-based",
        features: ["classroom_tools", "student_management", "lms_integration"],
        channels: {
          primary: ["email", "lms_notification"],
          fallback: ["inbox"]
        },
        sla: {
          response_time: "24 hours",
          escalation_time: "48 hours",
          support_hours: "Academic calendar hours"
        }
      }
    };
  }

  async sendTenantNotification(userId, tenantId, notification) {
    const config = this.tenantConfigs[tenantId];
    
    if (!config) {
      throw new Error(`Unknown tenant: ${tenantId}`);
    }
    
    // Apply tenant-specific branding
    const brand = await this.getOrCreateBrand(tenantId);
    
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
          features: config.features,
          support_hours: config.sla.support_hours,
          branding: config.branding
        },
        tenant: tenantId,
        brand: brand.id,
        channels: config.channels.primary,
        providers: {
          sendgrid: {
            override: {
              from: {
                email: config.email_settings.from_email,
                name: config.email_settings.from_name
              },
              reply_to: {
                email: config.email_settings.reply_to
              }
            }
          }
        }
      }
    });
  }

  async createTenantBrand(tenantId) {
    const config = this.tenantConfigs[tenantId];
    
    const brand = await this.courier.brands.create({
      name: `${tenantId}-brand`,
      settings: {
        colors: {
          primary: config.branding.primary_color,
          secondary: config.branding.secondary_color
        },
        email: {
          header: {
            logo: { 
              href: config.branding.logo_url,
              align: "center"
            },
            backgroundColor: config.branding.primary_color
          },
          footer: {
            content: config.email_settings.footer,
            backgroundColor: "#f8f9fa",
            textColor: "#6c757d"
          },
          font: {
            family: config.branding.font_family
          }
        },
        inapp: {
          widgetBackground: {
            topColor: config.branding.primary_color,
            bottomColor: config.branding.secondary_color
          },
          fontFamily: config.branding.font_family
        }
      }
    });

    // Cache brand ID
    this.tenantConfigs[tenantId].branding.brand_id = brand.id;
    
    return brand;
  }

  async getOrCreateBrand(tenantId) {
    const config = this.tenantConfigs[tenantId];
    
    if (config.branding.brand_id) {
      return { id: config.branding.brand_id };
    }
    
    return await this.createTenantBrand(tenantId);
  }

  async createTenantAutomation(tenantId) {
    const config = this.tenantConfigs[tenantId];
    
    // Create tenant-specific automation flow
    const automationConfig = {
      enterprise: {
        steps: [
          { action: "send", template: "enterprise-welcome", delay: 0 },
          { action: "send", template: "schedule-onboarding-call", delay: "1 hour" },
          { action: "send", template: "dedicated-csm-intro", delay: "1 day" },
          { action: "send", template: "sso-setup-guide", delay: "2 days" },
          { action: "check", condition: "sso_configured", delay: "5 days" },
          { action: "escalate", template: "sso-help-needed", channel: "slack" }
        ]
      },
      startup: {
        steps: [
          { action: "send", template: "startup-welcome", delay: 0 },
          { action: "send", template: "quick-wins-guide", delay: "6 hours" },
          { action: "send", template: "community-invite", delay: "1 day" },
          { action: "send", template: "growth-tips", delay: "3 days" },
          { action: "send", template: "case-studies", delay: "7 days" }
        ]
      },
      trial: {
        steps: [
          { action: "send", template: "trial-welcome", delay: 0 },
          { action: "send", template: "feature-highlights", delay: "1 day" },
          { action: "send", template: "trial-midpoint-check", delay: "7 days" },
          { action: "send", template: "upgrade-benefits", delay: "10 days" },
          { action: "send", template: "trial-ending-soon", delay: "12 days" },
          { action: "send", template: "last-chance-offer", delay: "13 days" }
        ]
      }
    };
    
    const flow = automationConfig[tenantId];
    
    if (flow) {
      await this.courier.automations.create({
        name: `${tenantId}-onboarding-flow`,
        steps: flow.steps
      });
    }
  }

  async getTenantMetrics(tenantId) {
    // Get metrics specific to a tenant
    const users = await this.getUsersByTenant(tenantId);
    
    const metrics = {
      total_users: users.length,
      active_users: 0,
      completed_onboarding: 0,
      average_time_to_activation: 0,
      churn_risk: []
    };
    
    for (const user of users) {
      const profile = await this.courier.profiles.get(user.id);
      
      if (profile.last_login && 
          new Date() - new Date(profile.last_login) < 7 * 24 * 60 * 60 * 1000) {
        metrics.active_users++;
      }
      
      if (profile.onboarding_status === "completed") {
        metrics.completed_onboarding++;
      }
      
      if (profile.days_since_last_login > 14) {
        metrics.churn_risk.push(user);
      }
    }
    
    metrics.onboarding_completion_rate = 
      (metrics.completed_onboarding / metrics.total_users) * 100;
    
    return metrics;
  }

  async getUsersByTenant(tenantId) {
    // Implementation depends on your user storage
    // This is a placeholder
    return [];
  }
}

export default MultiTenantOnboarding;