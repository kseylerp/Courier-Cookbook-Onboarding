// Microsoft Teams Escalation
// Alternative to Slack for enterprise customers using Microsoft ecosystem

class TeamsEscalation {
  constructor(courier, teamsWebhookUrl) {
    this.courier = courier;
    this.teamsWebhookUrl = teamsWebhookUrl;
  }

  async sendTeamsAlert(userId, profile) {
    const blockers = await this.identifyBlockers(userId);
    const riskScore = this.calculateRiskScore(profile);
    
    // Microsoft Teams adaptive card format
    const teamsCard = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      "themeColor": riskScore > 7 ? "FF0000" : riskScore > 4 ? "FFA500" : "00FF00",
      "summary": `Enterprise Customer Alert: ${profile.company}`,
      "sections": [
        {
          "activityTitle": `⚠️ ${profile.company} Needs Attention`,
          "activitySubtitle": "Onboarding Alert",
          "activityImage": "https://assets.teamsync.com/alert-icon.png",
          "facts": [
            {
              "name": "Customer",
              "value": profile.name
            },
            {
              "name": "Email",
              "value": profile.email
            },
            {
              "name": "Account Value",
              "value": `$${profile.account_value}/year`
            },
            {
              "name": "Plan",
              "value": profile.plan
            },
            {
              "name": "Days Since Signup",
              "value": profile.days_since_signup.toString()
            },
            {
              "name": "Onboarding Progress",
              "value": `${profile.onboarding_progress}%`
            },
            {
              "name": "Risk Score",
              "value": `${riskScore}/10`
            },
            {
              "name": "Last Activity",
              "value": this.formatLastActivity(profile.last_login)
            }
          ],
          "markdown": true
        },
        {
          "activityTitle": "Blockers Identified",
          "text": blockers.map(b => `• ${b}`).join('\n')
        },
        {
          "activityTitle": "Recommended Actions",
          "text": this.getRecommendedActions(blockers).map(a => `• ${a}`).join('\n')
        }
      ],
      "potentialAction": [
        {
          "@type": "OpenUri",
          "name": "View Customer Profile",
          "targets": [
            {
              "os": "default",
              "uri": `https://app.teamsync.com/admin/customers/${userId}`
            }
          ]
        },
        {
          "@type": "OpenUri",
          "name": "Schedule Call",
          "targets": [
            {
              "os": "default",
              "uri": `https://calendly.com/success-team/${userId}`
            }
          ]
        },
        {
          "@type": "OpenUri",
          "name": "Send Email",
          "targets": [
            {
              "os": "default",
              "uri": `mailto:${profile.email}?subject=TeamSync Onboarding Support`
            }
          ]
        },
        {
          "@type": "ActionCard",
          "name": "Update Status",
          "inputs": [
            {
              "@type": "TextInput",
              "id": "comment",
              "title": "Add a comment",
              "isMultiline": true
            },
            {
              "@type": "MultichoiceInput",
              "id": "status",
              "title": "Update status",
              "choices": [
                {
                  "display": "Contacted",
                  "value": "contacted"
                },
                {
                  "display": "In Progress",
                  "value": "in_progress"
                },
                {
                  "display": "Resolved",
                  "value": "resolved"
                },
                {
                  "display": "Escalated",
                  "value": "escalated"
                }
              ]
            }
          ],
          "actions": [
            {
              "@type": "HttpPOST",
              "name": "Submit",
              "target": "https://api.teamsync.com/teams/update-status",
              "body": "{\"userId\": \"{{userId}}\", \"status\": \"{{status.value}}\", \"comment\": \"{{comment.value}}\"}"
            }
          ]
        }
      ]
    };

    // Send via Courier to Teams
    await this.courier.send({
      message: {
        template: "teams-enterprise-alert",
        to: {
          ms_teams: {
            webhook_url: this.teamsWebhookUrl,
            channel: "Customer Success"
          }
        },
        data: {
          card: teamsCard,
          profile: profile,
          blockers: blockers,
          risk_score: riskScore
        },
        providers: {
          ms_teams: {
            override: {
              body: teamsCard
            }
          }
        }
      }
    });

