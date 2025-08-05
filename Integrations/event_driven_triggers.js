// Event-Driven Onboarding Triggers
// Track key onboarding events and trigger appropriate flows

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
        tenant: this.tenantId,
        // Additional traits for personalization
        timezone: userData.timezone || 'UTC',
        language: userData.language || 'en',
        industry: userData.industry,
        company_size: userData.companySize
      }
    });

    // Trigger onboarding automation
    await this.courier.automations.invoke({
      automation: "onboarding-welcome-flow",
      profile: { user_id: this.userId },
      data: {
        trigger: "user_signup",
        plan: userData.plan,
        company_size: userData.companySize,
        referral_source: userData.referralSource
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
          team_size: inviteData.teamSize,
          invitee_emails: inviteData.emails,
          invite_link: inviteData.inviteLink
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
        first_project_date: new Date().toISOString(),
        project_type: projectData.type,
        activation_complete: true
      }
    });

    // Trigger next phase of onboarding
    await this.courier.automations.invoke({
      automation: "post-activation-flow",
      profile: { user_id: this.userId },
      data: projectData
    });
  }

  async integrationConnected(integrationData) {
    await this.courier.send({
      message: {
        template: "integration-success",
        to: { user_id: this.userId },
        data: {
          integration_name: integrationData.name,
          integration_type: integrationData.type,
          next_steps: integrationData.suggestedActions
        }
      }
    });
  }

  async subscriptionUpgraded(subscriptionData) {
    await this.courier.profiles.merge({
      recipientId: this.userId,
      profile: {
        plan: subscriptionData.newPlan,
        plan_upgraded_date: new Date().toISOString(),
        mrr: subscriptionData.monthlyRevenue
      }
    });

    await this.courier.automations.invoke({
      automation: "plan-upgrade-flow",
      profile: { user_id: this.userId },
      data: subscriptionData
    });
  }
}

export default OnboardingEvents;