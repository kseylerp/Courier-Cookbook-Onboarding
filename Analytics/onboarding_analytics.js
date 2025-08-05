// Onboarding Analytics and Optimization
// Track performance and continuously improve onboarding

class OnboardingAnalytics {
  constructor(courier) {
    this.courier = courier;
  }

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
      inbox_messages_sent: 0,
      inbox_messages_read: 0,
      push_sent: 0,
      push_opened: 0,
      sms_sent: 0,
      sms_clicked: 0,
      tasks_completed: 0,
      days_to_activation: null,
      engagement_score: 0
    };

    // Process logs for metrics
    logs.results.forEach(log => {
      // Email metrics
      if (log.channel === 'email') {
        metrics.emails_sent++;
        if (log.opened_at) metrics.emails_opened++;
        if (log.clicked_at) metrics.emails_clicked++;
      }
      
      // Inbox metrics
      if (log.channel === 'inbox') {
        metrics.inbox_messages_sent++;
        if (log.read_at) {
          metrics.inbox_messages_read++;
          metrics.tasks_completed++;
        }
      }
      
      // Push metrics
      if (log.channel === 'push') {
        metrics.push_sent++;
        if (log.opened_at) metrics.push_opened++;
      }
      
      // SMS metrics
      if (log.channel === 'sms') {
        metrics.sms_sent++;
        if (log.clicked_at) metrics.sms_clicked++;
      }
    });

    // Calculate engagement rates
    metrics.email_open_rate = metrics.emails_sent > 0 
      ? (metrics.emails_opened / metrics.emails_sent) * 100 
      : 0;
    
    metrics.email_click_rate = metrics.emails_opened > 0 
      ? (metrics.emails_clicked / metrics.emails_opened) * 100 
      : 0;
    
    metrics.inbox_completion_rate = metrics.inbox_messages_sent > 0
      ? (metrics.inbox_messages_read / metrics.inbox_messages_sent) * 100
      : 0;

    // Calculate activation time
    const profile = await this.courier.profiles.get(userId);
    if (profile.first_project_date) {
      const signup = new Date(profile.signupDate);
      const activation = new Date(profile.first_project_date);
      metrics.days_to_activation = Math.floor((activation - signup) / (1000 * 60 * 60 * 24));
    }

    // Calculate engagement score (0-100)
    metrics.engagement_score = this.calculateEngagementScore(metrics);

    return metrics;
  }

  calculateEngagementScore(metrics) {
    let score = 0;
    
    // Email engagement (max 25 points)
    score += Math.min(metrics.email_open_rate * 0.15, 15);
    score += Math.min(metrics.email_click_rate * 0.10, 10);
    
    // Task completion (max 30 points)
    score += Math.min(metrics.inbox_completion_rate * 0.30, 30);
    
    // Multi-channel engagement (max 20 points)
    const channelsUsed = [
      metrics.emails_opened > 0,
      metrics.inbox_messages_read > 0,
      metrics.push_opened > 0,
      metrics.sms_clicked > 0
    ].filter(Boolean).length;
    score += channelsUsed * 5;
    
    // Time to activation (max 25 points)
    if (metrics.days_to_activation !== null) {
      if (metrics.days_to_activation <= 1) score += 25;
      else if (metrics.days_to_activation <= 3) score += 20;
      else if (metrics.days_to_activation <= 7) score += 15;
      else if (metrics.days_to_activation <= 14) score += 10;
      else score += 5;
    }
    
    return Math.round(score);
  }

  async generateCohortReport(startDate, endDate, cohortType = 'weekly') {
    const report = {
      cohort_type: cohortType,
      start_date: startDate,
      end_date: endDate,
      cohorts: [],
      summary: {
        total_users: 0,
        activated_users: 0,
        average_time_to_activation: 0,
        average_engagement_score: 0,
        best_performing_channel: null,
        worst_performing_channel: null
      }
    };

    // Get users who signed up in the date range
    const users = await this.getUsersInDateRange(startDate, endDate);
    report.summary.total_users = users.length;

    // Group users into cohorts
    const cohorts = this.groupIntoCohorts(users, cohortType);
    
    // Analyze each cohort
    for (const cohort of cohorts) {
      const cohortMetrics = {
        cohort_id: cohort.id,
        cohort_date: cohort.date,
        user_count: cohort.users.length,
        metrics: {
          activation_rate: 0,
          average_time_to_activation: 0,
          engagement_by_day: [],
          channel_performance: {},
          funnel_metrics: {}
        }
      };

      // Calculate cohort metrics
      for (const user of cohort.users) {
        const userMetrics = await this.trackEngagement(user.id);
        
        if (userMetrics.days_to_activation !== null) {
          cohortMetrics.metrics.activation_rate++;
          cohortMetrics.metrics.average_time_to_activation += userMetrics.days_to_activation;
        }
      }

      // Finalize cohort calculations
      if (cohort.users.length > 0) {
        cohortMetrics.metrics.activation_rate = 
          (cohortMetrics.metrics.activation_rate / cohort.users.length) * 100;
        
        if (cohortMetrics.metrics.average_time_to_activation > 0) {
          cohortMetrics.metrics.average_time_to_activation /= 
            cohort.users.filter(u => u.activated).length;
        }
      }

      report.cohorts.push(cohortMetrics);
    }

    // Calculate summary metrics
    report.summary = this.calculateSummaryMetrics(report.cohorts);
    
    return report;
  }

  async generateFunnelAnalysis(userId) {
    const funnel = {
      user_id: userId,
      stages: [
        { name: 'Signed Up', completed: false, timestamp: null },
        { name: 'Completed Profile', completed: false, timestamp: null },
        { name: 'Invited Team', completed: false, timestamp: null },
        { name: 'Created Project', completed: false, timestamp: null },
        { name: 'Connected Integration', completed: false, timestamp: null },
        { name: 'Activated', completed: false, timestamp: null }
      ],
      drop_off_point: null,
      time_between_stages: []
    };

    const profile = await this.courier.profiles.get(userId);
    const logs = await this.courier.logs.list({
      recipient: userId,
      limit: 100
    });

    // Check funnel stages
    if (profile.signupDate) {
      funnel.stages[0].completed = true;
      funnel.stages[0].timestamp = profile.signupDate;
    }

    if (profile.profile_completed) {
      funnel.stages[1].completed = true;
      funnel.stages[1].timestamp = profile.profile_completed_at;
    }

    if (logs.some(log => log.event === 'team_invited')) {
      funnel.stages[2].completed = true;
      funnel.stages[2].timestamp = logs.find(log => log.event === 'team_invited').timestamp;
    }

    if (profile.first_project_date) {
      funnel.stages[3].completed = true;
      funnel.stages[3].timestamp = profile.first_project_date;
    }

    if (logs.some(log => log.event === 'integration_connected')) {
      funnel.stages[4].completed = true;
      funnel.stages[4].timestamp = logs.find(log => log.event === 'integration_connected').timestamp;
    }

    if (profile.activation_complete) {
      funnel.stages[5].completed = true;
      funnel.stages[5].timestamp = profile.activation_date;
    }

    // Find drop-off point
    for (let i = 0; i < funnel.stages.length; i++) {
      if (!funnel.stages[i].completed) {
        funnel.drop_off_point = funnel.stages[i].name;
        break;
      }
    }

    // Calculate time between stages
    for (let i = 1; i < funnel.stages.length; i++) {
      if (funnel.stages[i].completed && funnel.stages[i-1].completed) {
        const timeDiff = new Date(funnel.stages[i].timestamp) - new Date(funnel.stages[i-1].timestamp);
        funnel.time_between_stages.push({
          from: funnel.stages[i-1].name,
          to: funnel.stages[i].name,
          duration_hours: Math.floor(timeDiff / (1000 * 60 * 60))
        });
      }
    }

    return funnel;
  }

  async identifyAtRiskUsers() {
    const atRiskUsers = [];
    const allUsers = await this.getAllActiveUsers();
    
    for (const user of allUsers) {
      const profile = await this.courier.profiles.get(user.id);
      const metrics = await this.trackEngagement(user.id);
      
      const riskFactors = [];
      let riskScore = 0;
      
      // Check for risk factors
      if (metrics.email_open_rate < 20) {
        riskFactors.push('Low email engagement');
        riskScore += 3;
      }
      
      if (metrics.tasks_completed === 0 && profile.days_since_signup > 3) {
        riskFactors.push('No tasks completed');
        riskScore += 4;
      }
      
      if (!profile.last_login || 
          new Date() - new Date(profile.last_login) > 7 * 24 * 60 * 60 * 1000) {
        riskFactors.push('Inactive for 7+ days');
        riskScore += 5;
      }
      
      if (metrics.engagement_score < 30) {
        riskFactors.push('Low overall engagement');
        riskScore += 3;
      }
      
      if (riskScore > 5) {
        atRiskUsers.push({
          user_id: user.id,
          email: profile.email,
          company: profile.company,
          plan: profile.plan,
          risk_score: riskScore,
          risk_factors: riskFactors,
          recommended_actions: this.getRecommendedActions(riskFactors),
          days_since_signup: profile.days_since_signup,
          last_activity: profile.last_login
        });
      }
    }
    
    // Sort by risk score
    atRiskUsers.sort((a, b) => b.risk_score - a.risk_score);
    
    return atRiskUsers;
  }

  getRecommendedActions(riskFactors) {
    const actions = [];
    
    if (riskFactors.includes('Low email engagement')) {
      actions.push('Try SMS or in-app messages');
      actions.push('Review email content and timing');
    }
    
    if (riskFactors.includes('No tasks completed')) {
      actions.push('Send simplified getting started guide');
      actions.push('Offer 1-on-1 onboarding call');
    }
    
    if (riskFactors.includes('Inactive for 7+ days')) {
      actions.push('Send re-engagement campaign');
      actions.push('Reach out personally via phone');
    }
    
    return actions;
  }

  async exportAnalyticsReport(format = 'json') {
    const report = {
      generated_at: new Date().toISOString(),
      period: 'last_30_days',
      metrics: {
        total_users_onboarded: 0,
        average_time_to_activation: 0,
        completion_rate: 0,
        channel_performance: {},
        top_drop_off_points: [],
        engagement_trends: []
      },
      recommendations: []
    };
    
    // Gather all metrics
    // ... implementation ...
    
    if (format === 'csv') {
      return this.convertToCSV(report);
    }
    
    return report;
  }

  // Helper methods
  async getUsersInDateRange(startDate, endDate) {
    // Implementation depends on your user storage
    return [];
  }

  groupIntoCohorts(users, cohortType) {
    // Group users by week/month/etc
    return [];
  }

  calculateSummaryMetrics(cohorts) {
    // Calculate overall metrics from cohort data
    return {};
  }

  async getAllActiveUsers() {
    // Get all users who haven't churned
    return [];
  }

  convertToCSV(data) {
    // Convert JSON report to CSV format
    return '';
  }
}

export default OnboardingAnalytics;