    // Also send to Teams channel using Graph API if configured
    if (process.env.MS_GRAPH_TOKEN) {
      await this.sendViaGraphAPI(teamsCard, profile);
    }
  }

  async sendViaGraphAPI(card, profile) {
    // Microsoft Graph API integration for more advanced Teams features
    const graphEndpoint = 'https://graph.microsoft.com/v1.0';
    const teamId = process.env.MS_TEAMS_TEAM_ID;
    const channelId = process.env.MS_TEAMS_CHANNEL_ID;
    
    const message = {
      body: {
        contentType: "html",
        content: `<attachment id="1"></attachment>`
      },
      attachments: [
        {
          id: "1",
          contentType: "application/vnd.microsoft.card.adaptive",
          content: JSON.stringify(this.createAdaptiveCard(profile))
        }
      ]
    };

    try {
      const response = await fetch(
        `${graphEndpoint}/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MS_GRAPH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        }
      );

      if (!response.ok) {
        throw new Error(`Graph API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send via Graph API:', error);
    }
  }

  createAdaptiveCard(profile) {
    // Modern Adaptive Card format (preferred over MessageCard)
    return {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.3",
      "body": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "Image",
                  "url": "https://assets.teamsync.com/alert-icon.png",
                  "size": "Small"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "Enterprise Customer Alert",
                  "weight": "Bolder",
                  "size": "Large",
                  "color": "Attention"
                },
                {
                  "type": "TextBlock",
                  "text": `${profile.company} needs attention`,
                  "size": "Medium",
                  "weight": "Lighter"
                }
              ]
            }
          ]
        },
        {
          "type": "FactSet",
          "facts": [
            {
              "title": "Customer:",
              "value": profile.name
            },
            {
              "title": "Account Value:",
              "value": `$${profile.account_value}/year`
            },
            {
              "title": "Progress:",
              "value": `${profile.onboarding_progress}%`
            },
            {
              "title": "Risk Level:",
              "value": this.getRiskLevel(profile)
            }
          ]
        },
        {
          "type": "Container",
          "items": [
            {
              "type": "TextBlock",
              "text": "Quick Actions",
              "weight": "Bolder"
            },
            {
              "type": "ActionSet",
              "actions": [
                {
                  "type": "Action.OpenUrl",
                  "title": "View Profile",
                  "url": `https://app.teamsync.com/admin/customers/${profile.id}`,
                  "style": "positive"
                },
                {
                  "type": "Action.OpenUrl",
                  "title": "Schedule Call",
                  "url": `https://calendly.com/success-team/${profile.id}`
                },
                {
                  "type": "Action.Submit",
                  "title": "Mark as Handled",
                  "data": {
                    "action": "mark_handled",
                    "user_id": profile.id
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }

  async createTeamsChannel(customerName) {
    // Create a dedicated Teams channel for high-value customers
    const graphEndpoint = 'https://graph.microsoft.com/v1.0';
    const teamId = process.env.MS_TEAMS_TEAM_ID;
    
    const channel = {
      displayName: `Customer - ${customerName}`,
      description: `Dedicated channel for ${customerName} onboarding`,
      membershipType: "private"
    };

    try {
      const response = await fetch(
        `${graphEndpoint}/teams/${teamId}/channels`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MS_GRAPH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(channel)
        }
      );

      if (response.ok) {
        const createdChannel = await response.json();
        
        // Add success team members
        await this.addChannelMembers(teamId, createdChannel.id);
        
        // Post initial message
        await this.postWelcomeMessage(teamId, createdChannel.id, customerName);
        
        return createdChannel;
      }
    } catch (error) {
      console.error('Failed to create Teams channel:', error);
    }
  }

  async addChannelMembers(teamId, channelId) {
    const successTeamMembers = [
      process.env.SUCCESS_MANAGER_ID,
      process.env.ONBOARDING_SPECIALIST_ID,
      process.env.TECHNICAL_LEAD_ID
    ];

    for (const memberId of successTeamMembers) {
      if (memberId) {
        await this.addMemberToChannel(teamId, channelId, memberId);
      }
    }
  }

  async addMemberToChannel(teamId, channelId, userId) {
    const graphEndpoint = 'https://graph.microsoft.com/v1.0';
    
    const member = {
      "@odata.type": "#microsoft.graph.aadUserConversationMember",
      "user@odata.bind": `https://graph.microsoft.com/v1.0/users/${userId}`,
      "roles": ["owner"]
    };

    try {
      await fetch(
        `${graphEndpoint}/teams/${teamId}/channels/${channelId}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MS_GRAPH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(member)
        }
      );
    } catch (error) {
      console.error(`Failed to add member ${userId}:`, error);
    }
  }

  async postWelcomeMessage(teamId, channelId, customerName) {
    const message = {
      body: {
        contentType: "html",
        content: `
          <h2>Welcome to ${customerName}'s Onboarding Channel!</h2>
          <p>This channel has been created to coordinate the onboarding of ${customerName}.</p>
          <ul>
            <li>All customer communications should be logged here</li>
            <li>Use @mentions to notify team members</li>
            <li>Pin important messages and documents</li>
            <li>Update the customer status in the pinned message</li>
          </ul>
          <p>Let's ensure ${customerName} has a fantastic onboarding experience! 🚀</p>
        `
      }
    };

    const graphEndpoint = 'https://graph.microsoft.com/v1.0';
    
    try {
      await fetch(
        `${graphEndpoint}/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MS_GRAPH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        }
      );
    } catch (error) {
      console.error('Failed to post welcome message:', error);
    }
  }

  // Helper methods (similar to Slack escalation)
  async identifyBlockers(userId) {
    const logs = await this.courier.logs.list({
      recipient: userId,
      limit: 50
    });

    const blockers = [];
    
    if (!logs.some(log => log.event === "team_invited")) {
      blockers.push("❌ Haven't invited team members");
    }
    
    if (!logs.some(log => log.event === "project_created")) {
      blockers.push("❌ Haven't created first project");
    }
    
    return blockers;
  }

  calculateRiskScore(profile) {
    let score = 0;
    
    if (profile.days_since_signup > 7) score += 3;
    if (!profile.last_login) score += 3;
    if (profile.onboarding_progress < 20) score += 3;
    
    return Math.min(score, 10);
  }

  getRiskLevel(profile) {
    const score = this.calculateRiskScore(profile);
    if (score > 7) return "🔴 High";
    if (score > 4) return "🟡 Medium";
    return "🟢 Low";
  }

  formatLastActivity(lastLogin) {
    if (!lastLogin) return "Never logged in";
    
    const now = new Date();
    const last = new Date(lastLogin);
    const hours = Math.floor((now - last) / (1000 * 60 * 60));
    
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  }

  getRecommendedActions(blockers) {
    const actions = [];
    
    if (blockers.includes("Haven't invited team members")) {
      actions.push("Send team collaboration guide");
    }
    
    if (blockers.includes("Haven't created first project")) {
      actions.push("Schedule walkthrough call");
    }
    
    return actions;
  }
}

export default TeamsEscalation;