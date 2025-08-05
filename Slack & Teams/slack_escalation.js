// Slack Escalation for High-Value Accounts
// Automatically alert customer success team when enterprise customers need help

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
      await this.sendSlackAlert(userId, profile);
      await this.markAsEscalated(userId);
    }
    
    return shouldEscalate;
  }

  async sendSlackAlert(userId, profile) {
    const blockers = await this.identifyBlockers(userId);
    const riskScore = this.calculateRiskScore(profile);
    
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
          blockers: blockers,
          risk_score: riskScore,
          account_value: profile.account_value,
          onboarding_progress: profile.onboarding_progress
        },
        providers: {
          slack: {
            override: {
              text: `⚠️ Enterprise Customer Needs Attention`,
              attachments: [{
                color: riskScore > 7 ? "danger" : riskScore > 4 ? "warning" : "good",
                title: `${profile.company} - Onboarding Alert`,
                fields: [
                  {
                    title: "Customer",
                    value: profile.name,
                    short: true
                  },
                  {
                    title: "Account Value",
                    value: `$${profile.account_value}/year`,
                    short: true
                  },
                  {
                    title: "Days Since Signup",
                    value: profile.days_since_signup,
                    short: true
                  },
                  {
                    title: "Onboarding Progress",
                    value: `${profile.onboarding_progress}%`,
                    short: true
                  },
                  {
                    title: "Risk Score",
                    value: `${riskScore}/10`,
                    short: true
                  },
                  {
                    title: "Last Activity",
                    value: this.formatLastActivity(profile.last_login),
                    short: true
                  },
                  {
                    title: "Blockers Identified",
                    value: blockers.join('\n• '),
                    short: false
                  }
                ],
                actions: [
                  {
                    type: "button",
                    text: "View Customer Profile",
                    style: "primary",
                    url: `https://app.teamsync.com/admin/customers/${userId}`
                  },
                  {
                    type: "button", 
                    text: "Schedule Call",
                    url: `https://calendly.com/success-team/${userId}`
                  },
                  {
                    type: "button",
                    text: "Send Email",
                    url: `mailto:${profile.email}?subject=TeamSync Onboarding Support`
                  },
                  {
                    type: "button",
                    text: "View Activity Log",
                    url: `https://app.teamsync.com/admin/logs/${userId}`
                  }
                ],
                footer: "TeamSync Alert System",
                ts: Math.floor(Date.now() / 1000)
              }],
              // Thread messages for context
              thread_ts: profile.slack_thread_ts
            }
          }
        }
      }
    });
  }

  async identifyBlockers(userId) {
    const logs = await this.courier.logs.list({
      recipient: userId,
      limit: 50
    });

    const blockers = [];
    
    // Check for common sticking points
    if (!logs.some(log => log.event === "team_invited")) {
      blockers.push("❌ Haven't invited team members");
    }
    
    if (!logs.some(log => log.event === "project_created")) {
      blockers.push("❌ Haven't created first project");
    }
    
    if (!logs.some(log => log.event === "integration_connected")) {
      blockers.push("❌ No integrations connected");
    }
    
    if (!logs.some(log => log.event === "profile_completed")) {
      blockers.push("❌ Profile incomplete");
    }
    
    // Check for failed actions
    const failedActions = logs.filter(log => log.status === "failed");
    if (failedActions.length > 0) {
      blockers.push(`⚠️ ${failedActions.length} failed actions detected`);
    }
    
    // Check engagement
    const openedEmails = logs.filter(log => log.opened_at).length;
    const sentEmails = logs.filter(log => log.type === "email").length;
    if (sentEmails > 0 && openedEmails / sentEmails < 0.3) {
      blockers.push("📧 Low email engagement (< 30% open rate)");
    }

    return blockers.length > 0 ? blockers : ["No specific blockers identified"];
  }

  calculateRiskScore(profile) {
    let score = 0;
    
    // Time-based risk
    if (profile.days_since_signup > 7) score += 3;
    else if (profile.days_since_signup > 3) score += 2;
    
    // Activity-based risk
    if (!profile.last_login) score += 3;
    else if (new Date() - new Date(profile.last_login) > 72 * 60 * 60 * 1000) score += 2;
    
    // Progress-based risk
    if (profile.onboarding_progress < 20) score += 3;
    else if (profile.onboarding_progress < 50) score += 1;
    
    // Value-based risk multiplier
    if (profile.account_value > 100000) score = Math.min(score * 1.5, 10);
    
    return Math.round(score);
  }

  formatLastActivity(lastLogin) {
    if (!lastLogin) return "Never logged in";
    
    const now = new Date();
    const last = new Date(lastLogin);
    const hours = Math.floor((now - last) / (1000 * 60 * 60));
    
    if (hours < 1) return "Less than 1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    if (hours < 48) return "Yesterday";
    return `${Math.floor(hours / 24)} days ago`;
  }

  async markAsEscalated(userId) {
    await this.courier.profiles.merge({
      recipientId: userId,
      profile: { 
        escalated: true,
        escalated_at: new Date().toISOString(),
        escalation_count: (profile.escalation_count || 0) + 1
      }
    });
  }

  // Schedule regular checks for all enterprise customers
  async scheduleEscalationChecks() {
    // This would typically be a cron job or scheduled function
    const enterpriseUsers = await this.getEnterpriseUsers();
    
    for (const user of enterpriseUsers) {
      await this.checkAndEscalate(user.id);
    }
  }

  async getEnterpriseUsers() {
    // Implementation depends on your user storage
    // This is a placeholder
    return [];
  }
}

export default SlackEscalation;