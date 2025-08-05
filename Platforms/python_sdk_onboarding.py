# Python SDK for Onboarding
# Use Courier's Python SDK for backend onboarding flows

from trycourier import Courier
from datetime import datetime, timedelta
import asyncio
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

# Initialize Courier client
client = Courier(
    auth_token="YOUR_COURIER_AUTH_TOKEN"
)

class OnboardingPlan(Enum):
    TRIAL = "trial"
    STARTUP = "startup"
    ENTERPRISE = "enterprise"
    EDUCATION = "education"

@dataclass
class User:
    id: str
    email: str
    name: str
    company: str
    plan: OnboardingPlan
    company_size: int
    created_at: datetime

class PythonOnboardingSystem:
    def __init__(self, courier_client: Courier):
        self.courier = courier_client
        
    async def create_user_and_start_onboarding(self, user_data: Dict[str, Any]) -> Dict:
        """Create user profile and trigger onboarding flow"""
        
        user = User(
            id=user_data['id'],
            email=user_data['email'],
            name=user_data['name'],
            company=user_data.get('company', ''),
            plan=OnboardingPlan(user_data.get('plan', 'trial')),
            company_size=user_data.get('company_size', 1),
            created_at=datetime.now()
        )
        
        # Create/update user profile in Courier
        profile_response = self.courier.profiles.merge(
            recipient_id=user.id,
            profile={
                "email": user.email,
                "name": user.name,
                "company": user.company,
                "plan": user.plan.value,
                "company_size": user.company_size,
                "signup_date": user.created_at.isoformat(),
                "timezone": user_data.get('timezone', 'UTC'),
                "locale": user_data.get('locale', 'en'),
            }
        )
        
        # Trigger appropriate onboarding flow
        automation_id = self._get_automation_for_plan(user.plan)
        
        automation_response = self.courier.automations.invoke(
            automation_id=automation_id,
            recipient=user.id,
            data={
                "user_name": user.name,
                "company_name": user.company,
                "plan_features": self._get_plan_features(user.plan)
            }
        )
        
        # Send welcome email immediately
        self.send_welcome_email(user)
        
        # Schedule onboarding tasks
        self.create_onboarding_tasks(user)
        
        return {
            "user_id": user.id,
            "profile_created": profile_response,
            "automation_started": automation_response,
            "status": "onboarding_initiated"
        }
    
    def send_welcome_email(self, user: User) -> Dict:
        """Send personalized welcome email"""
        
        template_data = {
            "user_name": user.name,
            "company_name": user.company,
            "getting_started_link": f"https://app.example.com/onboarding/{user.id}",
            "support_email": self._get_support_email(user.plan),
            "onboarding_checklist": self._get_onboarding_checklist(user.plan)
        }
        
        response = self.courier.send(
            message={
                "to": {
                    "user_id": user.id
                },
                "template": "welcome-email",
                "data": template_data,
                "channels": {
                    "email": {
                        "override": {
                            "subject": f"Welcome to TeamSync, {user.name}! 🎉"
                        }
                    }
                }
            }
        )
        
        return response
    
    def create_onboarding_tasks(self, user: User) -> List[Dict]:
        """Create onboarding tasks in Courier Inbox"""
        
        base_tasks = [
            {
                "id": "complete-profile",
                "title": "Complete your profile",
                "priority": 1,
                "due_days": 1
            },
            {
                "id": "invite-team",
                "title": "Invite your team members",
                "priority": 2,
                "due_days": 3
            },
            {
                "id": "create-project",
                "title": "Create your first project",
                "priority": 3,
                "due_days": 7
            }
        ]
        
        # Add plan-specific tasks
        if user.plan == OnboardingPlan.ENTERPRISE:
            base_tasks.extend([
                {
                    "id": "schedule-onboarding-call",
                    "title": "Schedule onboarding call with success team",
                    "priority": 0,
                    "due_days": 1
                },
                {
                    "id": "setup-sso",
                    "title": "Configure Single Sign-On",
                    "priority": 4,
                    "due_days": 14
                }
            ])
        
        tasks_created = []
        for task in base_tasks:
            due_date = datetime.now() + timedelta(days=task['due_days'])
            
            response = self.courier.send(
                message={
                    "to": {"user_id": user.id},
                    "template": "onboarding-task",
                    "channels": ["inbox"],
                    "data": {
                        "task_id": task['id'],
                        "task_title": task['title'],
                        "due_date": due_date.isoformat(),
                        "action_url": f"/tasks/{task['id']}"
                    },
                    "metadata": {
                        "tags": ["onboarding", f"priority-{task['priority']}"]
                    }
                }
            )
            tasks_created.append(response)
        
        return tasks_created
    
    async def track_user_progress(self, user_id: str) -> Dict:
        """Track and analyze user's onboarding progress"""
        
        # Get user profile
        profile = self.courier.profiles.get(recipient_id=user_id)
        
        # Get message logs
        logs = self.courier.logs.list(
            recipient=user_id,
            limit=50
        )
        
        metrics = {
            "user_id": user_id,
            "days_since_signup": self._calculate_days_since(profile.get('signup_date')),
            "emails_sent": 0,
            "emails_opened": 0,
            "tasks_completed": 0,
            "last_activity": None,
            "engagement_score": 0
        }
        
        # Analyze logs
        for log in logs:
            if log['channel'] == 'email':
                metrics['emails_sent'] += 1
                if log.get('opened_at'):
                    metrics['emails_opened'] += 1
            
            if log['channel'] == 'inbox' and log.get('read_at'):
                metrics['tasks_completed'] += 1
            
            if log.get('timestamp'):
                if not metrics['last_activity'] or log['timestamp'] > metrics['last_activity']:
                    metrics['last_activity'] = log['timestamp']
        
        # Calculate engagement score
        metrics['engagement_score'] = self._calculate_engagement_score(metrics)
        
        # Check if intervention needed
        if self._needs_intervention(metrics):
            await self._trigger_intervention(user_id, metrics)
        
        return metrics
    
    async def _trigger_intervention(self, user_id: str, metrics: Dict):
        """Trigger intervention for at-risk users"""
        
        profile = self.courier.profiles.get(recipient_id=user_id)
        
        if profile.get('plan') == 'enterprise':
            # Escalate to Slack for enterprise customers
            self.courier.send(
                message={
                    "to": {
                        "slack": {
                            "channel": "#customer-success",
                            "access_token": "YOUR_SLACK_TOKEN"
                        }
                    },
                    "template": "enterprise-intervention-alert",
                    "data": {
                        "user_id": user_id,
                        "company": profile.get('company'),
                        "metrics": metrics,
                        "risk_level": "high" if metrics['engagement_score'] < 30 else "medium"
                    }
                }
            )
        else:
            # Send re-engagement email
            self.courier.send(
                message={
                    "to": {"user_id": user_id},
                    "template": "re-engagement-email",
                    "data": {
                        "days_inactive": metrics['days_since_signup'],
                        "uncompleted_tasks": 5 - metrics['tasks_completed']
                    }
                }
            )
    
    def send_milestone_celebration(self, user_id: str, milestone: str):
        """Send celebration message for completed milestones"""
        
        celebrations = {
            "first_project": {
                "template": "first-project-celebration",
                "reward": "1 month free upgrade"
            },
            "team_invited": {
                "template": "team-growth-celebration",
                "reward": "Collaboration guide"
            },
            "week_active": {
                "template": "engagement-celebration",
                "reward": "Power user badge"
            }
        }
        
        if milestone in celebrations:
            self.courier.send(
                message={
                    "to": {"user_id": user_id},
                    "template": celebrations[milestone]['template'],
                    "data": {
                        "milestone": milestone,
                        "reward": celebrations[milestone]['reward']
                    },
                    "channels": ["email", "inbox", "push"]
                }
            )
    
    def create_digest_for_team_leads(self):
        """Create weekly digest for team leads about their team's onboarding"""
        
        # This would run as a scheduled job
        team_leads = self._get_team_leads()
        
        for lead in team_leads:
            team_metrics = self._get_team_onboarding_metrics(lead['team_id'])
            
            self.courier.send(
                message={
                    "to": {"user_id": lead['user_id']},
                    "template": "team-onboarding-digest",
                    "data": {
                        "team_name": lead['team_name'],
                        "new_members": team_metrics['new_members'],
                        "activation_rate": team_metrics['activation_rate'],
                        "average_progress": team_metrics['average_progress'],
                        "members_needing_help": team_metrics['at_risk_members']
                    }
                }
            )
    
    # Helper methods
    def _get_automation_for_plan(self, plan: OnboardingPlan) -> str:
        automations = {
            OnboardingPlan.TRIAL: "trial-onboarding-flow",
            OnboardingPlan.STARTUP: "startup-onboarding-flow",
            OnboardingPlan.ENTERPRISE: "enterprise-onboarding-flow",
            OnboardingPlan.EDUCATION: "education-onboarding-flow"
        }
        return automations.get(plan, "default-onboarding-flow")
    
    def _get_plan_features(self, plan: OnboardingPlan) -> List[str]:
        features = {
            OnboardingPlan.TRIAL: ["basic_features", "email_support"],
            OnboardingPlan.STARTUP: ["all_features", "priority_support", "integrations"],
            OnboardingPlan.ENTERPRISE: ["all_features", "dedicated_support", "sso", "api_access"],
            OnboardingPlan.EDUCATION: ["education_features", "bulk_licensing", "lms_integration"]
        }
        return features.get(plan, [])
    
    def _get_support_email(self, plan: OnboardingPlan) -> str:
        if plan == OnboardingPlan.ENTERPRISE:
            return "enterprise-support@example.com"
        return "support@example.com"
    
    def _get_onboarding_checklist(self, plan: OnboardingPlan) -> List[str]:
        base_checklist = [
            "Complete your profile",
            "Invite team members",
            "Create first project",
            "Connect integrations"
        ]
        
        if plan == OnboardingPlan.ENTERPRISE:
            base_checklist.extend([
                "Schedule onboarding call",
                "Configure SSO",
                "Review security settings"
            ])
        
        return base_checklist
    
    def _calculate_days_since(self, date_str: Optional[str]) -> int:
        if not date_str:
            return 0
        
        signup_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return (datetime.now() - signup_date).days
    
    def _calculate_engagement_score(self, metrics: Dict) -> int:
        score = 0
        
        # Email engagement (max 40 points)
        if metrics['emails_sent'] > 0:
            open_rate = metrics['emails_opened'] / metrics['emails_sent']
            score += min(open_rate * 40, 40)
        
        # Task completion (max 40 points)
        score += min(metrics['tasks_completed'] * 10, 40)
        
        # Recency (max 20 points)
        if metrics['last_activity']:
            days_since_activity = self._calculate_days_since(metrics['last_activity'])
            if days_since_activity == 0:
                score += 20
            elif days_since_activity <= 3:
                score += 10
            elif days_since_activity <= 7:
                score += 5
        
        return min(score, 100)
    
    def _needs_intervention(self, metrics: Dict) -> bool:
        return (
            metrics['engagement_score'] < 30 or
            metrics['days_since_signup'] > 7 and metrics['tasks_completed'] < 2 or
            metrics['emails_opened'] == 0 and metrics['emails_sent'] > 3
        )
    
    def _get_team_leads(self) -> List[Dict]:
        # Placeholder - would query your database
        return []
    
    def _get_team_onboarding_metrics(self, team_id: str) -> Dict:
        # Placeholder - would calculate team metrics
        return {
            "new_members": 0,
            "activation_rate": 0,
            "average_progress": 0,
            "at_risk_members": []
        }


# Example usage
async def main():
    courier = Courier(auth_token="YOUR_AUTH_TOKEN")
    onboarding = PythonOnboardingSystem(courier)
    
    # Create new user and start onboarding
    new_user = await onboarding.create_user_and_start_onboarding({
        "id": "user-123",
        "email": "john@company.com",
        "name": "John Doe",
        "company": "Acme Corp",
        "plan": "enterprise",
        "company_size": 150,
        "timezone": "America/New_York"
    })
    
    print(f"Onboarding started for user {new_user['user_id']}")
    
    # Track progress after some time
    await asyncio.sleep(86400)  # Wait 1 day
    progress = await onboarding.track_user_progress("user-123")
    print(f"User engagement score: {progress['engagement_score']}")
    
    # Send milestone celebration
    onboarding.send_milestone_celebration("user-123", "first_project")

if __name__ == "__main__":
    asyncio.run(main())